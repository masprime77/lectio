import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  courseProgress,
  deleteItem,
  getCourses,
  getReadingTags,
  getTaskTags,
  setItemStatus,
} from '@lectio/core/planner-core';
import { storage } from '../../../../src/storage';
import { useSortOrder } from '../../../../src/lib/use-sort-order';
import { useStudyMode } from '../../../../src/study/StudyModeProvider';
import { useTheme } from '../../../../src/theme';
import { Fab } from '../../../../src/components/Fab';
import { ProgressBar } from '../../../../src/components/ProgressBar';
import { SortButton, SortMenu } from '../../../../src/components/SortMenu';
import { SwipeableRow } from '../../../../src/components/SwipeableRow';
import { TagPickerSheet } from '../../../../src/components/TagPickerSheet';
import * as transfer from '../../../../src/lib/transfer';
import type { PlannerItem, Semester, SortOrder, Tag } from '../../../../types/lectio-core';

type Kind = 'reading' | 'task';

// Week orders sort the readings/tasks by their week (display-only: returns a
// new array, the on-disk item order is untouched). The other orders affect
// the courses list, not item ordering, so items keep their stored order.
function sortedItems(items: PlannerItem[], order: SortOrder): PlannerItem[] {
  if (order !== 'week-asc' && order !== 'week-desc') return items;
  const dir = order === 'week-desc' ? -1 : 1;
  const week = (it: PlannerItem) =>
    typeof it.week === 'number' ? it.week : Number.MAX_SAFE_INTEGER;
  return [...items].sort((a, b) => (week(a) - week(b)) * dir);
}

export default function CourseDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { studyMode } = useStudyMode();
  const { id, courseId } = useLocalSearchParams<{ id: string; courseId: string }>();
  const [semester, setSemester] = useState<Semester | null>(null);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [picker, setPicker] = useState<{ kind: Kind; item: PlannerItem } | null>(null);
  const [sortOrder, pickSortOrder] = useSortOrder();
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      storage.get(id).then((s) => {
        if (active) setSemester(s);
      });
      return () => {
        active = false;
      };
    }, [id])
  );

  const course = semester ? getCourses(semester).find((c) => c.id === courseId) : undefined;

  const persist = useCallback(
    (next: Semester) => {
      setSemester(next);
      storage.save(id, next).catch((err) => console.warn('save failed', err));
    },
    [id]
  );

  // Set an item's tag to the one picked in the sheet, persist, and re-render.
  // Writes the same item.status id the desktop's tag menu writes. Study Mode
  // (future) can reuse this directly — picking the Studied tag is just a pick.
  const applyStatus = useCallback(
    (kind: Kind, itemId: string | undefined, tagId: string) => {
      if (!semester || !itemId) return;
      const next: Semester = JSON.parse(JSON.stringify(semester));
      const c = getCourses(next).find((x) => x.id === courseId);
      if (!c) return;
      setItemStatus(c, kind, itemId, tagId);
      persist(next);
      setPicker(null);
    },
    [semester, courseId, persist]
  );

  function toggleEditing() {
    setEditing((e) => !e);
    setSelected(new Set());
  }

  function toggleSelect(itemId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function confirmDeleteItem(kind: Kind, item: PlannerItem) {
    Alert.alert(`Delete ${kind}`, `Delete "${item.title ?? 'Untitled'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (!semester || !item.id) return;
          const next: Semester = JSON.parse(JSON.stringify(semester));
          const c = getCourses(next).find((x) => x.id === courseId);
          if (!c) return;
          deleteItem(c, kind, item.id);
          persist(next);
        },
      },
    ]);
  }

  function showItemActions(kind: Kind, item: PlannerItem) {
    Alert.alert(item.title ?? 'Item', undefined, [
      {
        text: 'Edit',
        onPress: () =>
          router.push(
            `/semester/item-form?id=${id}&courseId=${courseId}&kind=${kind}&itemId=${item.id}`
          ),
      },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteItem(kind, item) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function pushAddItem(kind: Kind) {
    router.push(`/semester/item-form?id=${id}&courseId=${courseId}&kind=${kind}`);
  }

  function batchDelete() {
    const count = selected.size;
    if (count === 0 || !semester) return;
    Alert.alert(
      'Delete items',
      `Delete ${count} ${count === 1 ? 'item' : 'items'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const next: Semester = JSON.parse(JSON.stringify(semester));
            const c = getCourses(next).find((x) => x.id === courseId);
            if (!c) return;
            c.readings = c.readings.filter((it) => !it.id || !selected.has(it.id));
            c.tasks = c.tasks.filter((it) => !it.id || !selected.has(it.id));
            setEditing(false);
            setSelected(new Set());
            persist(next);
          },
        },
      ]
    );
  }

  // Export this course via the system share sheet (fresh ids are assigned on
  // import, so the exported ids are just a snapshot).
  function handleExportCourse() {
    if (!course) return;
    transfer.exportCourse(course).catch((err) => {
      if (err) Alert.alert('Export failed', err instanceof Error ? err.message : String(err));
    });
  }

  if (!course) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Course' }} />
        <Text style={{ color: theme.muted }}>{semester ? 'Course not found.' : ''}</Text>
      </View>
    );
  }

  const readingTags = getReadingTags(semester!);
  const taskTags = getTaskTags(semester!);
  const progress = courseProgress(course, semester!, studyMode);
  const hasItems = course.readings.length > 0 || course.tasks.length > 0;

  const renderItem = (kind: Kind, item: PlannerItem, tags: Tag[]) => {
    const tag = tags.find((t) => t.id === item.status);
    return (
      <SwipeableRow
        key={item.id}
        enabled={!editing}
        editColor={theme.accent}
        onEdit={
          item.id
            ? () =>
                router.push(
                  `/semester/item-form?id=${id}&courseId=${courseId}&kind=${kind}&itemId=${item.id}`
                )
            : undefined
        }
        onDelete={item.id ? () => confirmDeleteItem(kind, item) : undefined}
        containerStyle={styles.itemContainer}
      >
        <Pressable
          onPress={() =>
            editing ? item.id && toggleSelect(item.id) : setPicker({ kind, item })
          }
          onLongPress={editing ? undefined : () => showItemActions(kind, item)}
          style={[styles.item, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          {editing && (
            <View
              style={[
                styles.selectCircle,
                { borderColor: theme.border },
                !!item.id &&
                  selected.has(item.id) && {
                    backgroundColor: theme.accent,
                    borderColor: theme.accent,
                  },
              ]}
            />
          )}
          <View style={styles.itemMain}>
            <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
            {typeof item.week === 'number' && (
              <Text style={[styles.itemWeek, { color: theme.muted }]}>Week {item.week}</Text>
            )}
            {kind === 'task' && typeof item.dueDate === 'string' && item.dueDate !== '' && (
              <Text style={[styles.itemWeek, { color: theme.muted }]}>due {item.dueDate}</Text>
            )}
          </View>
          <View style={styles.tagWrap}>
            <View
              style={[styles.tagDot, { backgroundColor: tag?.color ?? theme.muted }]}
            />
            <Text style={[styles.tagName, { color: theme.muted }]}>
              {tag?.name ?? item.status}
            </Text>
          </View>
        </Pressable>
      </SwipeableRow>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: course.name,
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
                <Pressable onPress={handleExportCourse}>
                  <Text style={{ color: theme.accent, fontSize: 15 }}>Export</Text>
                </Pressable>
                {hasItems && (
                  <>
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
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
      >
        <View
          style={[styles.summary, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Text style={[styles.summaryPct, { color: theme.text }]}>{progress}%</Text>
          <ProgressBar value={progress} color={course.color} />
          <Text style={[styles.hint, { color: theme.muted }]}>
            {editing
              ? 'Tap items to select them, then delete.'
              : 'Tap an item to set its tag. Long-press to edit or delete.'}
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Readings</Text>
          <Pressable onPress={() => pushAddItem('reading')}>
            <Text style={{ color: theme.accent, fontSize: 15 }}>+ Add</Text>
          </Pressable>
        </View>
        {course.readings.length === 0 ? (
          <Pressable onPress={() => pushAddItem('reading')}>
            <Text style={[styles.empty, { color: theme.muted }]}>
              No readings. Tap to add one.
            </Text>
          </Pressable>
        ) : (
          sortedItems(course.readings, sortOrder).map((r) => renderItem('reading', r, readingTags))
        )}

        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Tasks</Text>
          <Pressable onPress={() => pushAddItem('task')}>
            <Text style={{ color: theme.accent, fontSize: 15 }}>+ Add</Text>
          </Pressable>
        </View>
        {course.tasks.length === 0 ? (
          <Pressable onPress={() => pushAddItem('task')}>
            <Text style={[styles.empty, { color: theme.muted }]}>No tasks. Tap to add one.</Text>
          </Pressable>
        ) : (
          sortedItems(course.tasks, sortOrder).map((t) => renderItem('task', t, taskTags))
        )}
      </ScrollView>
      {/* The "+" opens the add-sheet on the Tags tab; readings/tasks are added
          from the per-section "+ Add" controls next to the Readings/Tasks headers. */}
      <Fab onPress={() => router.push(`/add?context=tags&id=${id}`)} />
      <SortMenu
        visible={sortMenuOpen}
        current={sortOrder}
        onPick={pickSortOrder}
        onClose={() => setSortMenuOpen(false)}
      />
      <TagPickerSheet
        visible={!!picker}
        title={picker?.item.title ?? 'Item'}
        tags={picker?.kind === 'reading' ? readingTags : taskTags}
        currentStatus={picker?.item.status ?? ''}
        onPick={(tagId) => applyStatus(picker!.kind, picker!.item.id, tagId)}
        onClose={() => setPicker(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 112 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 4 },
  summary: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    marginBottom: 8,
  },
  summaryPct: { fontSize: 28, fontWeight: '700' },
  hint: { fontSize: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700' },
  empty: { fontSize: 14 },
  itemContainer: { marginBottom: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  selectCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  itemMain: { flexShrink: 1, gap: 2, flexGrow: 1 },
  itemTitle: { fontSize: 15, fontWeight: '500' },
  itemWeek: { fontSize: 12 },
  tagWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagDot: { width: 10, height: 10, borderRadius: 5 },
  tagName: { fontSize: 13 },
});
