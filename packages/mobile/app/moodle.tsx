// Moodle accounts screen, reachable from Settings. Lists every connected
// account (one per Moodle base URL — see moodle-token-store.ts) with its own
// Disconnect action, and an inline "+ Add account" form that runs the SSO
// capture, verifies the token, and stores it. No course import here — that's
// /moodle-import (Phase 16 Part B).
import { useCallback, useState } from 'react';
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
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { createMoodleClient } from '@lectio/core/integrations/moodle-client';
import {
  listMoodleAccounts,
  addMoodleAccount,
  removeMoodleAccount,
  type MoodleAccountSummary,
} from '../src/auth/moodle-token-store';
import { captureMoodleToken } from '../src/auth/moodle-sso';
import { useTheme } from '../src/theme';

export default function MoodleScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [accounts, setAccounts] = useState<MoodleAccountSummary[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    listMoodleAccounts()
      .then(setAccounts)
      .catch((e) => setError(e?.message ?? 'Could not load accounts.'));
  }, []);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  async function handleAdd() {
    setError(null);
    const cleanUrl = baseUrlInput.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(cleanUrl)) {
      setError('Enter a full URL, starting with https://');
      return;
    }
    setBusy(true);
    try {
      const captured = await captureMoodleToken(cleanUrl);

      // Verify the token AND get a display label before storing anything —
      // an unverified token is not stored at all.
      let label: string | undefined;
      try {
        const client = createMoodleClient({ baseUrl: cleanUrl, token: captured.wstoken });
        const info = await client.getSiteInfo();
        label = info.fullname || info.username || undefined;
      } catch (e: any) {
        setError(`Could not verify the connection: ${e?.message ?? 'unknown error'}`);
        setBusy(false);
        return;
      }

      await addMoodleAccount({ baseUrl: cleanUrl, wstoken: captured.wstoken, label });
      setAddOpen(false);
      setBaseUrlInput('');
      reload();
    } catch (e: any) {
      setError(e?.message ?? 'Moodle sign-in was cancelled.');
    } finally {
      setBusy(false);
    }
  }

  function handleRemove(account: MoodleAccountSummary) {
    Alert.alert(
      'Disconnect Moodle',
      `Disconnect ${account.label ?? account.baseUrl}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            removeMoodleAccount(account.baseUrl)
              .then(reload)
              .catch((e) => setError(e?.message ?? 'Could not disconnect.'));
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Moodle' }} />

      <Text style={[styles.sectionTitle, { color: theme.muted }]}>Accounts</Text>

      {accounts === null ? (
        <ActivityIndicator color={theme.accent} />
      ) : accounts.length === 0 ? (
        <Text style={{ color: theme.muted, fontSize: 14 }}>No accounts connected.</Text>
      ) : (
        accounts.map((a) => (
          <View
            key={a.baseUrl}
            style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={styles.rowTextWrap}>
              <Text style={[styles.rowText, { color: theme.text }]} numberOfLines={1}>
                {a.label ?? a.baseUrl}
              </Text>
              {a.label ? (
                <Text style={[styles.rowSubtitle, { color: theme.muted }]} numberOfLines={1}>
                  {a.baseUrl}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={() => handleRemove(a)} hitSlop={8}>
              <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>Disconnect</Text>
            </Pressable>
          </View>
        ))
      )}

      {addOpen ? (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
            placeholder="https://moodle.informatik.tu-darmstadt.de"
            placeholderTextColor={theme.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={baseUrlInput}
            onChangeText={setBaseUrlInput}
            editable={!busy}
          />
          <View style={styles.rowActions}>
            <Pressable
              onPress={() => { setAddOpen(false); setBaseUrlInput(''); setError(null); }}
              hitSlop={8}
              disabled={busy}
            >
              <Text style={[styles.link, { color: theme.muted }]}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleAdd} disabled={busy} hitSlop={8}>
              <Text style={[styles.link, { color: theme.accent }]}>Connect</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => { setAddOpen(true); setError(null); }}
        >
          <Text style={[styles.rowText, { color: theme.text }]}>+ Add account</Text>
        </Pressable>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy ? <ActivityIndicator color={theme.accent} style={{ marginTop: 4 }} /> : null}

      {accounts && accounts.length > 0 ? (
        <Pressable
          style={[styles.importBtn, { backgroundColor: theme.accent }]}
          onPress={() => router.push('/moodle-import')}
        >
          <Text style={styles.importBtnText}>Import courses…</Text>
        </Pressable>
      ) : null}
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
  card: { padding: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  rowActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
  link: { fontSize: 15, fontWeight: '600' },
  error: { color: '#e53e3e', fontSize: 13, textAlign: 'center' },
  importBtn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  importBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
