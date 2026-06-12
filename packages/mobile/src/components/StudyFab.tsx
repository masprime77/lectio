// Bottom-left floating Study Mode toggle, mirroring the bottom-right Fab.
// The graduation cap is drawn from plain Views (flat diamond board over a
// rounded base, with a hanging tassel) — no emoji, no icon library. Colorless
// (surface + border, muted cap) when off; accent-filled with a white cap when on.
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

export function StudyFab({ active, onPress }: { active: boolean; onPress: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const capColor = active ? '#fff' : theme.muted;
  return (
    <Pressable
      style={[
        styles.fab,
        { bottom: insets.bottom + 24 },
        active
          ? { backgroundColor: theme.accent }
          : {
              backgroundColor: theme.surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.border,
            },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Study Mode"
      accessibilityState={{ selected: active }}
    >
      <View style={styles.cap}>
        <View style={[styles.capBase, { backgroundColor: capColor }]} />
        <View style={[styles.capBoard, { backgroundColor: capColor }]} />
        <View style={[styles.capTassel, { backgroundColor: capColor }]} />
        <View style={[styles.capTasselEnd, { backgroundColor: capColor }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    left: 20,
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
  cap: { width: 34, height: 28 },
  capBase: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 14,
    height: 12,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  capBoard: {
    position: 'absolute',
    top: 1,
    left: 7,
    width: 20,
    height: 20,
    borderRadius: 3,
    transform: [{ scaleY: 0.5 }, { rotate: '45deg' }],
  },
  capTassel: { position: 'absolute', top: 11, left: 29, width: 2, height: 9 },
  capTasselEnd: {
    position: 'absolute',
    top: 19,
    left: 28,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
