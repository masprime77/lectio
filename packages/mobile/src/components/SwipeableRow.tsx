// Swipe-action wrapper shared by the list rows: swiping left reveals a red
// Delete action, swiping right (when onEdit is given) a blue Edit action.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SharedValue } from 'react-native-reanimated';

interface Props {
  children: ReactNode;
  /** Set false to lock swiping (e.g. while batch-edit mode is active). */
  enabled?: boolean;
  /** Revealed by swiping right. */
  onEdit?: () => void;
  /** Revealed by swiping left. */
  onDelete?: () => void;
  /** Background for the Edit action (the theme accent). */
  editColor?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function SwipeableRow({
  children,
  enabled = true,
  onEdit,
  onDelete,
  editColor = '#4a90d9',
  containerStyle,
}: Props) {
  const renderRightActions = onDelete
    ? (_progress: SharedValue<number>, _translation: SharedValue<number>, methods: SwipeableMethods) => (
        <Pressable
          style={[styles.action, styles.deleteAction]}
          onPress={() => {
            methods.close();
            onDelete();
          }}
        >
          <Text style={styles.actionText}>Delete</Text>
        </Pressable>
      )
    : undefined;

  const renderLeftActions = onEdit
    ? (_progress: SharedValue<number>, _translation: SharedValue<number>, methods: SwipeableMethods) => (
        <Pressable
          style={[styles.action, { backgroundColor: editColor }]}
          onPress={() => {
            methods.close();
            onEdit();
          }}
        >
          <Text style={styles.actionText}>Edit</Text>
        </Pressable>
      )
    : undefined;

  return (
    <ReanimatedSwipeable
      enabled={enabled}
      friction={2}
      leftThreshold={32}
      rightThreshold={32}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      containerStyle={containerStyle}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: 84,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAction: { backgroundColor: '#ef4444' },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
