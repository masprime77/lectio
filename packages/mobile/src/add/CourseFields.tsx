// Create/edit body for a course: name field + fixed color swatch palette plus
// the save path. Rendered by the course-form edit route and by the unified
// add-sheet; the host renders SheetHeader (and any tabs) around it.
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
import { addCourse, editCourseColor, editCourseName } from '@lectio/core/planner-core';
import { storage } from '../storage';
import { useTheme } from '../theme';

const COURSE_COLORS = ['#4a90d9', '#22c55e', '#ef4444', '#f97316',
                       '#a855f7', '#eab308', '#14b8a6', '#ec4899'];

export function CourseFields({
  mode,
  semesterId,
  courseId,
}: {
  mode: 'create' | 'edit';
  semesterId: string;
  courseId?: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  const id = semesterId;
  const editCourseId = mode === 'edit' ? courseId : undefined;

  const [name, setName] = useState('');
  const [color, setColor] = useState(COURSE_COLORS[0]);
  const [loaded, setLoaded] = useState(!editCourseId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The current color leads the palette when editing a course whose color is
  // not one of the fixed swatches, so editing never silently changes it.
  const palette = COURSE_COLORS.includes(color) ? COURSE_COLORS : [color, ...COURSE_COLORS];

  useEffect(() => {
    if (!editCourseId) return;
    let active = true;
    storage
      .get(id)
      .then((semester) => {
        if (!active) return;
        const course = semester.courses.find((c) => c.id === editCourseId);
        if (!course) {
          setError('Course not found.');
          return;
        }
        setName(course.name);
        if (course.color) setColor(course.color);
        setLoaded(true);
      })
      .catch((err) => {
        if (active) setError(err?.message ?? 'Could not load course.');
      });
    return () => {
      active = false;
    };
  }, [id, editCourseId]);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }
    if (editCourseId && !loaded) {
      setError('Course is still loading. Try again in a moment.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      // Fresh load on submit, then clone-mutate-persist via core (same pattern
      // as cycleTag in the course detail screen).
      const sem = await storage.get(id);
      if (editCourseId) {
        editCourseName(sem, editCourseId, trimmedName);
        editCourseColor(sem, editCourseId, color);
      } else {
        addCourse(sem, { name: trimmedName, color });
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
      <Text style={[styles.label, { color: theme.muted }]}>Name</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
        placeholder="e.g. Algorithms"
        placeholderTextColor={theme.muted}
        value={name}
        onChangeText={setName}
        editable={!busy}
      />

      <Text style={[styles.label, { color: theme.muted }]}>Color</Text>
      <View style={styles.swatchRow}>
        {palette.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            style={[
              styles.swatch,
              { backgroundColor: c },
              c === color && { borderWidth: 2, borderColor: theme.text },
            ]}
          />
        ))}
      </View>

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
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  swatch: { width: 32, height: 32, borderRadius: 16 },
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
