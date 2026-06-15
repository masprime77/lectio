// Settings hub. The Account section links to the Profile account hub
// (`app/profile.tsx`), which owns the email / change email / change password /
// delete account / sign-out actions. The About section holds feedback + tutorial.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { useTutorial } from '../src/tutorial/TutorialProvider';
import { useTheme } from '../src/theme';
import { appVersion } from '../src/lib/feedback';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { start } = useTutorial();

  function handleStartTutorial() {
    // Replay on demand — this does not clear the tutorial-seen pref. Return to
    // the semesters list so the overlay floats over the main UI, not Settings.
    start();
    router.back();
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ title: 'Settings' }} />

      <Text style={[styles.sectionTitle, { color: theme.muted }]}>Account</Text>
      <Pressable
        style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => router.push('/profile')}
      >
        <View style={styles.rowTextWrap}>
          <Text style={[styles.rowText, { color: theme.text }]}>Profile</Text>
          <Text style={[styles.rowSubtitle, { color: theme.muted }]} numberOfLines={1}>
            {session?.user?.email ?? 'Unknown account'}
          </Text>
        </View>
        <Text style={[styles.chevron, { color: theme.muted }]}>›</Text>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowTextWrap: { flex: 1, gap: 2, marginRight: 12 },
  rowText: { fontSize: 16, fontWeight: '600' },
  rowSubtitle: { fontSize: 13 },
  chevron: { fontSize: 20, fontWeight: '600' },
  version: { fontSize: 12, textAlign: 'center', marginTop: 16 },
});
