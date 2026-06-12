// Create/edit a reading or task. Modal screen at /semester/item-form:
// `?id=<semesterId>&courseId=<courseId>&kind=reading|task` (required) plus
// `?itemId=<itemId>` => edit, none => create.
import { useEffect, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addItem, editItem, getCourses } from '@lectio/core/planner-core';
import { storage } from '../../src/storage';
import { useTheme } from '../../src/theme';
import { DateField } from '../../src/components/DateField';
import { FormTabs } from '../../src/components/FormTabs';
import { SheetHeader } from '../../src/components/SheetHeader';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  return !Number.isNaN(new Date(s + 'T00:00:00').getTime());
}

export default function ItemFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    courseId: string;
    kind?: string;
    itemId?: string;
  }>();
  const { id, courseId, itemId } = params;
  // The query param picks the initial kind; in create mode the Reading | Task
  // tabs can switch it (edit mode keeps the item's kind fixed).
  const [kind, setKind] = useState<'reading' | 'task'>(
    params.kind === 'task' ? 'task' : 'reading'
  );

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
        if (itemId) {
          const course = getCourses(semester).find((c) => c.id === courseId);
          const arr = kind === 'reading' ? course?.readings : course?.tasks;
          const item = arr?.find((it) => it.id === itemId);
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
  }, [id, courseId, itemId, kind]);

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
      if (itemId) {
        editItem(course, kind, itemId, {
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

  const noun = kind === 'task' ? 'Task' : 'Reading';

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SheetHeader title={itemId ? `Edit ${noun}` : `New ${noun}`} />
      <View style={styles.form}>
        {!itemId && (
          <FormTabs
            tabs={['Reading', 'Task']}
            active={noun}
            onSelect={(tab) => setKind(tab === 'Task' ? 'task' : 'reading')}
          />
        )}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingBottom: 24 },
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
