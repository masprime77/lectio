// The write-conflict resolution sheet. Shown whenever ConflictProvider holds an
// active conflict (raised by saveWithConflict). Mirrors TagPickerSheet: a
// transparent <Modal> that fades its backdrop while the sheet slides up; tapping
// the backdrop is treated as Cancel (the safe, non-destructive default).
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useConflict } from './ConflictProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ConflictDialog() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { conflict, close } = useConflict();
  const visible = !!conflict;

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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => close('cancel')}
    >
      <Pressable style={styles.backdrop} onPress={() => close('cancel')}>
        <AnimatedPressable
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 },
            { transform: [{ translateY }] },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: theme.text }]}>Changed on another device</Text>
          <Text style={[styles.body, { color: theme.muted }]}>
            This semester was updated somewhere else since you opened it. What would you like to
            do?
          </Text>

          <Pressable
            onPress={() => close('keep')}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: theme.accent },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.primaryText}>Keep my changes</Text>
            <Text style={styles.primarySubtitle}>saves a backup of the other version</Text>
          </Pressable>

          <Pressable
            onPress={() => close('discard')}
            style={({ pressed }) => [
              styles.action,
              styles.secondary,
              { borderColor: theme.border },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={[styles.secondaryText, { color: theme.text }]}>Use the latest</Text>
          </Pressable>

          <Pressable
            onPress={() => close('cancel')}
            style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.6 }]}
          >
            <Text style={[styles.cancelText, { color: theme.muted }]}>Cancel</Text>
          </Pressable>
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
    paddingTop: 20,
    paddingHorizontal: 16,
    gap: 10,
  },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 14, textAlign: 'center', marginBottom: 6, lineHeight: 20 },
  action: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  primarySubtitle: { color: 'rgba(255, 255, 255, 0.85)', fontSize: 12, marginTop: 2 },
  secondary: { borderWidth: StyleSheet.hairlineWidth },
  secondaryText: { fontWeight: '600', fontSize: 16 },
  cancel: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { fontSize: 15 },
});
