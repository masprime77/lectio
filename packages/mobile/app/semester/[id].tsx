import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { courseProgress, deleteCourse, getCourses, reorderCourses } from '@lectio/core/planner-core';
import { storage } from '../../src/storage';
import { prefs } from '../../src/lib/prefs';
import { useStudyMode } from '../../src/study/StudyModeProvider';
import { useTheme } from '../../src/theme';
import { Fab } from '../../src/components/Fab';
import { ProgressBar } from '../../src/components/ProgressBar';
import { StudyFab } from '../../src/components/StudyFab';
import { SwipeableRow } from '../../src/components/SwipeableRow';
import type { Course, Semester } from '../../types/lectio-core';

export default function CoursesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { studyMode, toggle } = useStudyMode();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [semester, setSemester] = useState<Semester | null>(null);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
      storage.save(id, next).catch((err) => console.warn('save failed', err));
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

  function showCourseActions(course: Course) {
    Alert.alert(course.name, undefined, [
      {
        text: 'Edit',
        onPress: () => router.push(`/semester/course-form?id=${id}&courseId=${course.id}`),
      },
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

  const courses = semester ? getCourses(semester) : [];

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
            ) : courses.length > 0 ? (
              <Pressable onPress={toggleEditing} style={{ marginRight: 4 }}>
                <Text style={{ color: theme.accent, fontSize: 15 }}>Edit</Text>
              </Pressable>
            ) : null,
        }}
      />
      <FlatList
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.list}
        data={courses}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          studyMode ? (
            <Text style={[styles.studyBanner, { color: theme.muted }]}>
              Study Mode — counting only Studied items
            </Text>
          ) : null
        }
        ListEmptyComponent={
          semester ? (
            <View style={styles.emptyWrap}>
              <Text style={{ color: theme.muted }}>No courses.</Text>
              <Pressable
                style={[styles.emptyBtn, { backgroundColor: theme.accent }]}
                onPress={() => router.push(`/semester/course-form?id=${id}`)}
              >
                <Text style={styles.emptyBtnText}>Add a course</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const progress = courseProgress(item, semester!, studyMode);
          return (
            <SwipeableRow
              enabled={!editing}
              editColor={theme.accent}
              onEdit={() => router.push(`/semester/course-form?id=${id}&courseId=${item.id}`)}
              onDelete={() => confirmDeleteCourse(item)}
            >
              <Pressable
                onPress={() =>
                  editing
                    ? toggleSelect(item.id)
                    : router.push(`/semester/${id}/course/${item.id}`)
                }
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
                </Text>
              </Pressable>
            </SwipeableRow>
          );
        }}
      />
      <StudyFab active={studyMode} onPress={toggle} />
      <Fab onPress={() => router.push(`/add?context=course&id=${id}`)} />
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12, paddingBottom: 112 },
  emptyWrap: { alignItems: 'center', gap: 12, marginTop: 32 },
  emptyBtn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 4 },
  studyBanner: { fontSize: 12 },
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
});
