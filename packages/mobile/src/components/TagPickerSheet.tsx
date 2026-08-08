// Bottom-sheet for picking an item's tag directly, mirroring the desktop's
// tag dropdown: options grouped into Pending/Done sections with the current
// tag highlighted. Uses RN's <Modal> (no extra dependency); tapping the
// dimmed backdrop dismisses without changes. The modal fades so the backdrop
// dims in place; only the sheet itself slides up (Modal's "slide" animation
// would drag the backdrop up from the bottom along with it).
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import type { Tag, TagSection } from '../../types/lectio-core';

interface TagPickerSheetProps {
  visible: boolean;
  title: string;
  tags: Tag[];
  currentStatus: string;
  onPick: (tagId: string) => void;
  onClose: () => void;
}

const SECTIONS: { key: TagSection; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'done', label: 'Done' },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function TagPickerSheet({
  visible,
  title,
  tags,
  currentStatus,
  onPick,
  onClose,
}: TagPickerSheetProps) {
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
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          {SECTIONS.map(({ key, label }) => {
            const sectionTags = tags.filter((t) => t.section === key);
            if (sectionTags.length === 0) return null;
            return (
              <View key={key}>
                <Text style={[styles.sectionLabel, { color: theme.muted }]}>{label}</Text>
                {sectionTags.map((tag) => {
                  const active = tag.id === currentStatus;
                  return (
                    <Pressable
                      key={tag.id}
                      onPress={() => {
                        onPick(tag.id);
                        onClose();
                      }}
                      style={({ pressed }) => [
                        styles.option,
                        active && { backgroundColor: theme.surfaceAlt },
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <View style={[styles.dot, { backgroundColor: tag.color }]} />
                      <Text
                        style={[
                          styles.optionName,
                          { color: active ? theme.accent : theme.text },
                          active && styles.optionNameActive,
                        ]}
                      >
                        {tag.name}
                      </Text>
                      {active && (
                        <Text style={[styles.check, { color: theme.accent }]}>✓</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
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
  title: { fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  optionName: { flex: 1, fontSize: 15 },
  optionNameActive: { fontWeight: '600' },
  check: { fontSize: 15, fontWeight: '600' },
});
