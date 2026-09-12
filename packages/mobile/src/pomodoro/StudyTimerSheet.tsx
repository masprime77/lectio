// Bottom sheet for putting time on a course (or on Free study, which is its own
// category on the semester rather than another entry in the course list). Three
// ways to do it, one tab each:
//
//   Pomodoro   the cycle timer — knows what it credits before it starts
//   Stopwatch  counts up, no phases; assigned only when it is stopped
//   Log        no clock at all — an amount and the day it was studied
//
// Same fade-backdrop + slide-sheet shape as SortMenu, using RN's <Modal> so no
// extra dependency is needed; tapping the dimmed backdrop dismisses without
// starting or saving anything. Continuing this package's convention, every
// glyph here is drawn from plain Views — never an emoji or an icon font.
//
// The four duration fields keep their raw text in local state and are only
// converted on Start — clamping while the user is mid-typing makes the field
// impossible to edit (you could never clear it to type a new number).
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FREE_STUDY_COLOR,
  FREE_STUDY_NAME,
  clampPomodoroSettings,
  formatClock,
  localDateKey,
  parseHoursMinutesInput,
} from '@lectio/core/pomodoro-core';
import { getCourses } from '@lectio/core/planner-core';
import { DateField } from '../components/DateField';
import {
  NumericKeyboardDoneBar,
  NUMERIC_KEYBOARD_ACCESSORY_ID,
} from '../components/NumericKeyboardDoneBar';
import { useTheme } from '../theme';

// The app has no danger token in its theme; destructive text is spelled out
// literally everywhere else too (see SwipeableRow, profile.tsx).
const DANGER = '#ef4444';
import { usePomodoro } from './PomodoroProvider';
import type { PomodoroSettings, Semester } from '../../types/lectio-core';

type TimerTab = 'pomodoro' | 'stopwatch' | 'log';

const TABS: { id: TimerTab; label: string }[] = [
  { id: 'pomodoro', label: 'Pomodoro' },
  { id: 'stopwatch', label: 'Stopwatch' },
  { id: 'log', label: 'Log' },
];

interface StudyTimerSheetProps {
  visible: boolean;
  semester: Semester | null;
  /** Preselected course; null means "no particular course", not free study. */
  initialCourseId?: string | null;
  initialSettings: PomodoroSettings;
  onStart: (opts: { settings: PomodoroSettings; courseId: string | null }) => void;
  onClose: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function StudyTimerSheet({
  visible,
  semester,
  initialCourseId = null,
  initialSettings,
  onStart,
  onClose,
}: StudyTimerSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const {
    session,
    stopwatch,
    stopwatchElapsed,
    stopwatchRunning,
    stopwatchPaused,
    startWatch,
    pauseWatch,
    saveWatch,
    discardWatch,
    logStudyTime,
  } = usePomodoro();

  const [tab, setTab] = useState<TimerTab>('pomodoro');

  // 'course' | 'free'. Free study hides the course list entirely: it is a
  // different thing to track, not a course with no name.
  const [mode, setMode] = useState<'course' | 'free'>('course');
  const [courseId, setCourseId] = useState<string | null>(initialCourseId);
  const [work, setWork] = useState(String(initialSettings.workMinutes));
  const [short, setShort] = useState(String(initialSettings.shortBreakMinutes));
  const [long, setLong] = useState(String(initialSettings.longBreakMinutes));
  const [count, setCount] = useState(String(initialSettings.pomodorosUntilLongBreak));

  // Where a stopped stopwatch's time goes, and what the Log tab is filling in.
  // Both use null for Free study, the same vocabulary as a session's courseId.
  const [watchTarget, setWatchTarget] = useState<string | null>(null);
  const [logTarget, setLogTarget] = useState<string | null>(null);
  const [logAmount, setLogAmount] = useState('');
  const [logDate, setLogDate] = useState(localDateKey());
  const [logError, setLogError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Re-seed every time the sheet opens, so it always reflects the current
  // settings and the screen's course rather than the last session's edits.
  useEffect(() => {
    if (!visible) return;
    // Default to tracking a course, falling back to the first one when the
    // screen has no particular one in mind — a Course mode with nothing
    // selected would silently behave as free study.
    const list = semester ? getCourses(semester) : [];
    const preferred = initialCourseId || (list.length > 0 ? list[0].id : null);
    setMode(list.length > 0 ? 'course' : 'free');
    setCourseId(preferred);
    setWatchTarget(preferred);
    setLogTarget(preferred);
    setLogAmount('');
    setLogError(null);
    setLogDate(localDateKey());
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
  }, [visible, semester, initialCourseId, initialSettings, slide]);

  // A live stopwatch is what the user most likely came back for, so the sheet
  // opens on its tab rather than on a Pomodoro they cannot start anyway.
  useEffect(() => {
    if (visible && (stopwatchRunning || stopwatchPaused)) setTab('stopwatch');
  }, [visible, stopwatchRunning, stopwatchPaused]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [520, 0] });
  const courses = semester ? getCourses(semester) : [];
  // With no courses to credit there is nothing for the Course mode to do.
  const free = mode === 'free' || courses.length === 0;
  const pomodoroLive = session.phase !== 'idle';

  function handleStart() {
    // clampPomodoroSettings coerces and bounds the raw strings itself.
    const settings = clampPomodoroSettings({
      workMinutes: work as unknown as number,
      shortBreakMinutes: short as unknown as number,
      longBreakMinutes: long as unknown as number,
      pomodorosUntilLongBreak: count as unknown as number,
    });
    onStart({ settings, courseId: free ? null : courseId });
  }

  async function handleSaveWatch() {
    setBusy(true);
    const ok = await saveWatch(watchTarget);
    setBusy(false);
    if (ok) onClose();
  }

  async function handleLog() {
    const seconds = parseHoursMinutesInput(logAmount);
    if (seconds === null || seconds <= 0) {
      setLogError('Enter an amount like "1h 30m", "45m", or a plain number of minutes.');
      return;
    }
    if (!semester) {
      setLogError('Open a semester first — there is nowhere to log this time yet.');
      return;
    }
    setBusy(true);
    const ok = await logStudyTime({
      seconds,
      courseId: logTarget,
      semesterId: semester.id,
      date: logDate,
    });
    setBusy(false);
    if (ok) onClose();
    else setLogError('That time could not be saved. Try again.');
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

  // The target list both the Stopwatch and the Log tab use: Free study first,
  // since it is the category that is *not* a course, then every course.
  const targetList = (selected: string | null, onSelect: (id: string | null) => void) => (
    <ScrollView style={styles.courseList} keyboardShouldPersistTaps="handled">
      <CourseRow
        label={FREE_STUDY_NAME}
        color={FREE_STUDY_COLOR}
        selected={selected === null}
        onPress={() => onSelect(null)}
      />
      {courses.map((c) => (
        <CourseRow
          key={c.id}
          label={c.name}
          color={c.color}
          selected={selected === c.id}
          onPress={() => onSelect(c.id)}
        />
      ))}
    </ScrollView>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.avoider}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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

            <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
              {TABS.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => setTab(t.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === t.id }}
                  accessibilityLabel={t.label}
                  style={({ pressed }) => [
                    styles.tab,
                    tab === t.id && { borderBottomColor: theme.accent },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: tab === t.id ? theme.accent : theme.muted },
                      tab === t.id && styles.tabTextOn,
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {tab === 'pomodoro' ? (
              <>
                <View style={[styles.modes, { borderColor: theme.border }]}>
                  <ModeTab
                    label="Course"
                    selected={!free}
                    disabled={courses.length === 0}
                    onPress={() => setMode('course')}
                  />
                  <ModeTab
                    label={FREE_STUDY_NAME}
                    selected={free}
                    onPress={() => setMode('free')}
                  />
                </View>

                {free ? null : (
                  <ScrollView style={styles.courseList} keyboardShouldPersistTaps="handled">
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
                )}

                <View style={styles.grid}>
                  {field('Focus (min)', work, setWork)}
                  {field('Short break (min)', short, setShort)}
                  {field('Long break (min)', long, setLong)}
                  {field('Focus blocks before long break', count, setCount)}
                </View>

                <Text style={[styles.hint, { color: theme.muted }]}>
                  {stopwatchRunning || stopwatchPaused
                    ? 'The stopwatch still has time on it. Save or discard it before starting a pomodoro.'
                    : free
                      ? `Time is banked as ${FREE_STUDY_NAME} on this semester — its own category in ` +
                        'Study time, separate from every course.'
                      : 'Time is added to the chosen course when a focus block finishes.'}
                </Text>

                <PrimaryButton
                  label="Start"
                  accessibilityLabel="Start study timer"
                  disabled={stopwatchRunning || stopwatchPaused}
                  onPress={handleStart}
                />
              </>
            ) : null}

            {tab === 'stopwatch' ? (
              <>
                <Text
                  style={[
                    styles.watchFace,
                    { color: stopwatchRunning ? theme.accent : theme.text },
                  ]}
                  accessibilityLabel={`Stopwatch at ${formatClock(stopwatchElapsed)}`}
                >
                  {formatClock(stopwatchElapsed)}
                </Text>

                {/* The target list is the assign step: it only exists once
                    there is time to assign. */}
                {stopwatchPaused ? (
                  <>
                    <Text style={[styles.switchLabel, { color: theme.muted }]}>
                      Add this time to
                    </Text>
                    {targetList(watchTarget, setWatchTarget)}
                  </>
                ) : null}

                <Text style={[styles.hint, { color: theme.muted }]}>
                  {!semester
                    ? 'Open a semester first — there is nowhere to save this time yet.'
                    : stopwatchRunning
                      ? 'Counting up. Pause when you are done, then choose where the time goes.'
                      : stopwatchPaused
                        ? `Counted on ${stopwatch.startedDate || localDateKey()} — the day this stretch began.`
                        : pomodoroLive
                          ? 'A pomodoro session is running — stop it first.'
                          : 'No phases and no breaks: it just counts up until you stop it, and you pick the course afterwards.'}
                </Text>

                {stopwatchPaused ? (
                  <View style={styles.row}>
                    <SecondaryButton label="Discard" onPress={discardWatch} danger />
                    <SecondaryButton label="Resume" onPress={() => startWatch(semester?.id ?? null)} />
                    <PrimaryButton
                      label="Save time"
                      accessibilityLabel="Save this time"
                      disabled={busy || !semester}
                      onPress={handleSaveWatch}
                      style={styles.grow}
                    />
                  </View>
                ) : (
                  <PrimaryButton
                    label={stopwatchRunning ? 'Pause' : 'Start'}
                    accessibilityLabel={stopwatchRunning ? 'Pause the stopwatch' : 'Start the stopwatch'}
                    disabled={!stopwatchRunning && pomodoroLive}
                    onPress={() =>
                      stopwatchRunning ? pauseWatch() : startWatch(semester?.id ?? null)
                    }
                  />
                )}
              </>
            ) : null}

            {tab === 'log' ? (
              <>
                <Text style={[styles.switchLabel, { color: theme.muted }]}>Time studied</Text>
                <TextInput
                  value={logAmount}
                  onChangeText={(v) => {
                    setLogAmount(v);
                    setLogError(null);
                  }}
                  placeholder='e.g. "1h 30m", "45m", or 90'
                  placeholderTextColor={theme.muted}
                  style={[
                    styles.input,
                    styles.amountInput,
                    {
                      color: theme.text,
                      borderColor: logError ? DANGER : theme.border,
                      backgroundColor: theme.surfaceAlt,
                    },
                  ]}
                  accessibilityLabel="Time studied"
                />

                <Text style={[styles.switchLabel, { color: theme.muted }]}>Add it to</Text>
                {targetList(logTarget, setLogTarget)}

                <Text style={[styles.switchLabel, { color: theme.muted }]}>Day studied</Text>
                <DateField value={logDate} onChange={(v) => setLogDate(v || localDateKey())} />

                <Text style={[styles.hint, { color: logError ? DANGER : theme.muted }]}>
                  {logError ||
                    'For time studied away from the app. It counts on the day you pick, in both the day and week views.'}
                </Text>

                <PrimaryButton
                  label="Add time"
                  accessibilityLabel="Add this time"
                  disabled={busy || !semester}
                  onPress={handleLog}
                />
              </>
            ) : null}
          </AnimatedPressable>
        </Pressable>
      </KeyboardAvoidingView>
      <NumericKeyboardDoneBar />
    </Modal>
  );
}

/** The sheet's filled action button. */
function PrimaryButton({
  label,
  accessibilityLabel,
  onPress,
  disabled,
  style,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  style?: object;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.startBtn,
        { backgroundColor: theme.accent },
        style,
        disabled && styles.disabled,
        pressed && !disabled && { opacity: 0.8 },
      ]}
    >
      <Text style={styles.startBtnText}>{label}</Text>
    </Pressable>
  );
}

/** A quiet action beside the primary one. */
function SecondaryButton({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.6 }]}
    >
      <Text style={[styles.secondaryBtnText, { color: danger ? DANGER : theme.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** One half of the Course / Free study switch above the list. */
function ModeTab({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !!disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.modeTab,
        selected && { backgroundColor: theme.surfaceAlt },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text
        style={[
          styles.modeTabText,
          { color: disabled ? theme.muted : selected ? theme.accent : theme.text },
          selected && styles.modeTabTextOn,
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
  avoider: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
    // Never more than most of the screen, so the backdrop stays tappable.
    maxHeight: '90%',
  },
  title: { fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 8 },

  // Pomodoro / Stopwatch / Log. An underlined row rather than another segmented
  // switch, so it reads as "which surface am I on" and can't be mistaken for
  // the Course / Free study switch inside it.
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 12 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -StyleSheet.hairlineWidth,
  },
  tabText: { fontSize: 14 },
  tabTextOn: { fontWeight: '600' },

  modes: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  modeTab: { flex: 1, paddingVertical: 9, alignItems: 'center' },
  modeTabText: { fontSize: 14 },
  modeTabTextOn: { fontWeight: '600' },
  // Trimmed from the pre-tabs 180 to pay for the tab bar above it, so the
  // tallest panel (Pomodoro) still fits a small phone without the sheet
  // running off the top.
  courseList: { maxHeight: 150 },
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
  amountInput: { marginBottom: 10, paddingVertical: 12 },
  hint: { fontSize: 12, lineHeight: 17, marginBottom: 12, marginTop: 8 },

  // The stopwatch's own face: the one number the tab is about.
  watchFace: {
    fontSize: 44,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    marginVertical: 12,
  },
  switchLabel: { fontSize: 12, marginBottom: 4 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
  startBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: { paddingVertical: 14, paddingHorizontal: 12 },
  secondaryBtnText: { fontSize: 15, fontWeight: '500' },
  disabled: { opacity: 0.45 },
});
