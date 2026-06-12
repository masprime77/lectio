// Create/edit a reading or task. Modal screen at /semester/item-form:
// `?id=<semesterId>&courseId=<courseId>&kind=reading|task` (required) plus
// `?itemId=<itemId>` => edit, none => create. Thin wrapper: params in,
// ItemFields body out. The query param picks the initial kind; in create mode
// the Reading | Task tabs can switch it (edit mode keeps the item's kind fixed).
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme';
import { FormTabs } from '../../src/components/FormTabs';
import { SheetHeader } from '../../src/components/SheetHeader';
import { ItemFields } from '../../src/add/ItemFields';

export default function ItemFormScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    id: string;
    courseId: string;
    kind?: string;
    itemId?: string;
  }>();
  const { id, courseId, itemId } = params;
  const [kind, setKind] = useState<'reading' | 'task'>(
    params.kind === 'task' ? 'task' : 'reading'
  );

  const noun = kind === 'task' ? 'Task' : 'Reading';

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SheetHeader title={itemId ? `Edit ${noun}` : `New ${noun}`} />
      {!itemId && (
        <FormTabs
          tabs={['Reading', 'Task']}
          active={noun}
          onSelect={(tab) => setKind(tab === 'Task' ? 'task' : 'reading')}
        />
      )}
      <ItemFields
        mode={itemId ? 'edit' : 'create'}
        semesterId={id}
        courseId={courseId}
        kind={kind}
        itemId={itemId}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingBottom: 24 },
});
