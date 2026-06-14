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
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { storage } from '../src/storage';
import { useTheme } from '../src/theme';
import { SheetHeader } from '../src/components/SheetHeader';
import { FormTabs } from '../src/components/FormTabs';
import { SemesterFields } from '../src/add/SemesterFields';
import { CourseFields } from '../src/add/CourseFields';
import { TagsFields } from '../src/add/TagsFields';
import * as transfer from '../src/lib/transfer';
import type { Semester, SemesterSummary } from '../types/lectio-core';

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

// A low-key "or import from a file" action shown at the end of the Semester and
// Course tabs (the "+" sheet is where all importing lives).
function ImportRow({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.importBtn, { borderColor: theme.border }]}>
      <Text style={[styles.importBtnText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

export default function AddScreen() {
  const theme = useTheme();
  const router = useRouter();
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

  // Save a picked semester (Keep/Reset progress; never overwrites — a colliding
  // id imports as a new id) then dismiss the sheet; the list refreshes on focus.
  function finishImportSemester(sem: Semester, keepStatus: boolean) {
    transfer
      .saveImportedSemester(sem, keepStatus)
      .then(() => router.back())
      .catch((err) => Alert.alert('Import failed', err instanceof Error ? err.message : String(err)));
  }

  function handleImportSemester() {
    transfer
      .pickSemesterFile()
      .then((sem) => {
        if (!sem) return; // cancelled
        const n = sem.courses.length;
        Alert.alert(
          'Import semester',
          `Import "${sem.name}" (${n} ${n === 1 ? 'course' : 'courses'})?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reset progress', onPress: () => finishImportSemester(sem, false) },
            { text: 'Keep progress', onPress: () => finishImportSemester(sem, true) },
          ]
        );
      })
      .catch((err) => Alert.alert('Import failed', err instanceof Error ? err.message : String(err)));
  }

  // Pick a course file and add it to the selected semester with fresh ids
  // (never collides), then dismiss the sheet.
  function handleImportCourse(targetId: string) {
    transfer
      .pickCourseFile()
      .then(async (course) => {
        if (!course) return; // cancelled
        await transfer.saveImportedCourse(targetId, course);
        router.back();
      })
      .catch((err) => Alert.alert('Import failed', err instanceof Error ? err.message : String(err)));
  }

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
          <>
            <SemesterFields mode="create" />
            <ImportRow label="Import a semester from a file" onPress={handleImportSemester} />
          </>
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
                <>
                  <CourseFields mode="create" semesterId={semesterId} />
                  <ImportRow
                    label="Import a course from a file"
                    onPress={() => handleImportCourse(semesterId)}
                  />
                </>
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
  importBtn: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  importBtnText: { fontSize: 16, fontWeight: '600' },
});
