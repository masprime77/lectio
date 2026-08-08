// In-app feedback screen, reachable from Settings. Mirrors the desktop feedback
// modal: a Bug | Feature toggle, a title + description, and a submit that POSTs
// to the shared Vercel endpoint (see src/lib/feedback.ts), which files a GitHub
// issue. On success it swaps to a confirmation; required-field validation and
// the failure path show inline errors without crashing.
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { FormTabs } from '../src/components/FormTabs';
import { useTheme } from '../src/theme';
import { appVersion, submitFeedback, type FeedbackKind } from '../src/lib/feedback';

const TAB_BY_LABEL: Record<string, FeedbackKind> = { Bug: 'bug', Feature: 'feature' };

export default function FeedbackScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) {
      setError('Title and description are required.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await submitFeedback(kind, trimmedTitle, trimmedBody, appVersion);
      setDone(true);
    } catch {
      setError('Could not send feedback. Please try again.');
      setBusy(false);
    }
  }

  if (done) {
    return (
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
      >
        <Stack.Screen options={{ title: 'Feedback' }} />
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.successTitle, { color: theme.text }]}>Thanks for the feedback!</Text>
          <Text style={[styles.successBody, { color: theme.muted }]}>
            Your {kind === 'feature' ? 'feature request' : 'bug report'} was sent. We read everything
            and use it to make Lectio better.
          </Text>
        </View>
        <Pressable style={[styles.btn, { backgroundColor: theme.accent }]} onPress={() => router.back()}>
          <Text style={styles.btnText}>Done</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: 'Feedback' }} />

        <Text style={[styles.intro, { color: theme.muted }]}>
          Found a bug or have an idea? Send it straight to us — no account needed.
        </Text>

        <FormTabs
          tabs={['Bug', 'Feature']}
          active={kind === 'bug' ? 'Bug' : 'Feature'}
          onSelect={(tab) => setKind(TAB_BY_LABEL[tab] ?? 'bug')}
        />

        <Text style={[styles.label, { color: theme.muted }]}>Title</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder={kind === 'feature' ? 'e.g. Add a weekly summary' : 'e.g. App crashes when…'}
          placeholderTextColor={theme.muted}
          value={title}
          onChangeText={setTitle}
          editable={!busy}
        />

        <Text style={[styles.label, { color: theme.muted }]}>Description</Text>
        <TextInput
          style={[
            styles.input,
            styles.multiline,
            { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
          ]}
          placeholder="What happened, or what would you like to see?"
          placeholderTextColor={theme.muted}
          value={body}
          onChangeText={setBody}
          editable={!busy}
          multiline
          textAlignVertical="top"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {busy ? (
          <ActivityIndicator color={theme.accent} style={{ marginTop: 12 }} />
        ) : (
          <Pressable style={[styles.btn, { backgroundColor: theme.accent }]} onPress={handleSubmit}>
            <Text style={styles.btnText}>Send feedback</Text>
          </Pressable>
        )}

        <Text style={[styles.version, { color: theme.muted }]}>Lectio v{appVersion}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  multiline: { minHeight: 120 },
  error: { color: '#ef4444', fontSize: 13, textAlign: 'center', marginTop: 8 },
  btn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  version: { fontSize: 12, textAlign: 'center', marginTop: 16 },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  successTitle: { fontSize: 18, fontWeight: '700' },
  successBody: { fontSize: 14, lineHeight: 20 },
});
