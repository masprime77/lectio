import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import {
  courseProgress,
  deleteItem,
  getCourses,
  getReadingTags,
  getTaskTags,
  setItemStatus,
} from '@lectio/core/planner-core';
import { setStudyTime } from '@lectio/core/pomodoro-core';
import { useSortOrder } from '../../lib/use-sort-order';
import * as transfer from '../../lib/transfer';
import type { Course, PlannerItem, Semester, SortOrder, Tag } from '../../../types/lectio-core';

export type Kind = 'reading' | 'task';

// Week orders sort the readings/tasks by their week (display-only: returns a
// new array, the on-disk item order is untouched). The other orders affect
// the courses list, not item ordering, so items keep their stored order.
export function sortedItems(items: PlannerItem[], order: SortOrder): PlannerItem[] {
  if (order !== 'week-asc' && order !== 'week-desc') return items;
  const dir = order === 'week-desc' ? -1 : 1;
  const week = (it: PlannerItem) =>
    typeof it.week === 'number' ? it.week : Number.MAX_SAFE_INTEGER;
  return [...items].sort((a, b) => (week(a) - week(b)) * dir);
}

export interface UseCourseDetailResult {
  semester: Semester | null;
  course: Course | undefined;
  readingTags: Tag[];
  taskTags: Tag[];
  progress: number;
  hasItems: boolean;
  editing: boolean;
  selected: Set<string>;
  picker: { kind: Kind; item: PlannerItem } | null;
  sortOrder: SortOrder;
  sortMenuOpen: boolean;
  timeEditorOpen: boolean;
  toggleEditing: () => void;
  toggleSelect: (itemId: string) => void;
  confirmDeleteItem: (kind: Kind, item: PlannerItem) => void;
  showItemActions: (kind: Kind, item: PlannerItem) => void;
  editItem: (kind: Kind, item: PlannerItem) => void;
  pushAddItem: (kind: Kind) => void;
  batchDelete: () => void;
  handleExportCourse: () => void;
  handleSaveStudyTime: (seconds: number) => void;
  applyStatus: (kind: Kind, itemId: string | undefined, tagId: string) => void;
  pickSortOrder: (order: SortOrder) => void;
  setPicker: (p: { kind: Kind; item: PlannerItem } | null) => void;
  setSortMenuOpen: (open: boolean) => void;
  setTimeEditorOpen: (open: boolean) => void;
}

export function useCourseDetail(
  semester: Semester | null,
  courseId: string,
  onPersist: (next: Semester) => void
): UseCourseDetailResult {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [picker, setPicker] = useState<{ kind: Kind; item: PlannerItem } | null>(null);
  const [sortOrder, pickSortOrder] = useSortOrder();
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  // Hand-corrected studied time (the timer is not the only way to study).
  const [timeEditorOpen, setTimeEditorOpen] = useState(false);

  const course = semester ? getCourses(semester).find((c) => c.id === courseId) : undefined;
  const readingTags = semester ? getReadingTags(semester) : [];
  const taskTags = semester ? getTaskTags(semester) : [];
  const progress = course && semester ? courseProgress(course, semester) : 0;
  const hasItems = !!course && (course.readings.length > 0 || course.tasks.length > 0);

  function handleSaveStudyTime(seconds: number) {
    if (!semester) return;
    const next: Semester = JSON.parse(JSON.stringify(semester));
    const c = getCourses(next).find((x) => x.id === courseId);
    if (!c) return;
    setStudyTime(c, seconds);
    onPersist(next);
    setTimeEditorOpen(false);
  }

  // Set an item's tag to the one picked in the sheet, persist, and re-render.
  // Writes the same item.status id the desktop's tag menu writes.
  const applyStatus = useCallback(
    (kind: Kind, itemId: string | undefined, tagId: string) => {
      if (!semester || !itemId) return;
      const next: Semester = JSON.parse(JSON.stringify(semester));
      const c = getCourses(next).find((x) => x.id === courseId);
      if (!c) return;
      setItemStatus(c, kind, itemId, tagId);
      onPersist(next);
      setPicker(null);
    },
    [semester, courseId, onPersist]
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
          onPersist(next);
        },
      },
    ]);
  }

  function editItem(kind: Kind, item: PlannerItem) {
    if (!semester) return;
    router.push(
      `/semester/item-form?id=${semester.id}&courseId=${courseId}&kind=${kind}&itemId=${item.id}`
    );
  }

  function showItemActions(kind: Kind, item: PlannerItem) {
    Alert.alert(item.title ?? 'Item', undefined, [
      { text: 'Edit', onPress: () => editItem(kind, item) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteItem(kind, item) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function pushAddItem(kind: Kind) {
    if (!semester) return;
    router.push(`/semester/item-form?id=${semester.id}&courseId=${courseId}&kind=${kind}`);
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
            onPersist(next);
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

  return {
    semester,
    course,
    readingTags,
    taskTags,
    progress,
    hasItems,
    editing,
    selected,
    picker,
    sortOrder,
    sortMenuOpen,
    timeEditorOpen,
    toggleEditing,
    toggleSelect,
    confirmDeleteItem,
    showItemActions,
    editItem,
    pushAddItem,
    batchDelete,
    handleExportCourse,
    handleSaveStudyTime,
    applyStatus,
    pickSortOrder,
    setPicker,
    setSortMenuOpen,
    setTimeEditorOpen,
  };
}
