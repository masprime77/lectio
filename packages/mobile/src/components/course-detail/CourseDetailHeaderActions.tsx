import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { ExportIcon } from '../ExportIcon';
import { GroupButton } from '../GroupMenu';
import { SortButton } from '../SortMenu';
import type { GroupMode } from './useCourseDetail';

export interface CourseDetailHeaderActionsProps {
  editing: boolean;
  selectedCount: number;
  hasItems: boolean;
  groupMode: GroupMode;
  onToggleEditing: () => void;
  onBatchDelete: () => void;
  onExport: () => void;
  onSortPress: () => void;
  onGroupPress: () => void;
}

export function CourseDetailHeaderActions({
  editing,
  selectedCount,
  hasItems,
  groupMode,
  onToggleEditing,
  onBatchDelete,
  onExport,
  onSortPress,
  onGroupPress,
}: CourseDetailHeaderActionsProps) {
  const theme = useTheme();
  return editing ? (
    <View style={styles.headerActions}>
      <Pressable onPress={onBatchDelete} disabled={selectedCount === 0}>
        <Text
          style={{
            color: selectedCount === 0 ? theme.muted : '#ef4444',
            fontSize: 15,
            fontWeight: '600',
          }}
        >
          Delete{selectedCount > 0 ? ` (${selectedCount})` : ''}
        </Text>
      </Pressable>
      <Pressable onPress={onToggleEditing}>
        <Text style={{ color: theme.accent, fontSize: 15 }}>Done</Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.headerActions}>
      <Pressable
        onPress={onExport}
        accessibilityRole="button"
        accessibilityLabel="Export course"
        hitSlop={8}
        style={({ pressed }) => pressed && { opacity: 0.6 }}
      >
        <ExportIcon color={theme.accent} />
      </Pressable>
      {hasItems && (
        <>
          <GroupButton mode={groupMode} onPress={onGroupPress} />
          <SortButton onPress={onSortPress} />
          <Pressable onPress={onToggleEditing}>
            <Text style={{ color: theme.accent, fontSize: 15 }}>Edit</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 4 },
});
