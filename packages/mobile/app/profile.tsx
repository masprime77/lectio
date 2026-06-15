// Account hub: the signed-in email, change email, change password, delete account,
// and sign out. Account deletion runs through a Supabase Edge Function (the anon key
// can't delete its own auth user).
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { friendlyAuthError } from '../src/auth/auth-errors';
import { useTheme } from '../src/theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const { session, signOut, updateEmail, updatePassword, deleteAccount } = useAuth();

  const currentEmail = session?.user?.email ?? 'Unknown account';

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Change email
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  // Change password
  const [pwOpen, setPwOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function handleChangeEmail() {
    setError(null);
    const next = newEmail.trim();
    if (!next) {
      setError('Please enter a new email.');
      return;
    }
    setBusy(true);
    try {
      await updateEmail(next);
      setEmailOpen(false);
      setNewEmail('');
      Alert.alert(
        'Confirm your new email',
        `Confirmation sent to ${next}; the change applies after you confirm it.`
      );
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleChangePassword() {
    setError(null);
    if (newPassword.length < 6) {
      setError('Password is too short (minimum 6 characters).');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await updatePassword(newPassword);
      setPwOpen(false);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password updated.');
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      'Delete account',
      'This permanently deletes your account and all your semesters. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setError(null);
            setBusy(true);
            try {
              // On success the session clears and the layout redirect returns to /sign-in.
              await deleteAccount();
            } catch (e) {
              setError(friendlyAuthError(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
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
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Profile' }} />

      {/* Email */}
      <Text style={[styles.sectionTitle, { color: theme.muted }]}>Email</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.muted }]}>Signed in as</Text>
        <Text style={[styles.email, { color: theme.text }]}>{currentEmail}</Text>
      </View>
      {emailOpen ? (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
            placeholder="New email"
            placeholderTextColor={theme.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={newEmail}
            onChangeText={setNewEmail}
            editable={!busy}
          />
          <View style={styles.rowActions}>
            <Pressable onPress={() => { setEmailOpen(false); setNewEmail(''); setError(null); }} hitSlop={8}>
              <Text style={[styles.link, { color: theme.muted }]}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleChangeEmail} disabled={busy} hitSlop={8}>
              <Text style={[styles.link, { color: theme.accent }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => { setEmailOpen(true); setError(null); }}
        >
          <Text style={[styles.rowText, { color: theme.text }]}>Change email</Text>
          <Text style={[styles.chevron, { color: theme.muted }]}>›</Text>
        </Pressable>
      )}

      {/* Password */}
      <Text style={[styles.sectionTitle, { color: theme.muted }]}>Password</Text>
      {pwOpen ? (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
            placeholder="New password"
            placeholderTextColor={theme.muted}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            editable={!busy}
          />
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
            placeholder="Confirm new password"
            placeholderTextColor={theme.muted}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            editable={!busy}
          />
          <View style={styles.rowActions}>
            <Pressable onPress={() => { setPwOpen(false); setNewPassword(''); setConfirmPassword(''); setError(null); }} hitSlop={8}>
              <Text style={[styles.link, { color: theme.muted }]}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleChangePassword} disabled={busy} hitSlop={8}>
              <Text style={[styles.link, { color: theme.accent }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => { setPwOpen(true); setError(null); }}
        >
          <Text style={[styles.rowText, { color: theme.text }]}>Change password</Text>
          <Text style={[styles.chevron, { color: theme.muted }]}>›</Text>
        </Pressable>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy ? <ActivityIndicator color={theme.accent} style={{ marginTop: 4 }} /> : null}

      {/* Danger zone */}
      <Text style={[styles.sectionTitle, { color: theme.muted }]}>Danger zone</Text>
      <Pressable style={[styles.dangerBtn]} onPress={handleDelete} disabled={busy}>
        <Text style={styles.dangerText}>Delete account</Text>
      </Pressable>

      <Pressable style={[styles.signOutBtn]} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
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
    gap: 10,
  },
  label: { fontSize: 13 },
  email: { fontSize: 16, fontWeight: '600' },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  rowActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
  link: { fontSize: 15, fontWeight: '600' },
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
  error: { color: '#e53e3e', fontSize: 13, textAlign: 'center' },
  dangerBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerText: { color: '#fff', fontWeight: '600', fontSize: 16 },
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
