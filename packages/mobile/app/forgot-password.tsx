import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { friendlyAuthError } from '../src/auth/auth-errors';
import { useTheme } from '../src/theme';

// Note: completing the reset by tapping the email link opens a browser; a full
// in-app password update via deep link needs a dev build (Phase 18). For now this
// only sends the email — users complete it on web, or you finish the in-app flow
// once the dev build exists.
export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email.');
      return;
    }
    setBusy(true);
    try {
      await resetPassword(trimmed);
      // Always show the same success copy whether or not the email exists, so we
      // never reveal account existence.
      setSent(true);
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Reset password', headerShown: true }} />
      <View style={styles.card}>
        {sent ? (
          <>
            <Text style={[styles.title, { color: theme.text }]}>Check your inbox</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>
              If an account exists for {email.trim()}, a reset link is on its way. Check your inbox
              (and spam).
            </Text>
            <Pressable style={[styles.btn, { backgroundColor: theme.accent }]} onPress={() => router.back()}>
              <Text style={styles.btnText}>Back to sign in</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: theme.text }]}>Forgot password?</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>
              Enter your email and we'll send you a reset link.
            </Text>

            <TextInput
              style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              placeholder="Email"
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!busy}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {busy ? (
              <ActivityIndicator color={theme.accent} style={{ marginTop: 8 }} />
            ) : (
              <Pressable style={[styles.btn, { backgroundColor: theme.accent }]} onPress={handleSubmit}>
                <Text style={styles.btnText}>Send reset link</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 8 },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  error: { color: '#e53e3e', fontSize: 13, textAlign: 'center' },
  btn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
