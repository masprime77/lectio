import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { storage, ensureSeed } from '../src/storage';
import { useTheme } from '../src/theme';

export default function RootLayout() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const [ready, setReady] = useState(false);

  // Seed the sample semester once on first launch, before any screen reads.
  useEffect(() => {
    ensureSeed(storage)
      .catch((err) => console.warn('seed failed', err))
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.background,
        }}
      >
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
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
        <Stack.Screen name="index" options={{ title: 'Semesters' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
