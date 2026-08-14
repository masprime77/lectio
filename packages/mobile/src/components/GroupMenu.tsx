// Bottom-sheet for picking how the course screen groups its items, mirroring
// the desktop header's By Week / By Type toggle with the same two labels. Same
// shape as SortMenu (RN <Modal>, fade backdrop, slide-up sheet, current option
// checked); tapping the dimmed backdrop dismisses without changes.
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import type { GroupMode } from './course-detail/useCourseDetail';

interface GroupMenuProps {
  visible: boolean;
  current: GroupMode;
  onPick: (mode: GroupMode) => void;
  onClose: () => void;
}

// Same wording as the desktop's #view-by-week / #view-by-type buttons.
const OPTIONS: { value: GroupMode; label: string; hint: string }[] = [
  { value: 'week', label: 'By Week', hint: 'One section per week, readings then tasks' },
  { value: 'type', label: 'By Type', hint: 'Readings and tasks, split into weeks' },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Header action that opens the GroupMenu, labelled with the current mode and
 *  styled like the text header actions (Edit, ↑↓) it sits beside. */
export function GroupButton({ mode, onPress }: { mode: GroupMode; onPress: () => void }) {
  const theme = useTheme();
  const label = mode === 'week' ? 'Week' : 'Type';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Grouping: ${mode === 'week' ? 'By Week' : 'By Type'}`}
      accessibilityHint="Opens the grouping options"
      hitSlop={8}
      style={({ pressed }) => pressed && { opacity: 0.6 }}
    >
      <Text style={[styles.groupBtnLabel, { color: theme.accent }]}>{label}</Text>
    </Pressable>
  );
}

export function GroupMenu({ visible, current, onPick, onClose }: GroupMenuProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      slide.setValue(0);
      Animated.timing(slide, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slide]);
  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [420, 0] });
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop backdrop presses from closing when tapping the sheet itself. */}
        <AnimatedPressable
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 },
            { transform: [{ translateY }] },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: theme.text }]}>Group items</Text>
          {OPTIONS.map(({ value, label, hint }) => {
            const active = value === current;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  onPick(value);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.option,
                  active && { backgroundColor: theme.surfaceAlt },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text
                  style={[
                    styles.optionName,
                    { color: active ? theme.accent : theme.text },
                    active && styles.optionNameActive,
                  ]}
                >
                  {label}
                  {'\n'}
                  <Text style={[styles.optionHint, { color: theme.muted }]}>{hint}</Text>
                </Text>
                {active && <Text style={[styles.check, { color: theme.accent }]}>✓</Text>}
              </Pressable>
            );
          })}
        </AnimatedPressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  title: { fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  optionName: { flex: 1, fontSize: 15 },
  optionNameActive: { fontWeight: '600' },
  optionHint: { fontSize: 12, fontWeight: '400' },
  check: { fontSize: 15, fontWeight: '600' },
  groupBtnLabel: { fontSize: 15, fontWeight: '600' },
});
