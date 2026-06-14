import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { StudyModeProvider } from '../src/study/StudyModeProvider';
import { TutorialProvider, useTutorial } from '../src/tutorial/TutorialProvider';
import { TutorialOverlay } from '../src/tutorial/TutorialOverlay';
import { prefs } from '../src/lib/prefs';
import { useTheme } from '../src/theme';

function AppShell() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { start } = useTutorial();
  const firstRunChecked = useRef(false);

  // Redirect to /sign-in when not authenticated, back to / when authenticated.
  useEffect(() => {
    if (loading) return;
    const inSignIn = segments[0] === 'sign-in';
    if (!session && !inSignIn) {
      router.replace('/sign-in');
    } else if (session && inSignIn) {
      router.replace('/');
    }
  }, [session, loading, segments]);

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

  if (loading) {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}
      >
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
          <Stack.Screen name="index" options={{ title: 'Semesters' }} />
          <Stack.Screen name="add" options={{ presentation: 'modal', title: 'Add', headerShown: false }} />
          <Stack.Screen name="semester-form" options={{ presentation: 'modal', title: 'New Semester', headerShown: false }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="feedback" options={{ title: 'Feedback' }} />
          <Stack.Screen name="profile" options={{ title: 'Profile' }} />
          <Stack.Screen name="semester/course-form" options={{ presentation: 'modal', title: 'Course', headerShown: false }} />
          <Stack.Screen name="semester/item-form" options={{ presentation: 'modal', title: 'Item', headerShown: false }} />
        </Stack>
        <TutorialOverlay />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StudyModeProvider>
        <TutorialProvider>
          <AppShell />
        </TutorialProvider>
      </StudyModeProvider>
    </AuthProvider>
  );
}
