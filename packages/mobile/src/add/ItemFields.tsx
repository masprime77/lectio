// Create/edit body for a reading or task: title + week + (task-only) due date
// plus the save path. `kind` comes from props — the host owns any Reading|Task
// switch (item-form renders FormTabs in create mode; edit keeps it fixed).
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { addItem, editItem, getCourses } from '@lectio/core/planner-core';
import { storage } from '../storage';
import { useTheme } from '../theme';
import { DateField } from '../components/DateField';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  return !Number.isNaN(new Date(s + 'T00:00:00').getTime());
}

export function ItemFields({
  mode,
  semesterId,
  courseId,
  kind,
  itemId,
}: {
  mode: 'create' | 'edit';
  semesterId: string;
  courseId: string;
  kind: 'reading' | 'task';
  itemId?: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  const id = semesterId;
  const editItemId = mode === 'edit' ? itemId : undefined;

  const [title, setTitle] = useState('');
  const [week, setWeek] = useState('1');
  const [dueDate, setDueDate] = useState('');
  const [maxWeeks, setMaxWeeks] = useState(52);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    storage
      .get(id)
      .then((semester) => {
        if (!active) return;
        setMaxWeeks(semester.weeks || 52);
        if (editItemId) {
          const course = getCourses(semester).find((c) => c.id === courseId);
          const arr = kind === 'reading' ? course?.readings : course?.tasks;
          const item = arr?.find((it) => it.id === editItemId);
          if (!item) {
            setError('Item not found.');
            return;
          }
          setTitle(item.title ?? '');
          setWeek(String(item.week ?? 1));
          if (kind === 'task') {
            setDueDate(typeof item.dueDate === 'string' ? item.dueDate : '');
          }
        }
        setLoaded(true);
      })
      .catch((err) => {
        if (active) setError(err?.message ?? 'Could not load.');
      });
    return () => {
      active = false;
    };
  }, [id, courseId, editItemId, kind]);

  async function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Title is required.');
      return;
    }
    const trimmedDue = dueDate.trim();
    if (kind === 'task' && trimmedDue && !isValidDate(trimmedDue)) {
      setError('Due date must be a valid YYYY-MM-DD date (or empty).');
      return;
    }
    if (!loaded) {
      setError('Still loading. Try again in a moment.');
      return;
    }
    const parsedWeek = Math.min(maxWeeks, Math.max(1, parseInt(week, 10) || 1));

    setError(null);
    setBusy(true);
    try {
      // Fresh load on submit, then clone-mutate-persist via core (same pattern
      // as cycleTag in the course detail screen).
      const sem = await storage.get(id);
      const course = getCourses(sem).find((c) => c.id === courseId);
      if (!course) throw new Error('Course not found');
      if (editItemId) {
        editItem(course, kind, editItemId, {
          title: trimmedTitle,
          week: parsedWeek,
          ...(kind === 'task' ? { dueDate: trimmedDue } : {}),
        });
      } else {
        addItem(course, kind, {
          title: trimmedTitle,
          week: parsedWeek,
          ...(kind === 'task' ? { dueDate: trimmedDue } : {}),
        });
      }
      await storage.save(id, sem);
      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={[styles.label, { color: theme.muted }]}>Title</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
        placeholder={kind === 'task' ? 'e.g. Problem Set 1' : 'e.g. Chapter 3'}
        placeholderTextColor={theme.muted}
        value={title}
        onChangeText={setTitle}
        editable={!busy}
      />

      <Text style={[styles.label, { color: theme.muted }]}>Week (1–{maxWeeks})</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
        placeholder="1"
        placeholderTextColor={theme.muted}
        keyboardType="number-pad"
        value={week}
        onChangeText={setWeek}
        editable={!busy}
      />

      {kind === 'task' && (
        <>
          <Text style={[styles.label, { color: theme.muted }]}>Due date</Text>
          <DateField value={dueDate} onChange={setDueDate} placeholder="No due date" allowClear disabled={busy} />
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {busy ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 8 }} />
      ) : (
        <Pressable style={[styles.btn, { backgroundColor: theme.accent }]} onPress={handleSave}>
          <Text style={styles.btnText}>Save</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
