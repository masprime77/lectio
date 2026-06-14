// Settings hub. For now it holds the Profile section (the signed-in account +
// sign-out, moved here from app/profile.tsx). A Feedback section is wired in by
// Prompt 10 and a "Start tutorial" entry by Prompt 11; this is the shell.
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { useTutorial } from '../src/tutorial/TutorialProvider';
import { useTheme } from '../src/theme';
import { appVersion } from '../src/lib/feedback';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { start } = useTutorial();

  function handleStartTutorial() {
    // Replay on demand — this does not clear the tutorial-seen pref. Return to
    // the semesters list so the overlay floats over the main UI, not Settings.
    start();
    router.back();
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Sign out of Lectio?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          signOut().catch((err) => console.warn('sign out failed', err));
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ title: 'Settings' }} />

      <Text style={[styles.sectionTitle, { color: theme.muted }]}>Profile</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.muted }]}>Signed in as</Text>
        <Text style={[styles.email, { color: theme.text }]}>
          {session?.user?.email ?? 'Unknown account'}
        </Text>
      </View>
      <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <Text style={[styles.sectionTitle, { color: theme.muted }]}>About</Text>
      <Pressable
        style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => router.push('/feedback')}
      >
        <Text style={[styles.rowText, { color: theme.text }]}>Send feedback</Text>
        <Text style={[styles.chevron, { color: theme.muted }]}>›</Text>
      </Pressable>
      <Pressable
        style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={handleStartTutorial}
      >
        <Text style={[styles.rowText, { color: theme.text }]}>Start tutorial</Text>
        <Text style={[styles.chevron, { color: theme.muted }]}>›</Text>
      </Pressable>

      <Text style={[styles.version, { color: theme.muted }]}>Lectio v{appVersion}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  label: { fontSize: 13 },
  email: { fontSize: 16, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowText: { fontSize: 16, fontWeight: '600' },
  chevron: { fontSize: 20, fontWeight: '600' },
  version: { fontSize: 12, textAlign: 'center', marginTop: 16 },
  signOutBtn: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  signOutText: { color: '#ef4444', fontWeight: '600', fontSize: 16 },
});
