// Small sheet for correcting a course's studied time by hand — people forget
// to start the timer, run it by accident, or study away from the app entirely.
//
// This is a real <Modal> rather than Alert.prompt, which is iOS-only. Same
// fade-backdrop + slide-up shape as SortMenu, on RN's own Modal (no extra
// dependency). The saved value goes through core's setStudyTime, which records
// the signed difference as an 'adjustment' entry, so a hand-edited total stays
// distinguishable from time actually clocked.
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatHoursMinutes, parseHoursMinutesInput } from '@lectio/core/pomodoro-core';
import { useTheme } from '../theme';

interface StudyTimeEditorProps {
  visible: boolean;
  courseName: string;
  /** Current total, used to prefill the field. */
  currentSeconds: number;
  /** Called with the new total in whole seconds. */
  onSave: (seconds: number) => void;
  onClose: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// The same red the screens already use for destructive actions.
const ERROR_COLOR = '#ef4444';

export function StudyTimeEditor({
  visible,
  courseName,
  currentSeconds,
  onSave,
  onClose,
}: StudyTimeEditorProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const [text, setText] = useState(() => formatHoursMinutes(currentSeconds));
  const [error, setError] = useState<string | null>(null);

  // Re-seed on every open so the field always reflects the current total.
  useEffect(() => {
    if (!visible) return;
    setText(formatHoursMinutes(currentSeconds));
    setError(null);
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, currentSeconds, slide]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [360, 0] });

  function handleSave() {
    const seconds = parseHoursMinutesInput(text);
    if (seconds === null) {
      // Keep the sheet open and say why, rather than discarding what was typed.
      setError("Could not read that. Try “2h 15m”, “90m”, or a number of minutes.");
      return;
    }
    onSave(seconds);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.avoider} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <AnimatedPressable
            style={[
              styles.sheet,
              { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 },
              { transform: [{ translateY }] },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.title, { color: theme.text }]}>Studied time</Text>
            <Text style={[styles.course, { color: theme.muted }]} numberOfLines={1}>
              {courseName}
            </Text>

            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v);
                if (error) setError(null);
              }}
              autoFocus
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.surfaceAlt,
                  borderColor: error ? ERROR_COLOR : theme.border,
                },
              ]}
              accessibilityLabel="Studied time"
            />

            {error ? (
              <Text style={[styles.error, { color: ERROR_COLOR }]}>{error}</Text>
            ) : (
              <Text style={[styles.hint, { color: theme.muted }]}>
                e.g. &ldquo;2h 15m&rdquo;, &ldquo;90m&rdquo;, or a number of minutes
              </Text>
            )}

            <View style={styles.actions}>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.btn,
                  { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={[styles.btnText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.btn,
                  { backgroundColor: theme.accent },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[styles.btnText, { color: '#fff', fontWeight: '600' }]}>Save</Text>
              </Pressable>
            </View>
          </AnimatedPressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  avoider: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  title: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  course: { fontSize: 13, textAlign: 'center', marginTop: 2, marginBottom: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  hint: { fontSize: 12, marginTop: 6 },
  error: { fontSize: 12, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnText: { fontSize: 16 },
});
