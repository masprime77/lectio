import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { friendlyAuthError, isConnectivityError } from '../src/auth/auth-errors';
import { useTheme } from '../src/theme';

const googleSignInLight = require('../assets/google-signin-light.png');
const googleSignInDark = require('../assets/google-signin-dark.png');

export default function SignInScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const router = useRouter();
  const {
    signIn,
    signUp,
    resendConfirmation,
    needsEmailConfirmation,
    signInWithGoogle,
    signInWithApple,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Confirmation of a resend — without it, tapping "Resend email" looks like
  // it did nothing.
  const [sentNotice, setSentNotice] = useState<string | null>(null);

  async function handleAction(action: 'signIn' | 'signUp') {
    setError(null);
    setSentNotice(null);
    setBusy(true);
    try {
      if (action === 'signIn') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
    } catch (e) {
      // A paused free-tier project or an offline device surfaces as a fetch error;
      // give it a clearer message than the generic one.
      setError(
        isConnectivityError(e)
          ? "Can't reach the server — it may be paused or you're offline. Try again in a moment."
          : friendlyAuthError(e)
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError(null);
    setSentNotice(null);
    const address = email.trim();
    if (!address) {
      setError('Enter your email address first.');
      return;
    }
    setBusy(true);
    try {
      await resendConfirmation(address);
      setSentNotice('Sent — check your inbox (and your spam folder).');
    } catch (e) {
      // Supabase rate-limits resends; friendlyAuthError turns that into
      // "Too many attempts. Please wait a minute and try again."
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

        {/* Shown once confirmation is enabled in the Supabase console: after a
            signUp that returned no session, or a signIn rejected because the
            account was never confirmed. With confirmation OFF, signUp logs the
            user straight in and the layout redirect leaves this screen, so this
            notice stays dormant. */}
        {needsEmailConfirmation ? (
          <View style={[styles.notice, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.noticeText, { color: theme.text }]}>
              {email.trim()
                ? `Check your inbox to confirm ${email.trim()}, then sign in.`
                : 'Check your inbox to confirm your email, then sign in.'}
            </Text>
            <Pressable onPress={handleResend} disabled={busy} hitSlop={8}>
              <Text style={[styles.link, { color: theme.accent }]}>Resend email</Text>
            </Pressable>
            {sentNotice ? (
              <Text style={[styles.noticeText, { color: theme.muted }]}>{sentNotice}</Text>
            ) : null}
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

            <Text style={[styles.legalNotice, { color: theme.muted }]}>
              By creating an account you agree to our{' '}
              <Text
                style={[styles.legalLink, { color: theme.accent }]}
                onPress={() => router.push('/settings/legal/datenschutz')}
              >
                Privacy Policy
              </Text>{' '}
              and{' '}
              <Text
                style={[styles.legalLink, { color: theme.accent }]}
                onPress={() => router.push('/settings/legal/impressum')}
              >
                Legal Notice
              </Text>
              .
            </Text>

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.dividerText, { color: theme.muted }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            <Pressable
              onPress={() => handleProvider('google')}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
              style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.8 }]}
            >
              <Image
                source={scheme === 'dark' ? googleSignInDark : googleSignInLight}
                style={styles.googleBtnImage}
                resizeMode="contain"
              />
            </Pressable>
            {Platform.OS === 'ios' ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={
                  scheme === 'dark'
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={10}
                style={styles.appleBtn}
                onPress={() => handleProvider('apple')}
              />
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
  legalNotice: { fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 4 },
  legalLink: { fontWeight: '600' },
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
  googleBtn: {
    height: 48,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnImage: {
    height: 44,
    width: '100%',
  },
  appleBtn: {
    height: 48,
    width: '100%',
  },
});
