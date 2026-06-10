import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { useTheme } from '../src/theme';

function AppShell() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

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
          <Stack.Screen name="semester-form" options={{ presentation: 'modal', title: 'New Semester' }} />
          <Stack.Screen name="profile" options={{ title: 'Profile' }} />
          <Stack.Screen name="semester/course-form" options={{ presentation: 'modal', title: 'Course' }} />
          <Stack.Screen name="semester/item-form" options={{ presentation: 'modal', title: 'Item' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
