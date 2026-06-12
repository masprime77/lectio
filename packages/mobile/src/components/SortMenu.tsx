// Bottom-sheet for picking the course sort order, mirroring the desktop's
// header sort dropdown: the same six core SORT_ORDERS values with the same
// human labels, current order highlighted. Uses RN's <Modal> (no extra
// dependency); tapping the dimmed backdrop dismisses without changes. Same
// fade-backdrop + slide-sheet animation as TagPickerSheet.
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import type { SortOrder } from '../../types/lectio-core';

interface SortMenuProps {
  visible: boolean;
  current: SortOrder;
  onPick: (order: SortOrder) => void;
  onClose: () => void;
}

// Same wording as the desktop's #sort-select options, in the same order.
const OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'progress-desc', label: 'Progress ↓' },
  { value: 'progress-asc', label: 'Progress ↑' },
  { value: 'alpha-asc', label: 'A → Z' },
  { value: 'alpha-desc', label: 'Z → A' },
  { value: 'week-asc', label: 'Week ↑' },
  { value: 'week-desc', label: 'Week ↓' },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Round ↑↓ header bubble that opens the SortMenu — same bordered bubble
 *  treatment as HeaderBubble, sized for the glyph alone. */
export function SortButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Sort"
      style={({ pressed }) => [
        styles.sortBtn,
        { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.sortBtnGlyph, { color: theme.text }]}>↑↓</Text>
    </Pressable>
  );
}

export function SortMenu({ visible, current, onPick, onClose }: SortMenuProps) {
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
          <Text style={[styles.title, { color: theme.text }]}>Sort courses</Text>
          {OPTIONS.map(({ value, label }) => {
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
  check: { fontSize: 15, fontWeight: '600' },
  sortBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortBtnGlyph: { fontSize: 14, fontWeight: '600' },
});
