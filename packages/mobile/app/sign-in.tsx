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
import { useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { friendlyAuthError } from '../src/auth/auth-errors';
import { useTheme } from '../src/theme';

export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const {
    signIn,
    signUp,
    resendConfirmation,
    lastSignUpNeedsConfirmation,
    signInWithGoogle,
    signInWithApple,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(action: 'signIn' | 'signUp') {
    setError(null);
    setBusy(true);
    try {
      if (action === 'signIn') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError(null);
    setBusy(true);
    try {
      await resendConfirmation(email.trim());
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleProvider(provider: 'google' | 'apple') {
    setError(null);
    setBusy(true);
    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithApple();
      }
    } catch (e) {
      // In Expo Go this shows the "needs the installed app" message — expected.
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
      <View style={styles.card}>
        <Text style={[styles.title, { color: theme.text }]}>Lectio</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Sign in to sync your semesters</Text>

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
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="Password"
          placeholderTextColor={theme.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!busy}
        />

        <Pressable onPress={() => router.push('/forgot-password')} hitSlop={8}>
          <Text style={[styles.link, { color: theme.accent }]}>Forgot password?</Text>
        </Pressable>

        {/* Latent email-confirmation seam: appears only once confirmation is enabled
            in the Supabase console (signUp then returns no session). With confirmation
            OFF — today's default — signUp logs the user straight in and the layout
            redirect leaves this screen, so this notice stays dormant. */}
        {lastSignUpNeedsConfirmation ? (
          <View style={[styles.notice, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.noticeText, { color: theme.text }]}>
              Check your inbox to confirm your email, then sign in.
            </Text>
            <Pressable onPress={handleResend} disabled={busy} hitSlop={8}>
              <Text style={[styles.link, { color: theme.accent }]}>Resend email</Text>
            </Pressable>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {busy ? (
          <ActivityIndicator color={theme.accent} style={{ marginTop: 8 }} />
        ) : (
          <>
            <Pressable
              style={[styles.btn, { backgroundColor: theme.accent }]}
              onPress={() => handleAction('signIn')}
            >
              <Text style={styles.btnText}>Sign in</Text>
            </Pressable>
            <Pressable
              style={[styles.btnOutline, { borderColor: theme.accent }]}
              onPress={() => handleAction('signUp')}
            >
              <Text style={[styles.btnOutlineText, { color: theme.accent }]}>Create account</Text>
            </Pressable>

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.dividerText, { color: theme.muted }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            <Pressable
              style={[styles.btnProvider, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => handleProvider('google')}
            >
              <Text style={[styles.btnProviderText, { color: theme.text }]}>Continue with Google</Text>
            </Pressable>
            {Platform.OS === 'ios' ? (
              <Pressable
                style={[styles.btnProvider, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => handleProvider('apple')}
              >
                <Text style={[styles.btnProviderText, { color: theme.text }]}>Continue with Apple</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, gap: 12 },
  title: { fontSize: 32, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 8 },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  error: { color: '#e53e3e', fontSize: 13, textAlign: 'center' },
  link: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  notice: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 8,
  },
  noticeText: { fontSize: 13, textAlign: 'center' },
  btn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  btnOutline: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: { fontWeight: '600', fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 13 },
  btnProvider: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnProviderText: { fontWeight: '600', fontSize: 16 },
});
