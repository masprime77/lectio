// Unified "+" add-sheet for the container objects. Modal screen at
// /add?context=semester|course|tags[&id=<semesterId>]. All three tabs are
// available from every screen; `context` only picks the initial tab and `id`
// preselects the semester of the screen the sheet was opened from. The Course
// and Tags tabs carry a semester picker (defaulting to that semester, else the
// first one); Tags embeds the tag editor directly. The "+" never adds
// individual readings/tasks — those stay on the per-section "+ Add" controls
// of the course-detail screen.
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { storage } from '../src/storage';
import { useTheme } from '../src/theme';
import { SheetHeader } from '../src/components/SheetHeader';
import { FormTabs } from '../src/components/FormTabs';
import { SemesterFields } from '../src/add/SemesterFields';
import { CourseFields } from '../src/add/CourseFields';
import { TagsFields } from '../src/add/TagsFields';
import type { SemesterSummary } from '../types/lectio-core';

const TABS = ['Semester', 'Course', 'Tags'];

function SemesterPicker({
  semesters,
  selected,
  onSelect,
}: {
  semesters: SemesterSummary[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  const theme = useTheme();
  return (
    <View>
      <Text style={[styles.label, { color: theme.muted }]}>Semester</Text>
      <View style={styles.pillRow}>
        {semesters.map((s) => {
          const isActive = s.id === selected;
          return (
            <Pressable
              key={s.id}
              onPress={() => onSelect(s.id)}
              style={[
                styles.pill,
                { backgroundColor: theme.surface, borderColor: theme.border },
                isActive && { backgroundColor: theme.accent, borderColor: theme.accent },
              ]}
            >
              <Text style={[styles.pillText, { color: isActive ? '#fff' : theme.text }]}>
                {s.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function AddScreen() {
  const theme = useTheme();
  const { context, id } = useLocalSearchParams<{ context?: string; id?: string }>();

  const [active, setActive] = useState(
    context === 'course' ? 'Course' : context === 'tags' ? 'Tags' : 'Semester'
  );
  const [semesters, setSemesters] = useState<SemesterSummary[] | null>(null);
  const [semesterId, setSemesterId] = useState<string | undefined>(id);

  useEffect(() => {
    let alive = true;
    storage
      .list()
      .then((list) => {
        if (!alive) return;
        setSemesters(list);
        // Default to the semester the sheet was opened from, else the first.
        setSemesterId((cur) => (cur && list.some((s) => s.id === cur) ? cur : list[0]?.id));
      })
      .catch((err) => console.warn('list failed', err));
    return () => {
      alive = false;
    };
  }, []);

  const needsSemester = active !== 'Semester';

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ presentation: 'modal', title: 'Add' }} />
      <SheetHeader title="Add" />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <FormTabs tabs={TABS} active={active} onSelect={setActive} />
        {!needsSemester ? (
          <SemesterFields mode="create" />
        ) : semesters === null ? (
          <ActivityIndicator color={theme.accent} style={{ marginTop: 24 }} />
        ) : semesters.length === 0 ? (
          <Text style={[styles.hint, { color: theme.muted }]}>
            Create a semester first — the {active === 'Course' ? 'course' : 'tags'} need one to
            live in.
          </Text>
        ) : (
          <>
            <SemesterPicker semesters={semesters} selected={semesterId} onSelect={setSemesterId} />
            {semesterId ? (
              active === 'Course' ? (
                <CourseFields mode="create" semesterId={semesterId} />
              ) : (
                // Keyed by semester so the editor reloads when the pick changes.
                <TagsFields key={semesterId} semesterId={semesterId} />
              )
            ) : null}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  pillText: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 13, marginTop: 12 },
});
