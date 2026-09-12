// Where the semester's tracked study time went, over one of four windows —
// Today, This week, Last week, All time: a ring of slices (one per course plus
// the semester's own Free study category), the total in the middle, a legend,
// and, while a session is running, which of them it credits. The mobile half of
// the desktop "Study time" panel.
//
// The three dated windows are built from the session log, which is kept for
// four weeks; All time comes from the running totals, which are never trimmed.
// In a week view the seven days are a row of bars, and tapping one narrows
// everything below it to that day.
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
import { useEffect, useRef, useState } from 'react';
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
import {
  FREE_STUDY_COLOR,
  FREE_STUDY_NAME,
  formatHoursMinutes,
  localDateKey,
  studyDayRange,
  studyTimeByCourse,
  studyTimeByDay,
  studyTimeInRange,
  studyWeekRange,
} from '@lectio/core/pomodoro-core';
import { getCourses } from '@lectio/core/planner-core';
import { useTheme } from '../theme';
import { usePomodoro } from './PomodoroProvider';
import type { Semester, StudyDateRange, StudyTimeBreakdown } from '../../types/lectio-core';

type StudyRangeId = 'today' | 'week' | 'lastWeek' | 'all';

const RANGES: { id: StudyRangeId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'lastWeek', label: 'Last week' },
  { id: 'all', label: 'All time' },
];

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The dates a range covers, or null for the untimed all-time view. */
function rangeWindow(id: StudyRangeId): StudyDateRange | null {
  if (id === 'today') return studyDayRange(0);
  if (id === 'week') return studyWeekRange(0);
  if (id === 'lastWeek') return studyWeekRange(-1);
  return null;
}

/** 'Apr 7' — the short form the rest of the app uses for a bare date. */
function formatDateKey(key: string): string {
  const date = new Date(key + 'T00:00:00');
  return Number.isNaN(date.getTime())
    ? key
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const RING_SIZE = 152;
const DAY_BAR_H = 44;
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
  const [rangeId, setRangeId] = useState<StudyRangeId>('today');
  // Which day of a week view is singled out; null is the whole week.
  const [day, setDay] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    // Every visit opens on Today: the range is a question about now, not a
    // preference worth remembering between visits.
    setRangeId('today');
    setDay(null);
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [520, 0] });
  const range = rangeWindow(rangeId);
  const isWeek = rangeId === 'week' || rangeId === 'lastWeek';
  // A day selected inside a week view narrows everything below it.
  const scope = range && day ? { from: day, to: day } : range;
  const breakdown = scope
    ? studyTimeInRange(semester, scope.from, scope.to)
    : studyTimeByCourse(semester);
  const days = isWeek && range ? studyTimeByDay(semester, range.from, range.to) : [];
  const peak = days.reduce((max, d) => Math.max(max, d.totalSeconds), 0);
  const today = localDateKey();
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
          {/* Four ranges, a week of day bars, the ring, the legend and the
              session switcher do not fit a small phone at once, so the whole
              body scrolls. It is the only scroller in the sheet — the course
              switcher below is a plain View, since nesting a second vertical
              ScrollView inside this one would fight it for the gesture. */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
          <Text style={[styles.title, { color: theme.text }]}>Study time</Text>

          <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
            {RANGES.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => {
                  setRangeId(r.id);
                  // "This week" opens on the whole week rather than on whichever
                  // day was singled out last — the day filter belongs to the
                  // visit, not to the range.
                  setDay(null);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: rangeId === r.id }}
                accessibilityLabel={r.label}
                style={({ pressed }) => [
                  styles.tab,
                  rangeId === r.id && { borderBottomColor: theme.accent },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: rangeId === r.id ? theme.accent : theme.muted },
                    rangeId === r.id && styles.tabTextOn,
                  ]}
                >
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.captionRow}>
            <Text style={[styles.caption, { color: theme.muted }]}>
              {!range
                ? 'Every hour ever tracked on this semester.'
                : day
                  ? formatDateKey(day)
                  : range.from === range.to
                    ? formatDateKey(range.from)
                    : `${formatDateKey(range.from)} – ${formatDateKey(range.to)}`}
            </Text>
            {day ? (
              <Pressable
                onPress={() => setDay(null)}
                accessibilityRole="button"
                accessibilityLabel="Show the whole week"
                hitSlop={8}
              >
                <Text style={[styles.caption, { color: theme.accent }]}>Show whole week</Text>
              </Pressable>
            ) : null}
          </View>

          {/* The week as seven tappable bars: each day's height is its share of
              the week's busiest day, so the shape of the week reads at a
              glance. Drawn from plain Views, like every other glyph here. */}
          {isWeek ? (
            <View style={styles.days}>
              {days.map((d, i) => {
                const selected = day === d.date;
                const height = peak > 0 ? Math.max(2, (d.totalSeconds / peak) * DAY_BAR_H) : 0;
                return (
                  <Pressable
                    key={d.date}
                    onPress={() => setDay(selected ? null : d.date)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${formatDateKey(d.date)}, ${formatHoursMinutes(
                      d.totalSeconds
                    )} studied`}
                    style={({ pressed }) => [
                      styles.day,
                      selected && { backgroundColor: theme.surfaceAlt },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <View style={[styles.dayBar, { backgroundColor: theme.track }]}>
                      <View
                        style={[styles.dayFill, { height, backgroundColor: theme.accent }]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.dayName,
                        { color: selected ? theme.accent : theme.muted },
                      ]}
                    >
                      {DAY_NAMES[i] || ''}
                    </Text>
                    <Text
                      style={[
                        styles.dayNum,
                        {
                          color:
                            d.date === today ? theme.accent : selected ? theme.accent : theme.muted,
                        },
                        d.date === today && styles.dayNumToday,
                      ]}
                    >
                      {d.date.slice(8)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <StudyRing breakdown={breakdown} />

          {breakdown.courses.length === 0 ? (
            <Text style={[styles.empty, { color: theme.muted }]}>
              {/* Nothing in an all-time view means nothing has ever been
                  tracked; nothing in a dated one usually just means nothing was
                  tracked *then*. */}
              {rangeId === 'all'
                ? `No study time tracked yet. Finish a focus block — against a course or as ${FREE_STUDY_NAME} — run the stopwatch, or log time you already spent.`
                : 'Nothing tracked in this window.'}
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

          {range ? (
            <Text style={[styles.note, { color: theme.muted }]}>
              Day and week totals cover the last four weeks and count only time tracked since this
              view existed. All time keeps every hour, including anything tracked before.
            </Text>
          ) : null}

          <View style={[styles.switcher, { borderTopColor: theme.border }]}>
            <Text style={[styles.switchLabel, { color: theme.muted }]}>This session credits</Text>
            {live ? (
              <>
                <View style={styles.courseList}>
                  <CourseRow
                    label={FREE_STUDY_NAME}
                    color={FREE_STUDY_COLOR}
                    selected={session.courseId === null}
                    onPress={() => switchCourse(null, semester ? semester.id : null)}
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
                </View>
                <Text style={[styles.hint, { color: theme.muted }]}>
                  {midBlock
                    ? 'Minutes already studied in this block stay where they were earned — switching banks them and starts a fresh block.'
                    : `The next focus block is credited here. ${FREE_STUDY_NAME} is its own category on this semester.`}
                </Text>
              </>
            ) : (
              <Text style={[styles.hint, { color: theme.muted }]}>
                {`No timer running — start one to track time against a course, or as ${FREE_STUDY_NAME}.`}
              </Text>
            )}
          </View>
          </ScrollView>
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
    // Never more than most of the screen, so the backdrop stays tappable and
    // the body scrolls instead of pushing the sheet off the top.
    maxHeight: '88%',
  },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: 4 },
  title: { fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 4 },

  // Today / This week / Last week / All time. The same underlined row the
  // study-timer sheet uses for its three tabs, so "pick a view" looks the same
  // wherever it appears.
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 6 },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -StyleSheet.hairlineWidth,
  },
  tabText: { fontSize: 12.5 },
  tabTextOn: { fontWeight: '600' },

  captionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  caption: { fontSize: 12 },

  days: { flexDirection: 'row', gap: 4, marginTop: 10 },
  day: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4, borderRadius: 8 },
  dayBar: {
    width: '86%',
    height: DAY_BAR_H,
    borderRadius: 3,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  dayFill: { width: '100%', borderRadius: 3 },
  dayName: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  dayNum: { fontSize: 10, fontVariant: ['tabular-nums'] },
  dayNumToday: { fontWeight: '700' },

  note: { fontSize: 11, lineHeight: 16, marginTop: 4 },

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
  courseList: { marginTop: 2 },
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
