import { useEffect, useRef } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { TutorialProvider, useTutorial } from '../src/tutorial/TutorialProvider';
import { TutorialOverlay } from '../src/tutorial/TutorialOverlay';
import { ConflictProvider } from '../src/sync/ConflictProvider';
import { PomodoroProvider } from '../src/pomodoro/PomodoroProvider';
import { ConflictDialog } from '../src/sync/ConflictDialog';
import { prefs } from '../src/lib/prefs';
import { useOrientationLock } from '../src/lib/use-orientation-lock';
import { useTheme } from '../src/theme';

// Foreground behavior: while the app is open, PomodoroProvider already shows
// an in-app Alert on phase completion, so the OS banner/list entry would be
// redundant — suppress those two but keep the sound. Backgrounded, there is no
// in-app alert to duplicate, so show everything normally.
Notifications.setNotificationHandler({
  handleNotification: async () => {
    const foreground = AppState.currentState === 'active';
    return {
      shouldShowBanner: !foreground,
      shouldShowList: !foreground,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

// Android 8+ requires every notification to belong to a channel, or it is
// silently dropped — no error, nothing in the logs. One-time setup.
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('pomodoro', {
    name: 'Study timer',
    importance: Notifications.AndroidImportance.DEFAULT,
  }).catch(() => {});
}

function AppShell() {
  const theme = useTheme();
  useOrientationLock();
  const scheme = useColorScheme();
  const { session, loading, connectionError, retryConnection } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { start } = useTutorial();
  const firstRunChecked = useRef(false);

  // Redirect to /sign-in when not authenticated, back to / when authenticated.
  // The legal-document screens (linked from the sign-up form itself) are
  // exempted from the gate so they're reachable before a session exists.
  useEffect(() => {
    if (loading) return;
    const inSignIn = pathname === '/sign-in';
    const inLegalDocs = pathname.startsWith('/settings/legal/');
    if (!session && !inSignIn && !inLegalDocs) {
      router.replace('/sign-in');
    } else if (session && inSignIn) {
      router.replace('/');
    }
  }, [session, loading, pathname]);

  // First-run trigger: once authenticated and not loading, show the tutorial
  // if it hasn't been seen. Guarded to fire only once per launch and only when
  // a session exists (so it never appears over the sign-in screen).
  useEffect(() => {
    if (loading || !session || firstRunChecked.current) return;
    firstRunChecked.current = true;
    prefs.getTutorialSeen().then((seen) => {
      if (!seen) start();
    });
  }, [session, loading]);

  // Paused/offline at launch with no cached session: show a retry state instead of
  // an endless spinner. With a cached session we let the app in (offline-tolerant)
  // and let individual data calls fail softly.
  if (connectionError && !session) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[styles.pauseTitle, { color: theme.text }]}>Can't reach Lectio's servers</Text>
        <Text style={[styles.pauseBody, { color: theme.muted }]}>
          The service may be temporarily unavailable. Check your connection and try again.
        </Text>
        <Pressable style={[styles.retryBtn, { backgroundColor: theme.accent }]} onPress={retryConnection}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.surface },
            headerTitleStyle: { color: theme.text },
            headerTintColor: theme.accent,
            contentStyle: { backgroundColor: theme.background },
          }}
        >
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
          <Stack.Screen name="index" options={{ title: 'Semesters' }} />
          <Stack.Screen name="add" options={{ presentation: 'modal', title: 'Add', headerShown: false }} />
          <Stack.Screen name="semester-form" options={{ presentation: 'modal', title: 'New Semester', headerShown: false }} />
          <Stack.Screen name="moodle-import" options={{ presentation: 'modal', title: 'Import from Moodle', headerShown: false }} />
          <Stack.Screen name="moodle-triage" options={{ presentation: 'modal', title: 'Import weeks', headerShown: false }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="settings/legal/[doc]" options={{ title: 'Legal' }} />
          <Stack.Screen name="moodle" options={{ title: 'Moodle' }} />
          <Stack.Screen name="feedback" options={{ title: 'Feedback' }} />
          <Stack.Screen name="profile" options={{ title: 'Profile' }} />
          <Stack.Screen name="semester/course-form" options={{ presentation: 'modal', title: 'Course', headerShown: false }} />
          <Stack.Screen name="semester/item-form" options={{ presentation: 'modal', title: 'Item', headerShown: false }} />
        </Stack>
        <TutorialOverlay />
        <ConflictDialog />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  pauseTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  pauseBody: { fontSize: 14, textAlign: 'center', maxWidth: 320 },
  retryBtn: {
    height: 48,
    minWidth: 140,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});

export default function RootLayout() {
  return (
    <AuthProvider>
      <TutorialProvider>
        <ConflictProvider>
          <PomodoroProvider>
            <AppShell />
          </PomodoroProvider>
        </ConflictProvider>
      </TutorialProvider>
    </AuthProvider>
  );
}
