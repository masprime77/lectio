import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import {
  convertItemKind,
  courseProgress,
  deleteItem,
  editItem as editItemFields,
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

/**
 * How the course screen groups its items — the mobile side of the desktop
 * header's By Week / By Type toggle. Either way a section holds one flat list:
 *  - 'type' — a Readings section and a Tasks section, each every item of that
 *    kind ordered by week, every row captioned with the week it belongs to.
 *  - 'week' — one section per week, listing that week's readings then tasks,
 *    every row captioned with which of the two it is.
 */
export type GroupMode = 'week' | 'type';

// Type-first is what this screen has always shown, so an existing user opens a
// course to the same thing after the update and picks By Week when they want
// it. (The desktop board defaults to By Week; a course column and a phone
// screen aren't the same amount of room.)
export const DEFAULT_GROUP_MODE: GroupMode = 'type';

const GROUP_MODES: readonly string[] = ['week', 'type'];

/** A saved grouping mode, or the default for anything missing/unrecognised. */
function parseGroupMode(raw: string | null): GroupMode {
  return raw && GROUP_MODES.includes(raw) ? (raw as GroupMode) : DEFAULT_GROUP_MODE;
}

// ---------------------------------------------------------------------------
// Week grouping
//
// Mirrors the desktop course view's collapsible week sections. The date maths
// is the mobile-side equivalent of app.js's weekStart/formatDate/currentWeek —
// core has no week/date helper to share, and these are three lines each.
// ---------------------------------------------------------------------------

/**
 * Where a dragged item should end up. The two groupings drop into each other's
 * blind spot: a By Week section knows only the week (its rows keep whatever
 * kind they are), and a By Type section knows only the kind (its rows keep
 * whatever week they are).
 */
export interface DropTarget {
  /**
   * Destination week: a number, null for the trailing "No week" section, or
   * undefined to keep the item's own — what a By Type section offers, since it
   * stands for a kind and no particular week.
   */
  week?: number | null;
  /** Destination kind, or null to keep the item's own. */
  kind: Kind | null;
}

/** The part of a section the expand/collapse handlers need. */
export interface CollapsibleSection {
  /** Stable per (course, section) — also the persistence key. */
  key: string;
  open: boolean;
}

/** An item and the kind it is — what a list mixing both renders from. */
export interface WeekEntry {
  kind: Kind;
  item: PlannerItem;
}

/**
 * One week's readings *and* tasks — a section of the By Week grouping (or the
 * trailing "no week" section when `week` is null).
 */
export interface WeekSection extends CollapsibleSection {
  week: number | null;
  title: string;
  /** "Apr 7 – Apr 13", or '' for the no-week section. */
  range: string;
  /** The week's whole list, flat: its readings first, then its tasks. */
  items: WeekEntry[];
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
  /**
   * The one kind the selection is made of, or null when it is empty or mixed —
   * what gates the batch "Tag" action (see selectionKind below).
   */
  selectionKind: Kind | null;
  picker: { kind: Kind; item: PlannerItem } | null;
  /** Which tag list the batch tag sheet is showing; null when it is closed. */
  batchTagKind: Kind | null;
  weekEditorOpen: boolean;
  sortOrder: SortOrder;
  sortMenuOpen: boolean;
  groupMode: GroupMode;
  groupMenuOpen: boolean;
  timeEditorOpen: boolean;
  /** By Type: every item of one kind, flat, ordered by week. */
  sectionItems: (kind: Kind) => PlannerItem[];
  /** By Week: every week that has an item, readings and tasks together. */
  weekSections: () => WeekSection[];
  toggleWeek: (group: CollapsibleSection) => void;
  /** Bulk expand/collapse — the desktop header's chevrons-down/up buttons. */
  setWeeksOpen: (groups: CollapsibleSection[], open: boolean) => void;
  toggleEditing: () => void;
  toggleSelect: (itemId: string) => void;
  confirmDeleteItem: (kind: Kind, item: PlannerItem) => void;
  showItemActions: (kind: Kind, item: PlannerItem) => void;
  editItem: (kind: Kind, item: PlannerItem) => void;
  /** Open the add form for `kind`, on `week` when the caller stands for one. */
  pushAddItem: (kind: Kind, week?: number) => void;
  batchDelete: () => void;
  /** Tag every selected item (single-kind selections only), in one save. */
  applyBatchTag: (tagId: string) => void;
  /** Move every selected item into `week`, in one save. */
  applyBatchWeek: (week: number) => void;
  /** Ask which kind the selection should become, then convert it in one save. */
  showBatchKindActions: () => void;
  /** Move one dragged item into another section, in one save. */
  moveItem: (from: Kind, itemId: string, target: DropTarget) => void;
  handleExportCourse: () => void;
  handleSaveStudyTime: (seconds: number) => void;
  applyStatus: (kind: Kind, itemId: string | undefined, tagId: string) => void;
  pickSortOrder: (order: SortOrder) => void;
  pickGroupMode: (mode: GroupMode) => void;
  setPicker: (p: { kind: Kind; item: PlannerItem } | null) => void;
  setBatchTagKind: (kind: Kind | null) => void;
  setWeekEditorOpen: (open: boolean) => void;
  setSortMenuOpen: (open: boolean) => void;
  setGroupMenuOpen: (open: boolean) => void;
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
  // The batch editors: the tag sheet reuses TagPickerSheet with the whole
  // selection behind it, the week editor is a numeric prompt.
  const [batchTagKind, setBatchTagKind] = useState<Kind | null>(null);
  const [weekEditorOpen, setWeekEditorOpen] = useState(false);
  const [sortOrder, pickSortOrder] = useSortOrder();
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [groupMode, setGroupMode] = useState<GroupMode>(DEFAULT_GROUP_MODE);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
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
    // The grouping is device-local UI state, like the sort order: restored once
    // per mount so a relaunch opens the course the way the user left it.
    prefs.getCourseGrouping().then((raw) => {
      if (active) setGroupMode(parseGroupMode(raw));
    });
    return () => {
      active = false;
    };
  }, []);

  // Takes the group as rendered rather than just its key: an untouched section
  // has no stored value, so the first tap has to flip what is actually on
  // screen (the resolved default), not `undefined`.
  const toggleWeek = useCallback((group: CollapsibleSection) => {
    setOpenWeeks((prev) => {
      const next = { ...prev, [group.key]: !group.open };
      void prefs.setOpenCourseWeeks(JSON.stringify(next));
      return next;
    });
  }, []);

  // Writes an explicit value for every group in the section, so the sections
  // the user has never touched stop following the current-week default too.
  const setWeeksOpen = useCallback((groups: CollapsibleSection[], open: boolean) => {
    setOpenWeeks((prev) => {
      const next = { ...prev };
      groups.forEach((g) => {
        next[g.key] = open;
      });
      void prefs.setOpenCourseWeeks(JSON.stringify(next));
      return next;
    });
  }, []);

  const course = semester ? getCourses(semester).find((c) => c.id === courseId) : undefined;
  const readingTags = semester ? getReadingTags(semester) : [];
  const taskTags = semester ? getTaskTags(semester) : [];
  const progress = course && semester ? courseProgress(course, semester) : 0;
  const hasItems = !!course && (course.readings.length > 0 || course.tasks.length > 0);

  // How the selection splits across the two sections. Selected ids that no
  // longer exist (deleted from another device mid-edit) simply don't count.
  const selectionKind = useMemo<Kind | null>(() => {
    if (!course || selected.size === 0) return null;
    const readings = course.readings.some((it) => !!it.id && selected.has(it.id));
    const tasks = course.tasks.some((it) => !!it.id && selected.has(it.id));
    // Batch "Tag" is offered only while the selection is all readings or all
    // tasks: reading tags and task tags are two independent lists, so a mixed
    // selection has no single list to pick from — merging both into one sheet
    // would let a reading tag land on a task, which the data model doesn't
    // allow. Deselecting one kind is a cheap way out for the user, so the
    // action is simply disabled until the selection is one kind. Week and kind
    // changes have no such constraint and stay available for mixed selections.
    if (readings && tasks) return null;
    return readings ? 'reading' : tasks ? 'task' : null;
  }, [course, selected]);

  // The By Type grouping: one section per kind, holding every item of it in one
  // flat list — the week each row belongs to is the caption the row already
  // carries, so nothing is grouped under week headers on top of that (the
  // desktop type grouping is the same shape). Ordered by week, reversed for the
  // week-desc sort order, with anything that has no week trailing in both
  // directions rather than jumping to the top for week-desc.
  const sectionItems = useCallback(
    (kind: Kind): PlannerItem[] => {
      if (!course) return [];
      const items = kind === 'reading' ? course.readings : course.tasks;
      const dir = sortOrder === 'week-desc' ? -1 : 1;
      const dated = items.filter((it) => typeof it.week === 'number');
      const noWeek = items.filter((it) => typeof it.week !== 'number');
      // Only the week decides, and sort is stable, so items sharing a week keep
      // the order they were stored in. Display-only: a new array either way.
      dated.sort((a, b) => ((a.week as number) - (b.week as number)) * dir);
      return [...dated, ...noWeek];
    },
    [course, sortOrder]
  );

  // The By Week grouping: one section per week that has anything in it, each
  // holding that week's readings and then its tasks in one flat list — which of
  // the two an item is is the caption the row carries, so there are no
  // Readings/Tasks sub-headings inside a week. Ascending by week, reversed for
  // the week-desc sort order (the desktop course view does the same), with
  // anything that has no week in a trailing section so it can never be lost off
  // the bottom of the screen. The sections span both kinds, so they get their
  // own keys ("<course>:week:<n>") — the only collapsible sections this screen
  // has now, and the only ones whose open/closed state is persisted.
  const weekSections = useCallback((): WeekSection[] => {
    if (!course || !semester) return [];
    const active = currentWeek(semester);

    // Readings are collected before tasks, so each bucket comes out in the
    // order its week lists them: readings first, then tasks.
    const byWeek = new Map<number, WeekEntry[]>();
    const noWeek: WeekEntry[] = [];
    const collect = (items: PlannerItem[], kind: Kind) => {
      items.forEach((item) => {
        if (typeof item.week === 'number') {
          const bucket = byWeek.get(item.week);
          if (bucket) bucket.push({ kind, item });
          else byWeek.set(item.week, [{ kind, item }]);
        } else {
          noWeek.push({ kind, item });
        }
      });
    };
    collect(course.readings, 'reading');
    collect(course.tasks, 'task');

    const weeks = [...byWeek.keys()].sort((a, b) => a - b);
    if (sortOrder === 'week-desc') weeks.reverse();

    const sections: WeekSection[] = weeks.map((week) => {
      const key = `${course.id}:week:${week}`;
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
      const key = `${course.id}:week:none`;
      sections.push({
        key,
        week: null,
        title: 'No week',
        range: '',
        items: noWeek,
        // These have no week to compare against the current one, so they start
        // open rather than hiding items with nowhere else to appear.
        open: openWeeks[key] ?? true,
      });
    }
    return sections;
  }, [course, semester, sortOrder, openWeeks]);

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

  const pickGroupMode = useCallback((mode: GroupMode) => {
    setGroupMode(mode);
    void prefs.setCourseGrouping(mode);
  }, []);

  function toggleEditing() {
    setEditing((e) => !e);
    setSelected(new Set());
    // Leaving editing mode takes the batch editors with it — they act on a
    // selection that no longer exists.
    setBatchTagKind(null);
    setWeekEditorOpen(false);
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

  // `week` comes from the per-week add buttons, which stand for one week and so
  // have to open the form on it (the desktop week body's "+ Reading"/"+ Task"
  // pass the same thing). The section-level buttons pass nothing and the form
  // keeps its own default.
  function pushAddItem(kind: Kind, week?: number) {
    if (!semester) return;
    const weekParam = typeof week === 'number' ? `&week=${week}` : '';
    router.push(
      `/semester/item-form?id=${semester.id}&courseId=${courseId}&kind=${kind}${weekParam}`
    );
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

  // Every batch action runs over one clone of the semester and persists once:
  // the selection can be dozens of items, and one write per item would be dozens
  // of cloud round-trips (and dozens of chances to hit a write conflict).
  // Editing mode and the selection stay as they are afterwards, so several
  // batch edits can be chained on the same items.
  const mutateSelection = useCallback(
    (apply: (course: Course, itemIds: string[]) => void) => {
      if (!semester || selected.size === 0) return;
      const next: Semester = JSON.parse(JSON.stringify(semester));
      const c = getCourses(next).find((x) => x.id === courseId);
      if (!c) return;
      apply(c, [...selected]);
      onPersist(next);
    },
    [semester, selected, courseId, onPersist]
  );

  const applyBatchTag = useCallback(
    (tagId: string) => {
      const kind = selectionKind;
      if (!kind) return;
      mutateSelection((c, ids) => ids.forEach((id) => setItemStatus(c, kind, id, tagId)));
      setBatchTagKind(null);
    },
    [mutateSelection, selectionKind]
  );

  const applyBatchWeek = useCallback(
    (week: number) => {
      // The id lives in exactly one of the two arrays, so the miss is a no-op —
      // cheaper than working out each item's kind first.
      mutateSelection((c, ids) =>
        ids.forEach((id) => {
          editItemFields(c, 'reading', id, { week });
          editItemFields(c, 'task', id, { week });
        })
      );
      setWeekEditorOpen(false);
    },
    [mutateSelection]
  );

  const applyBatchKind = useCallback(
    (toKind: Kind) => {
      // convertItemKind ignores the items already of that kind, so a mixed
      // selection converges on `toKind` rather than flipping every item.
      mutateSelection((c, ids) => ids.forEach((id) => convertItemKind(c, id, toKind)));
    },
    [mutateSelection]
  );

  // Two options plus Cancel — the most an Android alert can show, and the same
  // shape as showItemActions. The message warns about the tag because the two
  // tag lists are separate: a converted item restarts at the target kind's
  // pending tag (see convertItemKind).
  const showBatchKindActions = useCallback(() => {
    const count = selected.size;
    if (count === 0) return;
    Alert.alert(
      `Change kind of ${count} ${count === 1 ? 'item' : 'items'}`,
      'Converted items go back to the pending tag of their new kind.',
      [
        { text: 'Make readings', onPress: () => applyBatchKind('reading') },
        { text: 'Make tasks', onPress: () => applyBatchKind('task') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [applyBatchKind, selected]);

  // Drop a dragged item into another section: it takes that section's week, and
  // its kind too when the section is a kind (By Type). Same semantics as the
  // desktop board's drag and drop, and the same one-save-per-drop rule as the
  // batch actions — the drop is a single onPersist, so one cloud write.
  const moveItem = useCallback(
    (from: Kind, itemId: string, target: DropTarget) => {
      if (!semester || !course || !itemId) return;
      const toKind = target.kind ?? from;
      const current = (from === 'reading' ? course.readings : course.tasks).find(
        (it) => it.id === itemId
      );
      if (!current) return;
      const fromWeek = typeof current.week === 'number' ? current.week : null;
      const toWeek = target.week === undefined ? fromWeek : target.week;
      // Dropping an item back into the section it came from is not a save.
      if (toKind === from && fromWeek === toWeek) return;

      const next: Semester = JSON.parse(JSON.stringify(semester));
      const c = getCourses(next).find((x) => x.id === courseId);
      if (!c) return;
      const item = (from === 'reading' ? c.readings : c.tasks).find((it) => it.id === itemId);
      if (!item) return;
      // The week goes on first: convertItemKind keeps the item object (and its
      // id) as it moves between the two arrays, so the new week travels with it.
      if (toWeek === null) delete item.week;
      else item.week = toWeek;
      if (toKind !== from) convertItemKind(c, itemId, toKind);

      // Open the week the item just landed in. A collapsed section is a
      // perfectly good target — its header is all there is to aim at — and the
      // week may not have been on screen at all. The key shape is the one
      // weekSections() builds; the type grouping has no collapsible sections,
      // so there is nothing to open there.
      if (groupMode === 'week') {
        const destKey = `${courseId}:week:${toWeek ?? 'none'}`;
        setOpenWeeks((prev) => {
          const nextOpen = { ...prev, [destKey]: true };
          void prefs.setOpenCourseWeeks(JSON.stringify(nextOpen));
          return nextOpen;
        });
      }

      onPersist(next);
    },
    [semester, course, courseId, groupMode, onPersist]
  );

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
    selectionKind,
    picker,
    batchTagKind,
    weekEditorOpen,
    sortOrder,
    sortMenuOpen,
    groupMode,
    groupMenuOpen,
    timeEditorOpen,
    sectionItems,
    weekSections,
    toggleWeek,
    setWeeksOpen,
    toggleEditing,
    toggleSelect,
    confirmDeleteItem,
    showItemActions,
    editItem,
    pushAddItem,
    batchDelete,
    applyBatchTag,
    applyBatchWeek,
    showBatchKindActions,
    moveItem,
    handleExportCourse,
    handleSaveStudyTime,
    applyStatus,
    pickSortOrder,
    pickGroupMode,
    setPicker,
    setBatchTagKind,
    setWeekEditorOpen,
    setSortMenuOpen,
    setGroupMenuOpen,
    setTimeEditorOpen,
  };
}
