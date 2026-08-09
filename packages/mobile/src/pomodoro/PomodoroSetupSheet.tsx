// Bottom sheet for starting a study timer: pick the course (or free study) and
// the four durations. Same fade-backdrop + slide-sheet shape as SortMenu, using
// RN's <Modal> so no extra dependency is needed; tapping the dimmed backdrop
// dismisses without starting anything.
//
// The four duration fields keep their raw text in local state and are only
// converted on Start — clamping while the user is mid-typing makes the field
// impossible to edit (you could never clear it to type a new number).
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clampPomodoroSettings } from '@lectio/core/pomodoro-core';
import { getCourses } from '@lectio/core/planner-core';
import { NumericKeyboardDoneBar, NUMERIC_KEYBOARD_ACCESSORY_ID } from '../components/NumericKeyboardDoneBar';
import { useTheme } from '../theme';
import type { PomodoroSettings, Semester } from '../../types/lectio-core';

interface PomodoroSetupSheetProps {
  visible: boolean;
  semester: Semester | null;
  /** Preselected course; null = free study. */
  initialCourseId?: string | null;
  initialSettings: PomodoroSettings;
  onStart: (opts: { settings: PomodoroSettings; courseId: string | null }) => void;
  onClose: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PomodoroSetupSheet({
  visible,
  semester,
  initialCourseId = null,
  initialSettings,
  onStart,
  onClose,
}: PomodoroSetupSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;

  const [courseId, setCourseId] = useState<string | null>(initialCourseId);
  const [work, setWork] = useState(String(initialSettings.workMinutes));
  const [short, setShort] = useState(String(initialSettings.shortBreakMinutes));
  const [long, setLong] = useState(String(initialSettings.longBreakMinutes));
  const [count, setCount] = useState(String(initialSettings.pomodorosUntilLongBreak));

  // Re-seed every time the sheet opens, so it always reflects the current
  // settings and the screen's course rather than the last session's edits.
  useEffect(() => {
    if (!visible) return;
    setCourseId(initialCourseId);
    setWork(String(initialSettings.workMinutes));
    setShort(String(initialSettings.shortBreakMinutes));
    setLong(String(initialSettings.longBreakMinutes));
    setCount(String(initialSettings.pomodorosUntilLongBreak));
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, initialCourseId, initialSettings, slide]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [520, 0] });
  const courses = semester ? getCourses(semester) : [];

  function handleStart() {
    // clampPomodoroSettings coerces and bounds the raw strings itself.
    const settings = clampPomodoroSettings({
      workMinutes: work as unknown as number,
      shortBreakMinutes: short as unknown as number,
      longBreakMinutes: long as unknown as number,
      pomodorosUntilLongBreak: count as unknown as number,
    });
    onStart({ settings, courseId });
  }

  const field = (label: string, value: string, onChange: (v: string) => void) => (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        inputAccessoryViewID={NUMERIC_KEYBOARD_ACCESSORY_ID}
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceAlt },
        ]}
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <AnimatedPressable
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 },
            { transform: [{ translateY }] },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: theme.text }]}>Study timer</Text>

          <ScrollView style={styles.courseList} keyboardShouldPersistTaps="handled">
            <CourseRow
              label="Free study (no course)"
              selected={courseId === null}
              onPress={() => setCourseId(null)}
            />
            {courses.map((c) => (
              <CourseRow
                key={c.id}
                label={c.name}
                color={c.color}
                selected={courseId === c.id}
                onPress={() => setCourseId(c.id)}
              />
            ))}
          </ScrollView>

          <View style={styles.grid}>
            {field('Focus (min)', work, setWork)}
            {field('Short break (min)', short, setShort)}
            {field('Long break (min)', long, setLong)}
            {field('Focus blocks before long break', count, setCount)}
          </View>

          <Text style={[styles.hint, { color: theme.muted }]}>
            Time is added to the chosen course when a focus block finishes. Free study is not
            tracked.
          </Text>

          <Pressable
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel="Start study timer"
            style={({ pressed }) => [
              styles.startBtn,
              { backgroundColor: theme.accent },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.startBtnText}>Start</Text>
          </Pressable>
        </AnimatedPressable>
      </Pressable>
      <NumericKeyboardDoneBar />
    </Modal>
  );
}

/** One selectable course row, reusing the app's filled-circle selection mark. */
function CourseRow({
  label,
  color,
  selected,
  onPress,
}: {
  label: string;
  color?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.courseRow,
        selected && { backgroundColor: theme.surfaceAlt },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View
        style={[
          styles.selectCircle,
          { borderColor: theme.border },
          selected && { backgroundColor: theme.accent, borderColor: theme.accent },
        ]}
      />
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text
        style={[styles.courseName, { color: selected ? theme.accent : theme.text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  title: { fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  courseList: { maxHeight: 180 },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  selectCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  courseName: { flex: 1, fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  field: { width: '50%', paddingRight: 8, marginBottom: 10 },
  fieldLabel: { fontSize: 12, marginBottom: 4 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
  },
  hint: { fontSize: 12, marginBottom: 12 },
  startBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
