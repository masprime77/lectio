// Create/edit a semester. Modal screen: `?id=<semesterId>` => edit, none => create.
import { useEffect, useRef, useState } from 'react';
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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { DEFAULT_READING_TAGS, DEFAULT_TASK_TAGS } from '@lectio/core/planner-core';
import { storage } from '../src/storage';
import { uniqueSemesterId } from '../src/lib/semester-id';
import { useTheme } from '../src/theme';
import type { Semester } from '../types/lectio-core';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  return !Number.isNaN(new Date(s + 'T00:00:00').getTime());
}

export default function SemesterFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [weeks, setWeeks] = useState('15');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef<Semester | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    storage
      .get(id)
      .then((semester) => {
        if (!active) return;
        loadedRef.current = semester;
        setName(semester.name);
        setStartDate(semester.startDate ?? '');
        setWeeks(String(semester.weeks ?? 15));
      })
      .catch((err) => {
        if (active) setError(err?.message ?? 'Could not load semester.');
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }
    const date = startDate.trim();
    if (!isValidDate(date)) {
      setError('Start date must be a valid YYYY-MM-DD date.');
      return;
    }
    const parsedWeeks = Math.min(52, Math.max(1, parseInt(weeks, 10) || 15));
    if (id && !loadedRef.current) {
      setError('Semester is still loading. Try again in a moment.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      if (id && loadedRef.current) {
        // Edit: keep the id (no re-slug on rename, same as desktop) and
        // preserve everything but name/startDate/weeks.
        const updated: Semester = {
          ...loadedRef.current,
          name: trimmedName,
          startDate: date,
          weeks: parsedWeeks,
        };
        await storage.save(id, updated);
      } else {
        const existing = await storage.list();
        const newId = uniqueSemesterId(trimmedName, new Set(existing.map((s) => s.id)));
        const semester: Semester = {
          id: newId,
          name: trimmedName,
          startDate: date,
          weeks: parsedWeeks,
          courses: [],
          readingTags: DEFAULT_READING_TAGS.map((t) => ({ ...t })),
          taskTags: DEFAULT_TASK_TAGS.map((t) => ({ ...t })),
        };
        await storage.save(newId, semester);
      }
      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: id ? 'Edit Semester' : 'New Semester' }} />
      <View style={styles.form}>
        <Text style={[styles.label, { color: theme.muted }]}>Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="e.g. Winter Semester 2026"
          placeholderTextColor={theme.muted}
          value={name}
          onChangeText={setName}
          editable={!busy}
        />

        <Text style={[styles.label, { color: theme.muted }]}>Start date (Monday of week 1)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
          value={startDate}
          onChangeText={setStartDate}
          editable={!busy}
        />

        <Text style={[styles.label, { color: theme.muted }]}>Weeks</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="15"
          placeholderTextColor={theme.muted}
          keyboardType="number-pad"
          value={weeks}
          onChangeText={setWeeks}
          editable={!busy}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {busy ? (
          <ActivityIndicator color={theme.accent} style={{ marginTop: 8 }} />
        ) : (
          <Pressable style={[styles.btn, { backgroundColor: theme.accent }]} onPress={handleSave}>
            <Text style={styles.btnText}>Save</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24 },
  form: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  error: { color: '#ef4444', fontSize: 13, textAlign: 'center', marginTop: 4 },
  btn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
