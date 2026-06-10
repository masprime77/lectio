// Create/edit a course. Modal screen at /semester/course-form:
// `?id=<semesterId>` (required) plus `?courseId=<courseId>` => edit, none => create.
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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { addCourse, editCourseColor, editCourseName } from '@lectio/core/planner-core';
import { storage } from '../../src/storage';
import { useTheme } from '../../src/theme';

const COURSE_COLORS = ['#4a90d9', '#22c55e', '#ef4444', '#f97316',
                       '#a855f7', '#eab308', '#14b8a6', '#ec4899'];

export default function CourseFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id, courseId } = useLocalSearchParams<{ id: string; courseId?: string }>();

  const [name, setName] = useState('');
  const [color, setColor] = useState(COURSE_COLORS[0]);
  const [loaded, setLoaded] = useState(!courseId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The current color leads the palette when editing a course whose color is
  // not one of the fixed swatches, so editing never silently changes it.
  const palette = COURSE_COLORS.includes(color) ? COURSE_COLORS : [color, ...COURSE_COLORS];

  useEffect(() => {
    if (!courseId) return;
    let active = true;
    storage
      .get(id)
      .then((semester) => {
        if (!active) return;
        const course = semester.courses.find((c) => c.id === courseId);
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
  }, [id, courseId]);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }
    if (courseId && !loaded) {
      setError('Course is still loading. Try again in a moment.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      // Fresh load on submit, then clone-mutate-persist via core (same pattern
      // as cycleTag in the course detail screen).
      const sem = await storage.get(id);
      if (courseId) {
        editCourseName(sem, courseId, trimmedName);
        editCourseColor(sem, courseId, color);
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
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: courseId ? 'Edit Course' : 'New Course' }} />
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
