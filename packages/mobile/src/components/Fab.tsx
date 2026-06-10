// Permanent bottom-right floating "+" action button, shared by the list
// screens. Stays fixed while the content scrolls (position: absolute), so the
// hosting screen's list needs enough bottom padding for the last row to clear it.
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

export function Fab({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      style={[styles.fab, { backgroundColor: theme.accent, bottom: insets.bottom + 24 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add"
    >
      <Text style={styles.plus}>+</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  plus: { color: '#fff', fontSize: 32, fontWeight: '600', lineHeight: 36 },
});
