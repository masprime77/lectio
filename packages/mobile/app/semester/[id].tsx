import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  courseProgress,
  deleteCourse,
  getCourses,
  reorderCourses,
  sortedCourses,
} from '@lectio/core/planner-core';
import {
  formatHoursMinutes,
  getCourseStudySeconds,
  setStudyTime,
} from '@lectio/core/pomodoro-core';
import { storage } from '../../src/storage';
import { saveWithConflict } from '../../src/sync/saveWithConflict';
import { prefs } from '../../src/lib/prefs';
import { useSortOrder } from '../../src/lib/use-sort-order';
import { useIsTablet } from '../../src/lib/use-tablet';
import { useTheme } from '../../src/theme';
import { CourseBreakdown } from '../../src/components/CourseBreakdown';
import { CourseDetailBody } from '../../src/components/course-detail/CourseDetailBody';
import { CourseDetailHeaderActions } from '../../src/components/course-detail/CourseDetailHeaderActions';
import { useCourseDetail } from '../../src/components/course-detail/useCourseDetail';
import { ExportIcon } from '../../src/components/ExportIcon';
import { Fab } from '../../src/components/Fab';
import { PomodoroFab } from '../../src/pomodoro/PomodoroFab';
import { StudyTimeEditor } from '../../src/pomodoro/StudyTimeEditor';
import { ProgressBar } from '../../src/components/ProgressBar';
import { SortButton, SortMenu } from '../../src/components/SortMenu';
import { SwipeableRow } from '../../src/components/SwipeableRow';
import * as transfer from '../../src/lib/transfer';
import { ensureMoodleAccountOrPrompt } from '../../src/moodle/ensure-account';
import type { Course, Semester } from '../../types/lectio-core';

/**
 * A small `list.bullet.indent`-style glyph drawn from plain Views (no icon
 * library): three bullet+line rows, the lower two indented, evoking an
 * indented bullet list. Used as the header Breakdown toggle.
 */
function BreakdownIcon({ color }: { color: string }) {
  return (
    <View style={styles.bdIcon}>
      {[0, 1, 1].map((indent, i) => (
        <View key={i} style={[styles.bdIconRow, indent ? styles.bdIconRowIndent : null]}>
          <View style={[styles.bdIconDot, { backgroundColor: color }]} />
          <View style={[styles.bdIconLine, { backgroundColor: color }]} />
        </View>
      ))}
    </View>
  );
}

export default function CoursesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [semester, setSemester] = useState<Semester | null>(null);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortOrder, pickSortOrder] = useSortOrder();
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  // Per-screen toggle (need not persist); default closed so the list stays
  // clean, mirroring the desktop's state.breakdownOpen.
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const isTablet = useIsTablet();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const reload = useCallback(() => {
    return storage
      .get(id)
      .then(setSemester)
      .catch((err) => console.warn('load failed', err));
  }, [id]);

  // Reload on focus so tag changes made in course detail update the bars here.
  // Also record this semester as the last opened one (fire-and-forget).
  useFocusEffect(
    useCallback(() => {
      prefs.setLastSemesterId(id);
      reload();
    }, [id, reload])
  );

  const persist = useCallback(
    (next: Semester) => {
      setSemester(next);
      // Conflict-aware: onApplied swaps the screen to the cloud version when the
      // user chooses "Use the latest"; "Cancel" leaves `next` on screen unsaved.
      saveWithConflict(id, next, setSemester).catch((err) => console.warn('save failed', err));
    },
    [id]
  );

  function toggleEditing() {
    setEditing((e) => !e);
    setSelected(new Set());
  }

  function toggleSelect(courseId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  // Swap-based reorder through core's reorderCourses.
  function moveCourse(courseId: string, dir: -1 | 1) {
    if (!semester) return;
    const ids = getCourses(semester).map((c) => c.id);
    const idx = ids.indexOf(courseId);
    const swap = idx + dir;
    if (idx === -1 || swap < 0 || swap >= ids.length) return;
    [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
    const next: Semester = JSON.parse(JSON.stringify(semester));
    reorderCourses(next, ids);
    persist(next);
  }

  // Course whose studied time is being corrected by hand (null = editor closed).
  const [timeEditCourse, setTimeEditCourse] = useState<Course | null>(null);

  function saveStudyTime(courseId: string, seconds: number) {
    if (!semester) return;
    const next: Semester = JSON.parse(JSON.stringify(semester));
    const c = getCourses(next).find((x) => x.id === courseId);
    if (!c) return;
    setStudyTime(c, seconds);
    setSemester(next);
    saveWithConflict(id, next, setSemester).catch((err) => console.warn('save failed', err));
    setTimeEditCourse(null);
  }

  function showCourseActions(course: Course) {
    Alert.alert(course.name, undefined, [
      {
        text: 'Edit',
        onPress: () => router.push(`/semester/course-form?id=${id}&courseId=${course.id}`),
      },
      {
        text: 'Import from Moodle',
        onPress: async () => {
          if (!(await ensureMoodleAccountOrPrompt(router))) return;
          router.push(`/moodle-import?semesterId=${id}&courseId=${course.id}`);
        },
      },
      { text: 'Edit studied time', onPress: () => setTimeEditCourse(course) },
      { text: 'Move up', onPress: () => moveCourse(course.id, -1) },
      { text: 'Move down', onPress: () => moveCourse(course.id, +1) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteCourse(course) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function confirmDeleteCourse(course: Course) {
    Alert.alert(
      'Delete course',
      `Delete "${course.name}"? Its readings and tasks will be lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (!semester) return;
            const next: Semester = JSON.parse(JSON.stringify(semester));
            deleteCourse(next, course.id);
            persist(next);
          },
        },
      ]
    );
  }

  function batchDelete() {
    const count = selected.size;
    if (count === 0 || !semester) return;
    Alert.alert(
      'Delete courses',
      `Delete ${count} ${count === 1 ? 'course' : 'courses'}? Their readings and tasks will be lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const next: Semester = JSON.parse(JSON.stringify(semester));
            selected.forEach((courseId) => deleteCourse(next, courseId));
            setEditing(false);
            setSelected(new Set());
            persist(next);
          },
        },
      ]
    );
  }

  // Export this whole semester via the system share sheet.
  function handleExportSemester() {
    transfer.exportSemester(id).catch((err) => {
      if (err) Alert.alert('Export failed', err instanceof Error ? err.message : String(err));
    });
  }

  const courses = semester ? getCourses(semester) : [];
  // Display-only ordering: sortedCourses returns a new array, so the
  // semester JSON's on-disk course order is never touched.
  const visibleCourses = semester ? sortedCourses(courses, semester, sortOrder) : [];

  useEffect(() => {
    if (!isTablet) return;
    if (selectedCourseId && courses.some((c) => c.id === selectedCourseId)) return;
    setSelectedCourseId(courses[0]?.id ?? null);
  }, [isTablet, courses, selectedCourseId]);

  const detail = useCourseDetail(semester, selectedCourseId ?? '', persist);

  const listEmpty = semester ? (
    <View style={styles.emptyWrap}>
      <Text style={{ color: theme.muted }}>No courses.</Text>
      <Pressable
        style={[styles.emptyBtn, { backgroundColor: theme.accent }]}
        onPress={() => router.push(`/semester/course-form?id=${id}`)}
      >
        <Text style={styles.emptyBtnText}>Add a course</Text>
      </Pressable>
    </View>
  ) : null;

  const renderCourse = ({ item }: { item: Course }) => {
    const progress = courseProgress(item, semester!);
    return (
      <SwipeableRow
        enabled={!editing}
        editColor={theme.accent}
        onEdit={() => router.push(`/semester/course-form?id=${id}&courseId=${item.id}`)}
        onDelete={() => confirmDeleteCourse(item)}
      >
        <Pressable
          onPress={() => {
            if (editing) {
              toggleSelect(item.id);
              return;
            }
            if (isTablet) {
              setSelectedCourseId(item.id);
              return;
            }
            router.push(`/semester/${id}/course/${item.id}`);
          }}
          onLongPress={editing ? undefined : () => showCourseActions(item)}
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={styles.cardHeader}>
            {editing && (
              <View
                style={[
                  styles.selectCircle,
                  { borderColor: theme.border },
                  selected.has(item.id) && {
                    backgroundColor: theme.accent,
                    borderColor: theme.accent,
                  },
                ]}
              />
            )}
            <View
              style={[styles.dot, { backgroundColor: item.color || theme.accent }]}
            />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              {item.name}
            </Text>
          </View>
          <ProgressBar value={progress} color={item.color} />
          <Text style={[styles.meta, { color: theme.muted }]}>
            {progress}% · {item.readings.length} readings · {item.tasks.length} tasks
            {getCourseStudySeconds(item) > 0
              ? ` · ${formatHoursMinutes(getCourseStudySeconds(item))} studied`
              : ''}
            {item.examDate ? ` · exam ${item.examDate}` : ''}
          </Text>
          {breakdownOpen && (
            <CourseBreakdown course={item} semester={semester!} />
          )}
        </Pressable>
      </SwipeableRow>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: semester?.name ?? 'Semester',
          headerRight: () =>
            editing ? (
              <View style={styles.headerActions}>
                <Pressable onPress={batchDelete} disabled={selected.size === 0}>
                  <Text
                    style={{
                      color: selected.size === 0 ? theme.muted : '#ef4444',
                      fontSize: 15,
                      fontWeight: '600',
                    }}
                  >
                    Delete{selected.size > 0 ? ` (${selected.size})` : ''}
                  </Text>
                </Pressable>
                <Pressable onPress={toggleEditing}>
                  <Text style={{ color: theme.accent, fontSize: 15 }}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.headerActions}>
                <Pressable
                  onPress={handleExportSemester}
                  accessibilityRole="button"
                  accessibilityLabel="Export semester"
                  hitSlop={8}
                  style={({ pressed }) => pressed && { opacity: 0.6 }}
                >
                  <ExportIcon color={theme.accent} />
                </Pressable>
                {courses.length > 0 && (
                  <>
                    <Pressable
                      onPress={() => setBreakdownOpen((o) => !o)}
                      accessibilityRole="button"
                      accessibilityLabel="Breakdown"
                      accessibilityState={{ expanded: breakdownOpen }}
                      style={({ pressed }) => pressed && { opacity: 0.6 }}
                    >
                      <BreakdownIcon color={breakdownOpen ? theme.accent : theme.muted} />
                    </Pressable>
                    <SortButton onPress={() => setSortMenuOpen(true)} />
                    <Pressable onPress={toggleEditing}>
                      <Text style={{ color: theme.accent, fontSize: 15 }}>Edit</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ),
        }}
      />
      {isTablet ? (
        <View style={styles.splitRow}>
          <View style={[styles.leftPane, { borderColor: theme.border }]}>
            <FlatList
              style={{ backgroundColor: theme.background }}
              contentContainerStyle={styles.list}
              data={visibleCourses}
              keyExtractor={(c) => c.id}
              ListEmptyComponent={listEmpty}
              renderItem={renderCourse}
            />
          </View>
          <View style={[styles.rightPane, { backgroundColor: theme.background }]}>
            {detail.course ? (
              <>
                <View style={[styles.paneHeader, { borderColor: theme.border }]}>
                  <Text
                    style={[styles.paneTitle, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {detail.course.name}
                  </Text>
                  <CourseDetailHeaderActions
                    editing={detail.editing}
                    selectedCount={detail.selected.size}
                    hasItems={detail.hasItems}
                    groupMode={detail.groupMode}
                    onToggleEditing={detail.toggleEditing}
                    onBatchDelete={detail.batchDelete}
                    onExport={detail.handleExportCourse}
                    onSortPress={() => detail.setSortMenuOpen(true)}
                    onGroupPress={() => detail.setGroupMenuOpen(true)}
                  />
                </View>
                <CourseDetailBody result={detail} embedded />
              </>
            ) : (
              <View style={styles.emptyDetail}>
                <Text style={{ color: theme.muted }}>
                  Select a course to see its readings and tasks.
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <FlatList
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={styles.list}
          data={visibleCourses}
          keyExtractor={(c) => c.id}
          ListEmptyComponent={listEmpty}
          renderItem={renderCourse}
        />
      )}
      <SortMenu
        visible={sortMenuOpen}
        current={sortOrder}
        onPick={pickSortOrder}
        onClose={() => setSortMenuOpen(false)}
      />
      <StudyTimeEditor
        visible={timeEditCourse !== null}
        courseName={timeEditCourse ? timeEditCourse.name : ''}
        currentSeconds={timeEditCourse ? getCourseStudySeconds(timeEditCourse) : 0}
        onSave={(seconds) => timeEditCourse && saveStudyTime(timeEditCourse.id, seconds)}
        onClose={() => setTimeEditCourse(null)}
      />
      <PomodoroFab semester={semester} />
      <Fab onPress={() => router.push(`/add?context=course&id=${id}`)} />
    </>
  );
}

const styles = StyleSheet.create({
  // Clears the tallest floating column: the bottom-left timer stack, 24 + 56
  // (timer) + 10 + 44 (study time) above the safe area, plus a little air.
  list: { padding: 16, gap: 12, paddingBottom: 150 },
  emptyWrap: { alignItems: 'center', gap: 12, marginTop: 32 },
  emptyBtn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  splitRow: { flex: 1, flexDirection: 'row' },
  leftPane: { width: 380, borderRightWidth: StyleSheet.hairlineWidth },
  rightPane: { flex: 1 },
  paneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  paneTitle: { fontSize: 20, fontWeight: '700', flexShrink: 1 },
  emptyDetail: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 4 },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  cardTitle: { fontSize: 17, fontWeight: '600', flexShrink: 1 },
  meta: { fontSize: 13 },
  bdIcon: { gap: 3, paddingVertical: 2 },
  bdIconRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  bdIconRowIndent: { marginLeft: 5 },
  bdIconDot: { width: 3, height: 3, borderRadius: 1.5 },
  bdIconLine: { width: 11, height: 2, borderRadius: 1 },
});
