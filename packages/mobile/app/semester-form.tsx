// Create/edit a semester. Modal screen: `?id=<semesterId>` => edit, none => create.
// Thin wrapper: params in, SemesterFields body out (tabs live in the add-sheet).
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/theme';
import { SheetHeader } from '../src/components/SheetHeader';
import { SemesterFields } from '../src/add/SemesterFields';

export default function SemesterFormScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SheetHeader title={id ? 'Edit Semester' : 'New Semester'} />
      <SemesterFields mode={id ? 'edit' : 'create'} semesterId={id} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingBottom: 24 },
});
