import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { prefs } from '../../lib/prefs';
import * as transfer from '../../lib/transfer';
import type { Course, PlannerItem, Semester, SortOrder, Tag } from '../../../types/lectio-core';

export type Kind = 'reading' | 'task';

// Week orders sort the readings/tasks by their week (display-only: returns a
// new array, the on-disk item order is untouched). The other orders affect
// the courses list, not item ordering, so items keep their stored order.
//
// Now that items are grouped under week headers this is only reached for a
// flat list; inside a group every item shares one week, so it would be a no-op.
// What week-asc/week-desc control on this screen is the order the *groups* are
// listed in — see weekGroups() below, mirroring how the desktop course view
// reverses its week numbers for week-desc.
export function sortedItems(items: PlannerItem[], order: SortOrder): PlannerItem[] {
  if (order !== 'week-asc' && order !== 'week-desc') return items;
  const dir = order === 'week-desc' ? -1 : 1;
  const week = (it: PlannerItem) =>
    typeof it.week === 'number' ? it.week : Number.MAX_SAFE_INTEGER;
  return [...items].sort((a, b) => (week(a) - week(b)) * dir);
}

// ---------------------------------------------------------------------------
// Week grouping
//
// Mirrors the desktop course view's collapsible week sections. The date maths
// is the mobile-side equivalent of app.js's weekStart/formatDate/currentWeek —
// core has no week/date helper to share, and these are three lines each.
// ---------------------------------------------------------------------------

/** Items of one week (or the trailing "no week" group when `week` is null). */
export interface WeekGroup {
  /** Stable per (course, section, week) — also the persistence key. */
  key: string;
  week: number | null;
  title: string;
  /** "Apr 7 – Apr 13", or '' for the no-week group. */
  range: string;
  items: PlannerItem[];
  open: boolean;
}

function weekStart(startDate: string, week: number): Date {
  const d = new Date(startDate + 'T00:00:00');
  d.setDate(d.getDate() + (week - 1) * 7);
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Empty for a semester with no start date — the header then shows the week
// number alone rather than an "Invalid Date" range.
function weekRange(startDate: string | undefined, week: number): string {
  if (!startDate) return '';
  const start = weekStart(startDate, week);
  const end = weekStart(startDate, week);
  end.setDate(end.getDate() + 6);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** Which week of the semester "today" falls in, or 0 when outside it. */
export function currentWeek(semester: Semester | null): number {
  if (!semester || !semester.startDate || typeof semester.weeks !== 'number') return 0;
  const start = new Date(semester.startDate + 'T00:00:00');
  const diffDays = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
  const wk = Math.floor(diffDays / 7) + 1;
  if (wk < 1 || wk > semester.weeks) return 0;
  return wk;
}

function parseOpenWeeks(raw: string | null): Record<string, boolean> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'boolean') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
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
  /** This section's items, split into collapsible week groups. */
  weekGroups: (kind: Kind) => WeekGroup[];
  toggleWeek: (group: WeekGroup) => void;
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

  // Which week sections the user has explicitly toggled, restored from
  // AsyncStorage so the screen looks the same when they come back to it.
  // Sections they have never touched are absent and fall back to the default.
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    prefs.getOpenCourseWeeks().then((raw) => {
      if (active) setOpenWeeks(parseOpenWeeks(raw));
    });
    return () => {
      active = false;
    };
  }, []);

  // Takes the group as rendered rather than just its key: an untouched section
  // has no stored value, so the first tap has to flip what is actually on
  // screen (the resolved default), not `undefined`.
  const toggleWeek = useCallback((group: WeekGroup) => {
    setOpenWeeks((prev) => {
      const next = { ...prev, [group.key]: !group.open };
      void prefs.setOpenCourseWeeks(JSON.stringify(next));
      return next;
    });
  }, []);

  const course = semester ? getCourses(semester).find((c) => c.id === courseId) : undefined;
  const readingTags = semester ? getReadingTags(semester) : [];
  const taskTags = semester ? getTaskTags(semester) : [];
  const progress = course && semester ? courseProgress(course, semester) : 0;
  const hasItems = !!course && (course.readings.length > 0 || course.tasks.length > 0);

  // Split a section's items into week groups, in the order they should be
  // listed: ascending by week, reversed for the week-desc sort order (the
  // desktop course view does the same), with anything that has no week in a
  // trailing group so it can never be lost off the bottom of the screen.
  const weekGroups = useCallback(
    (kind: Kind): WeekGroup[] => {
      if (!course || !semester) return [];
      const items = kind === 'reading' ? course.readings : course.tasks;
      const active = currentWeek(semester);

      const byWeek = new Map<number, PlannerItem[]>();
      const noWeek: PlannerItem[] = [];
      items.forEach((item) => {
        if (typeof item.week === 'number') {
          const bucket = byWeek.get(item.week);
          if (bucket) bucket.push(item);
          else byWeek.set(item.week, [item]);
        } else {
          noWeek.push(item);
        }
      });

      const weeks = [...byWeek.keys()].sort((a, b) => a - b);
      if (sortOrder === 'week-desc') weeks.reverse();

      const groups: WeekGroup[] = weeks.map((week) => {
        const key = `${course.id}:${kind}:${week}`;
        return {
          key,
          week,
          title: `Week ${week}`,
          range: weekRange(semester.startDate, week),
          items: byWeek.get(week) ?? [],
          // Untouched sections follow the desktop default: only the week the
          // semester is currently in starts open.
          open: openWeeks[key] ?? week === active,
        };
      });

      if (noWeek.length > 0) {
        const key = `${course.id}:${kind}:none`;
        groups.push({
          key,
          week: null,
          title: 'No week',
          range: '',
          items: noWeek,
          // These have no week to compare against the current one, and used to
          // be visible in the flat list, so they start open.
          open: openWeeks[key] ?? true,
        });
      }
      return groups;
    },
    [course, semester, sortOrder, openWeeks]
  );

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
    weekGroups,
    toggleWeek,
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
