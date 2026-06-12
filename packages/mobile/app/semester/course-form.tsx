// Create/edit a course. Modal screen at /semester/course-form:
// `?id=<semesterId>` (required) plus `?courseId=<courseId>` => edit, none => create.
// Thin wrapper: params in, CourseFields body out (tabs live in the add-sheet).
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme';
import { SheetHeader } from '../../src/components/SheetHeader';
import { CourseFields } from '../../src/add/CourseFields';

export default function CourseFormScreen() {
  const theme = useTheme();
  const { id, courseId } = useLocalSearchParams<{ id: string; courseId?: string }>();

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SheetHeader title={courseId ? 'Edit Course' : 'New Course'} />
      <CourseFields mode={courseId ? 'edit' : 'create'} semesterId={id} courseId={courseId} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingBottom: 24 },
});
