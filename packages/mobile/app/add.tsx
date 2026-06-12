// Unified "+" add-sheet for the container objects. Modal screen at
// /add?context=semester|course|item:
//   'semester' → Semester tab (semesters list FAB)
//   'course'   → Course tab (courses screen FAB; needs ?id=<semesterId>)
//   'item'     → forwards straight to the tag manager (course-detail FAB) —
//                the "+" never adds individual readings/tasks; those stay on
//                the per-section "+ Add" controls of the course-detail screen.
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { SheetHeader } from '../src/components/SheetHeader';
import { FormTabs } from '../src/components/FormTabs';
import { SemesterFields } from '../src/add/SemesterFields';
import { CourseFields } from '../src/add/CourseFields';

export default function AddScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { context, id } = useLocalSearchParams<{ context?: string; id?: string }>();

  const tabs = context === 'course' ? ['Course'] : ['Semester'];
  const [active, setActive] = useState(tabs[0]);

  // The Tags tab is a navigation tab: it opens the existing tag manager rather
  // than embedding a form. Replace (not push) so finishing in the manager
  // returns to course-detail, not to a lingering empty Add sheet.
  useEffect(() => {
    if (context === 'item') router.replace(`/semester/tags?id=${id}`);
  }, [context, id, router]);

  if (context === 'item') return null;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ presentation: 'modal', title: 'Add' }} />
      <SheetHeader title="Add" />
      <FormTabs tabs={tabs} active={active} onSelect={setActive} />
      {active === 'Course' ? (
        <CourseFields mode="create" semesterId={id!} />
      ) : (
        <SemesterFields mode="create" />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingBottom: 24 },
});
