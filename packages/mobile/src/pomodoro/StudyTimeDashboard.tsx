// Where the semester's tracked study time went: a ring of per-course slices,
// the total in the middle, a legend, and — while a session is running — which
// course it credits. The mobile half of the desktop "Study time" panel.
//
// Same fade-backdrop + slide-sheet shape as PomodoroSetupSheet (RN's <Modal>,
// no extra dependency), and deliberately nothing to do with the course
// progress screens: this panel is about hours, not readings and tasks.
//
// The ring is drawn from plain Views — there is no SVG library in this package
// and none is worth adding for one chart. It is a circle of small ticks, each
// coloured by whichever course owns that slice of the circle; picking the owner
// by the tick's midpoint means the shares normalize themselves, with no
// leftover ticks to round away. Continuing the file's convention, every shape
// here is a View, never an emoji or an icon font.
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatHoursMinutes, studyTimeByCourse } from '@lectio/core/pomodoro-core';
import { getCourses } from '@lectio/core/planner-core';
import { useTheme } from '../theme';
import { usePomodoro } from './PomodoroProvider';
import type { Semester, StudyTimeBreakdown } from '../../types/lectio-core';

const RING_SIZE = 152;
const TICKS = 60;
const TICK_W = 5;
const TICK_H = 18;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function StudyTimeDashboard({
  visible,
  semester,
  onClose,
}: {
  visible: boolean;
  semester: Semester | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const { session, awaiting, switchCourse } = usePomodoro();

  useEffect(() => {
    if (!visible) return;
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [520, 0] });
  const breakdown = studyTimeByCourse(semester);
  const courses = semester ? getCourses(semester) : [];
  const live = session.phase !== 'idle';
  const midBlock = session.phase === 'work' && !awaiting;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close study time">
        <AnimatedPressable
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 },
            { transform: [{ translateY }] },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: theme.text }]}>Study time</Text>

          <StudyRing breakdown={breakdown} />

          {breakdown.courses.length === 0 ? (
            <Text style={[styles.empty, { color: theme.muted }]}>
              No study time tracked yet. Finish a focus block, or set a course&apos;s studied time
              from its course screen.
            </Text>
          ) : (
            <View style={styles.legend}>
              {breakdown.courses.map((slice) => (
                <View key={slice.id} style={[styles.legendRow, { borderBottomColor: theme.border }]}>
                  <View
                    style={[styles.swatch, { backgroundColor: slice.color || theme.muted }]}
                  />
                  <Text style={[styles.legendName, { color: theme.text }]} numberOfLines={1}>
                    {slice.name}
                  </Text>
                  <Text style={[styles.legendValue, { color: theme.text }]}>
                    {formatHoursMinutes(slice.seconds)}
                  </Text>
                  <Text style={[styles.legendPct, { color: theme.muted }]}>{slice.percent}%</Text>
                </View>
              ))}
            </View>
          )}

          <View style={[styles.switcher, { borderTopColor: theme.border }]}>
            <Text style={[styles.switchLabel, { color: theme.muted }]}>This session credits</Text>
            {live ? (
              <>
                <ScrollView style={styles.courseList}>
                  <CourseRow
                    label="Free study (no course)"
                    selected={session.courseId === null}
                    onPress={() => switchCourse(null, null)}
                  />
                  {courses.map((c) => (
                    <CourseRow
                      key={c.id}
                      label={c.name}
                      color={c.color}
                      selected={session.courseId === c.id}
                      onPress={() => switchCourse(c.id, semester ? semester.id : null)}
                    />
                  ))}
                </ScrollView>
                <Text style={[styles.hint, { color: theme.muted }]}>
                  {midBlock
                    ? 'Minutes already studied in this block stay with the course they were earned on — switching banks them and starts a fresh block for the new course.'
                    : 'The next focus block is credited to this course.'}
                </Text>
              </>
            ) : (
              <Text style={[styles.hint, { color: theme.muted }]}>
                No timer running — start one to track time against a course.
              </Text>
            )}
          </View>
        </AnimatedPressable>
      </Pressable>
    </Modal>
  );
}

/**
 * The ring: TICKS small bars around a circle, each carrying the colour of the
 * course whose slice covers it, with the semester total in the middle. Every
 * tick is a full-size square rotated about its own centre, so the maths is just
 * "which slice owns this angle" — no arc geometry, and nothing to clip.
 */
function StudyRing({ breakdown }: { breakdown: StudyTimeBreakdown }) {
  const theme = useTheme();

  let running = 0;
  const bounds = breakdown.courses.map((slice) => {
    running += slice.share;
    return { upTo: running, color: slice.color || theme.muted };
  });

  const ownerColor = (index: number) => {
    if (bounds.length === 0) return theme.track;
    const midpoint = (index + 0.5) / TICKS;
    const owner = bounds.find((b) => midpoint <= b.upTo);
    // Rounding can leave the final tick a hair past the last boundary.
    return (owner || bounds[bounds.length - 1]).color;
  };

  return (
    <View
      style={styles.ring}
      accessibilityRole="image"
      accessibilityLabel={`Study time per course, ${formatHoursMinutes(
        breakdown.totalSeconds
      )} in total`}
    >
      {Array.from({ length: TICKS }, (_, i) => (
        <View
          key={i}
          style={[styles.spoke, { transform: [{ rotate: `${(i * 360) / TICKS}deg` }] }]}
        >
          <View style={[styles.tick, { backgroundColor: ownerColor(i) }]} />
        </View>
      ))}
      <View style={styles.ringCenter} pointerEvents="none">
        <Text style={[styles.ringTotal, { color: theme.text }]}>
          {formatHoursMinutes(breakdown.totalSeconds)}
        </Text>
        <Text style={[styles.ringSub, { color: theme.muted }]}>studied</Text>
      </View>
    </View>
  );
}

/** One switchable course row — same selection mark as the setup sheet's list. */
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
      accessibilityLabel={`Credit this session to ${label}`}
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
  title: { fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 4 },

  ring: { width: RING_SIZE, height: RING_SIZE, alignSelf: 'center', marginVertical: 10 },
  // A full-size square rotated about its own centre; the tick rides its top
  // edge, so rotating the square walks the tick around the circle.
  spoke: { position: 'absolute', left: 0, top: 0, width: RING_SIZE, height: RING_SIZE, alignItems: 'center' },
  tick: { width: TICK_W, height: TICK_H, borderRadius: TICK_W / 2 },
  ringCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTotal: { fontSize: 24, fontWeight: '700' },
  ringSub: { fontSize: 12 },

  legend: { marginBottom: 4 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendName: { flex: 1, fontSize: 15 },
  legendValue: { fontSize: 15, fontVariant: ['tabular-nums'] },
  legendPct: { fontSize: 13, minWidth: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
  empty: { fontSize: 13, lineHeight: 19, marginBottom: 8 },

  switcher: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 8 },
  switchLabel: { fontSize: 12, marginBottom: 4 },
  courseList: { maxHeight: 168 },
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
  hint: { fontSize: 12, lineHeight: 17, marginTop: 8 },
});
