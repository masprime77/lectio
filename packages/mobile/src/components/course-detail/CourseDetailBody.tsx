import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  measure,
  runOnJS,
  scrollTo,
  useAnimatedRef,
  useAnimatedStyle,
  useFrameCallback,
  useScrollViewOffset,
  useSharedValue,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { formatHoursMinutes, getCourseStudySeconds } from '@lectio/core/pomodoro-core';
import { useTheme } from '../../theme';
import { Fab } from '../Fab';
import {
  NumericKeyboardDoneBar,
  NUMERIC_KEYBOARD_ACCESSORY_ID,
} from '../NumericKeyboardDoneBar';
import { PomodoroFab } from '../../pomodoro/PomodoroFab';
import { StudyTimeEditor } from '../../pomodoro/StudyTimeEditor';
import { GroupMenu } from '../GroupMenu';
import { ProgressBar } from '../ProgressBar';
import { SortMenu } from '../SortMenu';
import { SwipeableRow } from '../SwipeableRow';
import { TagPickerSheet } from '../TagPickerSheet';
import type {
  CollapsibleSection,
  DropTarget,
  Kind,
  UseCourseDetailResult,
  WeekGroup,
  WeekSection,
} from './useCourseDetail';
import type { PlannerItem, Tag } from '../../../types/lectio-core';

// ---------------------------------------------------------------------------
// Drag and drop
//
// Long-press a row to lift it, then drag it onto another section to move it
// there — the phone's version of the desktop board's drag and drop. A By Week
// section sets the week; a By Type week group sets the week *and* the kind,
// since the section it hangs under is the kind.
//
// It is deliberately gated behind editing (multi-select) mode. Outside it every
// gesture on a row is already taken: a tap opens the tag picker, a long-press
// opens the Edit/Delete actions, and a horizontal swipe is SwipeableRow's. A
// drag would have to take one of those away from the user. Inside editing mode
// nothing is lost — swiping is already disabled there, long-press is unused,
// and tapping still selects — so that is where the lift lives.
// ---------------------------------------------------------------------------

/** How long a press has to be held before the row lifts. */
const LIFT_DELAY_MS = 220;
/** Distance from a viewport edge at which a held drag scrolls the list. */
const AUTOSCROLL_EDGE = 90;
/** Pixels per frame the list scrolls while the finger sits in that band. */
const AUTOSCROLL_STEP = 7;

/** A section's rectangle, in ScrollView *content* coordinates. */
interface Zone {
  key: string;
  top: number;
  height: number;
}

/** What a lifted row needs from the screen around it. */
interface DragContext {
  scrollRef: AnimatedRef<Animated.ScrollView>;
  scrollOffset: SharedValue<number>;
  /** The ScrollView's own position on screen, measured when a drag starts. */
  viewportTop: SharedValue<number>;
  viewportHeight: SharedValue<number>;
  zones: SharedValue<Zone[]>;
  pointerY: SharedValue<number>;
  /** The section under the finger, or null over the row's own section. */
  activeZone: SharedValue<string | null>;
  sourceZone: SharedValue<string | null>;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export interface CourseDetailBodyProps {
  result: UseCourseDetailResult;
  /** true when rendered inside the Part C tablet split-pane (no native
   * Stack.Screen header exists in that context — currently unused inside
   * this component itself since the header lives in a sibling component,
   * but kept for future layout tweaks specific to the embedded case). */
  embedded?: boolean;
}

export function CourseDetailBody({ result }: CourseDetailBodyProps) {
  const theme = useTheme();
  const router = useRouter();

  // --- Drag and drop -------------------------------------------------------
  // Everything here runs before the "course not found" bail-out below: hooks
  // cannot sit behind a conditional return, and the section lists are empty
  // without a course anyway.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);
  const viewportTop = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const zones = useSharedValue<Zone[]>([]);
  const pointerY = useSharedValue(0);
  const activeZone = useSharedValue<string | null>(null);
  const sourceZone = useSharedValue<string | null>(null);
  // Scrolling is locked while a row is lifted (the drag owns the finger); the
  // list still follows it through the frame callback's auto-scroll.
  const [dragging, setDragging] = useState(false);
  // The zone table twice over: the shared copy the UI thread hit-tests against,
  // and the destinations the JS side needs once a row is dropped.
  const zoneRects = useRef<Record<string, Zone>>({});
  const zoneTargets = useRef<Record<string, DropTarget>>({});

  const registerZone = useCallback(
    (key: string, target: DropTarget, top: number, height: number) => {
      zoneTargets.current[key] = target;
      zoneRects.current[key] = { key, top, height };
      zones.value = Object.values(zoneRects.current);
    },
    [zones]
  );

  // Hit-testing and auto-scroll, once per frame while a row is lifted. It runs
  // on the UI thread against the shared zone table, so a drag never re-renders
  // the list — only the highlight, which is an animated style.
  const dragFrame = useFrameCallback(() => {
    'worklet';
    const top = viewportTop.value;
    const y = pointerY.value;
    if (y < top + AUTOSCROLL_EDGE) {
      scrollTo(scrollRef, 0, Math.max(0, scrollOffset.value - AUTOSCROLL_STEP), false);
    } else if (y > top + viewportHeight.value - AUTOSCROLL_EDGE) {
      scrollTo(scrollRef, 0, scrollOffset.value + AUTOSCROLL_STEP, false);
    }
    // Sections are measured in content coordinates, so the finger has to be
    // converted into them before anything can be compared.
    const contentY = y - top + scrollOffset.value;
    const list = zones.value;
    let hit: string | null = null;
    for (let i = 0; i < list.length; i++) {
      const zone = list[i];
      if (contentY >= zone.top && contentY <= zone.top + zone.height) {
        hit = zone.key;
        break;
      }
    }
    // The row's own section is not a destination, so it never lights up.
    activeZone.value = hit === sourceZone.value ? null : hit;
  }, false);

  // These three are what a row's gesture is built from, so they must not change
  // identity: lifting a row re-renders the screen (scrolling locks), and a
  // gesture rebuilt underneath an active drag would drop it. Reading the moving
  // parts through refs keeps every callback below stable for the whole drag.
  const resultRef = useRef(result);
  resultRef.current = result;
  const dragFrameRef = useRef(dragFrame);
  dragFrameRef.current = dragFrame;

  const handleDragStart = useCallback(() => {
    setDragging(true);
    dragFrameRef.current.setActive(true);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragFrameRef.current.setActive(false);
    setDragging(false);
  }, []);

  const handleDrop = useCallback((kind: Kind, itemId: string, zoneKey: string) => {
    const target = zoneTargets.current[zoneKey];
    // moveItem opens the destination section itself — it is the only side that
    // knows which week the item ends up in when the target keeps its own.
    if (target) resultRef.current.moveItem(kind, itemId, target);
  }, []);

  const dragContext = useMemo<DragContext>(
    () => ({
      scrollRef,
      scrollOffset,
      viewportTop,
      viewportHeight,
      zones,
      pointerY,
      activeZone,
      sourceZone,
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
    }),
    [
      scrollRef,
      scrollOffset,
      viewportTop,
      viewportHeight,
      zones,
      pointerY,
      activeZone,
      sourceZone,
      handleDragStart,
      handleDragEnd,
    ]
  );

  const byWeek = result.groupMode === 'week';
  const readingGroups = byWeek ? [] : result.weekGroups('reading');
  const taskGroups = byWeek ? [] : result.weekGroups('task');
  const weekSections = byWeek ? result.weekSections() : [];

  // Sections come and go as items move between them; a rect left behind by one
  // that no longer exists would be a hole the finger could land in. The empty
  // Readings/Tasks placeholders are zones too, so they belong on this list.
  const emptyKindKeys: string[] = [];
  if (!byWeek && result.course) {
    if (result.course.readings.length === 0) emptyKindKeys.push(`${result.course.id}:reading:empty`);
    if (result.course.tasks.length === 0) emptyKindKeys.push(`${result.course.id}:task:empty`);
  }
  const liveZoneKeys = (
    byWeek
      ? weekSections.map((s) => s.key)
      : [...readingGroups, ...taskGroups].map((g) => g.key).concat(emptyKindKeys)
  ).join('|');
  useEffect(() => {
    const live = new Set(liveZoneKeys.split('|'));
    Object.keys(zoneRects.current).forEach((key) => {
      if (live.has(key)) return;
      delete zoneRects.current[key];
      delete zoneTargets.current[key];
    });
    zones.value = Object.values(zoneRects.current);
  }, [liveZoneKeys, zones]);

  if (!result.course) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.muted }}>Course not found.</Text>
      </View>
    );
  }

  const { course, readingTags, taskTags, progress, editing, selected, selectionKind, picker } =
    result;

  // `showWeek` is off inside a By Week section, where the week is already the
  // header the row hangs under and repeating it on every row is just noise.
  // `zoneKey` is the section the row currently sits in — the one place a drag
  // is not allowed to drop it.
  const renderItem = (
    kind: Kind,
    item: PlannerItem,
    tags: Tag[],
    zoneKey: string,
    showWeek = true
  ) => {
    const tag = tags.find((t) => t.id === item.status);
    const row = (
      <SwipeableRow
        enabled={!editing}
        editColor={theme.accent}
        onEdit={item.id ? () => result.editItem(kind, item) : undefined}
        onDelete={item.id ? () => result.confirmDeleteItem(kind, item) : undefined}
        containerStyle={styles.itemContainer}
      >
        <Pressable
          onPress={() =>
            editing ? item.id && result.toggleSelect(item.id) : result.setPicker({ kind, item })
          }
          onLongPress={editing ? undefined : () => result.showItemActions(kind, item)}
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
            {showWeek && typeof item.week === 'number' && (
              <Text style={[styles.itemWeek, { color: theme.muted }]}>Week {item.week}</Text>
            )}
            {kind === 'task' && typeof item.dueDate === 'string' && item.dueDate !== '' && (
              <Text style={[styles.itemWeek, { color: theme.muted }]}>due {item.dueDate}</Text>
            )}
          </View>
          <View style={styles.tagWrap}>
            <View style={[styles.tagDot, { backgroundColor: tag?.color ?? theme.muted }]} />
            <Text style={[styles.tagName, { color: theme.muted }]}>
              {tag?.name ?? item.status}
            </Text>
          </View>
        </Pressable>
      </SwipeableRow>
    );
    return (
      <DraggableRow
        key={item.id}
        enabled={editing && !!item.id}
        kind={kind}
        itemId={item.id ?? ''}
        zoneKey={zoneKey}
        ctx={dragContext}
        onDrop={handleDrop}
      >
        {row}
      </DraggableRow>
    );
  };

  // A "Week N · Apr 7 – Apr 13" header with a chevron. Same idea as the desktop
  // course view's collapsible .course-week-header, and shared by both groupings
  // — only what hangs under it differs.
  const renderSectionHeader = (
    section: CollapsibleSection & { title: string; range: string },
    count: number
  ) => (
    <Pressable
      onPress={() => result.toggleWeek(section)}
      accessibilityRole="button"
      accessibilityState={{ expanded: section.open }}
      accessibilityLabel={`${section.title}, ${count} ${count === 1 ? 'item' : 'items'}`}
      accessibilityHint={section.open ? 'Collapses this week' : 'Expands this week'}
      style={({ pressed }) => [
        styles.weekHeader,
        { borderBottomColor: theme.border },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Chevron open={section.open} color={theme.muted} />
      <Text style={[styles.weekTitle, { color: theme.text }]}>{section.title}</Text>
      {/* Always rendered: it doubles as the flexible spacer that pushes the
          count to the right, and the no-week section has no date range. */}
      <Text style={[styles.weekRange, { color: theme.muted }]}>{section.range}</Text>
      <Text style={[styles.weekCount, { color: theme.muted }]}>{count}</Text>
    </Pressable>
  );

  // By Type: one week of a single section (Readings or Tasks) and its items.
  // Dropping a row here sets its week and, when it came from the other section,
  // its kind — the section it hangs under is the kind.
  const renderWeekGroup = (kind: Kind, group: WeekGroup, tags: Tag[]) => (
    <DropSection
      key={group.key}
      zoneKey={group.key}
      target={{ week: group.week, kind }}
      register={registerZone}
      activeZone={activeZone}
      sourceZone={sourceZone}
    >
      {renderSectionHeader(group, group.items.length)}
      {group.open && group.items.map((item) => renderItem(kind, item, tags, group.key))}
    </DropSection>
  );

  // By Week: one week of the course, its readings then its tasks. The kind
  // labels are the desktop week body's "Readings"/"Tasks" section titles; an
  // empty one is dropped rather than shown as a placeholder — a phone week
  // section is usually short and the label alone would be noise.
  // Dropping a row here only changes its week: the section holds both kinds, so
  // there is nothing in it to say what the item should become.
  const renderWeekSection = (section: WeekSection) => (
    <DropSection
      key={section.key}
      zoneKey={section.key}
      target={{ week: section.week, kind: null }}
      register={registerZone}
      activeZone={activeZone}
      sourceZone={sourceZone}
    >
      {renderSectionHeader(section, section.count)}
      {section.open && (
        <>
          {section.readings.length > 0 && (
            <>
              <Text style={[styles.kindLabel, { color: theme.muted }]}>Readings</Text>
              {section.readings.map((item) =>
                renderItem('reading', item, readingTags, section.key, false)
              )}
            </>
          )}
          {section.tasks.length > 0 && (
            <>
              <Text style={[styles.kindLabel, { color: theme.muted }]}>Tasks</Text>
              {section.tasks.map((item) => renderItem('task', item, taskTags, section.key, false))}
            </>
          )}
        </>
      )}
    </DropSection>
  );

  // "Expand all" / "Collapse all" for one section's week headers — the mobile
  // equivalent of the desktop header's chevrons-down/up buttons. Hidden when
  // there is at most one week to toggle.
  const renderCollapseAll = (groups: CollapsibleSection[]) => {
    if (groups.length < 2) return null;
    const allOpen = groups.every((g) => g.open);
    return (
      <Pressable
        onPress={() => result.setWeeksOpen(groups, !allOpen)}
        accessibilityRole="button"
        accessibilityLabel={allOpen ? 'Collapse all weeks' : 'Expand all weeks'}
        hitSlop={8}
        style={({ pressed }) => pressed && { opacity: 0.6 }}
      >
        <Text style={[styles.bulkToggle, { color: theme.muted }]}>
          {allOpen ? 'Collapse all' : 'Expand all'}
        </Text>
      </Pressable>
    );
  };

  // Top level of the By Week grouping: one "Week N · date range" section per
  // week that has anything in it, with the per-kind add buttons alongside the
  // expand/collapse-all control (there are no per-kind sections to hang them
  // off in this mode).
  const renderByWeek = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Weeks</Text>
        <View style={styles.sectionActions}>
          {renderCollapseAll(weekSections)}
          <Pressable onPress={() => result.pushAddItem('reading')}>
            <Text style={{ color: theme.accent, fontSize: 15 }}>+ Reading</Text>
          </Pressable>
          <Pressable onPress={() => result.pushAddItem('task')}>
            <Text style={{ color: theme.accent, fontSize: 15 }}>+ Task</Text>
          </Pressable>
        </View>
      </View>
      {weekSections.length === 0 ? (
        <Pressable onPress={() => result.pushAddItem('reading')}>
          <Text style={[styles.empty, { color: theme.muted }]}>
            No readings or tasks yet. Tap to add one.
          </Text>
        </Pressable>
      ) : (
        weekSections.map(renderWeekSection)
      )}
    </>
  );

  // An empty Readings/Tasks section is still a drop zone — it is the only way
  // to convert the last item of a kind by dragging, since a section with no
  // week groups has nothing else to aim at. It stands for the kind alone, so a
  // row dropped here keeps the week it already had.
  const renderEmptyKindSection = (kind: Kind, label: string) => (
    <DropSection
      zoneKey={`${course.id}:${kind}:empty`}
      target={{ kind }}
      register={registerZone}
      activeZone={activeZone}
      sourceZone={sourceZone}
    >
      <Pressable onPress={() => result.pushAddItem(kind)}>
        <Text style={[styles.empty, { color: theme.muted }]}>{label}</Text>
      </Pressable>
    </DropSection>
  );

  // Top level of the By Type grouping: a Readings section and a Tasks section,
  // each split into its own week groups.
  const renderByType = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Readings</Text>
        <View style={styles.sectionActions}>
          {renderCollapseAll(readingGroups)}
          <Pressable onPress={() => result.pushAddItem('reading')}>
            <Text style={{ color: theme.accent, fontSize: 15 }}>+ Add</Text>
          </Pressable>
        </View>
      </View>
      {course.readings.length === 0 ? (
        renderEmptyKindSection('reading', 'No readings. Tap to add one.')
      ) : (
        readingGroups.map((g) => renderWeekGroup('reading', g, readingTags))
      )}

      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Tasks</Text>
        <View style={styles.sectionActions}>
          {renderCollapseAll(taskGroups)}
          <Pressable onPress={() => result.pushAddItem('task')}>
            <Text style={{ color: theme.accent, fontSize: 15 }}>+ Add</Text>
          </Pressable>
        </View>
      </View>
      {course.tasks.length === 0 ? (
        renderEmptyKindSection('task', 'No tasks. Tap to add one.')
      ) : (
        taskGroups.map((g) => renderWeekGroup('task', g, taskTags))
      )}
    </>
  );

  return (
    <>
      <Animated.ScrollView
        ref={scrollRef}
        // A lifted row owns the finger; the list is moved by the drag's own
        // auto-scroll until it is dropped.
        scrollEnabled={!dragging}
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
              ? 'Tap items to select them, then edit or delete them together. Long-press one to drag it into another section.'
              : 'Tap an item to set its tag. Long-press to edit or delete.'}
          </Text>
          <Pressable
            onPress={() => result.setTimeEditorOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Edit studied time"
            style={({ pressed }) => pressed && { opacity: 0.6 }}
          >
            <Text style={[styles.studyTime, { color: theme.muted }]}>
              {formatHoursMinutes(getCourseStudySeconds(course))} studied · Edit
            </Text>
          </Pressable>
        </View>

        {byWeek ? renderByWeek() : renderByType()}
      </Animated.ScrollView>
      {/* Pinned rather than placed in the ScrollView: selecting items means
          scrolling, and a bar that scrolls away would send the user back to the
          top to act on what they just picked. Deleting stays in the header,
          away from the attribute edits. */}
      {editing && (
        <BatchBar
          count={selected.size}
          /* Mixed selections have no single tag list to offer — see
             selectionKind in useCourseDetail. */
          canTag={selectionKind !== null}
          onTag={() => selectionKind && result.setBatchTagKind(selectionKind)}
          onWeek={() => result.setWeekEditorOpen(true)}
          onKind={result.showBatchKindActions}
        />
      )}
      <StudyTimeEditor
        visible={result.timeEditorOpen}
        courseName={course.name}
        currentSeconds={getCourseStudySeconds(course)}
        onSave={result.handleSaveStudyTime}
        onClose={() => result.setTimeEditorOpen(false)}
      />
      {/* The floating buttons would sit under the batch bar (and neither starting
          a timer nor adding an item belongs in selection mode), so they step
          aside while editing. */}
      {!editing && (
        <>
          <PomodoroFab semester={result.semester} defaultCourseId={course.id} />
          {/* The "+" opens the add-sheet on the Tags tab; readings/tasks are added
              from the per-section "+ Add" controls next to the Readings/Tasks headers. */}
          <Fab onPress={() => router.push(`/add?context=tags&id=${result.semester?.id}`)} />
        </>
      )}
      <GroupMenu
        visible={result.groupMenuOpen}
        current={result.groupMode}
        onPick={result.pickGroupMode}
        onClose={() => result.setGroupMenuOpen(false)}
      />
      <SortMenu
        visible={result.sortMenuOpen}
        current={result.sortOrder}
        onPick={result.pickSortOrder}
        onClose={() => result.setSortMenuOpen(false)}
      />
      <TagPickerSheet
        visible={!!picker}
        title={picker?.item.title ?? 'Item'}
        tags={picker?.kind === 'reading' ? readingTags : taskTags}
        currentStatus={picker?.item.status ?? ''}
        onPick={(tagId) => result.applyStatus(picker!.kind, picker!.item.id, tagId)}
        onClose={() => result.setPicker(null)}
      />
      {/* The same sheet, aimed at the whole selection: one kind, so one tag
          list, and no current tag to check off (the items may disagree). */}
      <TagPickerSheet
        visible={editing && !!result.batchTagKind}
        title={`${selected.size} ${selected.size === 1 ? 'item' : 'items'}`}
        tags={result.batchTagKind === 'task' ? taskTags : readingTags}
        currentStatus=""
        onPick={result.applyBatchTag}
        onClose={() => result.setBatchTagKind(null)}
      />
      <BatchWeekSheet
        visible={editing && result.weekEditorOpen}
        count={selected.size}
        maxWeek={result.semester?.weeks}
        onSave={result.applyBatchWeek}
        onClose={() => result.setWeekEditorOpen(false)}
      />
    </>
  );
}

/**
 * One section of the list, and the drop zone that goes with it. It reports its
 * rectangle on every layout (in ScrollView content coordinates, since it is a
 * direct child of the content container) and outlines itself while a lifted row
 * is over it.
 */
function DropSection({
  zoneKey,
  target,
  register,
  activeZone,
  sourceZone,
  children,
}: {
  zoneKey: string;
  target: DropTarget;
  register: (key: string, target: DropTarget, top: number, height: number) => void;
  activeZone: SharedValue<string | null>;
  sourceZone: SharedValue<string | null>;
  children: ReactNode;
}) {
  const theme = useTheme();
  const highlight = useAnimatedStyle(() => {
    const over = activeZone.value === zoneKey;
    return {
      borderColor: over ? theme.accent : 'transparent',
      backgroundColor: over ? theme.surfaceAlt : 'transparent',
      // A row dragged out of this section leaves its bounds; raising the
      // section keeps it above the ones below rather than sliding under them
      // (a row's own zIndex only orders it against its siblings).
      zIndex: sourceZone.value === zoneKey ? 30 : 0,
    };
  });
  return (
    <Animated.View
      onLayout={(e) =>
        register(zoneKey, target, e.nativeEvent.layout.y, e.nativeEvent.layout.height)
      }
      style={[styles.dropSection, highlight]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A row that can be lifted out of its section and dropped into another. The
 * gesture is one Pan with `activateAfterLongPress`, rather than a long-press
 * and a pan composed together: the press has to be held *and* then moved to
 * count, which is exactly what one gesture with a delayed activation is.
 *
 * Everything it does per frame — following the finger, hit-testing, scrolling
 * the list — stays on the UI thread; the JS side hears about the drag exactly
 * three times (lifted, ended, and dropped somewhere).
 */
function DraggableRow({
  enabled,
  kind,
  itemId,
  zoneKey,
  ctx,
  onDrop,
  children,
}: {
  enabled: boolean;
  kind: Kind;
  itemId: string;
  zoneKey: string;
  ctx: DragContext;
  onDrop: (kind: Kind, itemId: string, zoneKey: string) => void;
  children: ReactNode;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lift = useSharedValue(0);
  const isLifted = useSharedValue(false);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activateAfterLongPress(LIFT_DELAY_MS)
        .onStart((e) => {
          // Where the list itself is on screen. Measured now rather than kept
          // up to date: the viewport cannot move while a finger is holding a
          // row down, and this is the one moment the drag needs it.
          const m = measure(ctx.scrollRef);
          if (m) {
            ctx.viewportTop.value = m.pageY;
            ctx.viewportHeight.value = m.height;
          }
          isLifted.value = true;
          lift.value = withTiming(1, { duration: 120 });
          ctx.pointerY.value = e.absoluteY;
          ctx.sourceZone.value = zoneKey;
          ctx.activeZone.value = null;
          runOnJS(ctx.onDragStart)();
        })
        .onUpdate((e) => {
          translateX.value = e.translationX;
          translateY.value = e.translationY;
          ctx.pointerY.value = e.absoluteY;
        })
        // Covers every ending there is — dropped, cancelled, or interrupted —
        // so no drag can leave the row lifted or a section lit up behind it.
        .onFinalize((_e, success) => {
          if (!isLifted.value) return;
          isLifted.value = false;
          const droppedOn = success ? ctx.activeZone.value : null;
          translateX.value = withTiming(0, { duration: 140 });
          translateY.value = withTiming(0, { duration: 140 });
          lift.value = withTiming(0, { duration: 140 });
          ctx.activeZone.value = null;
          ctx.sourceZone.value = null;
          runOnJS(ctx.onDragEnd)();
          if (droppedOn) runOnJS(onDrop)(kind, itemId, droppedOn);
        }),
    [enabled, kind, itemId, zoneKey, ctx, onDrop, translateX, translateY, lift, isLifted]
  );

  // Lifted = slightly larger, slightly translucent, and above its neighbours.
  // No shadow: the app has no shadow token, and a hardcoded one would be wrong
  // in one of the two themes.
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: 1 + lift.value * 0.03 },
    ],
    opacity: 1 - lift.value * 0.12,
    zIndex: lift.value > 0 ? 20 : 0,
    elevation: lift.value > 0 ? 6 : 0,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}

/**
 * The batch action bar shown while editing. Delete lives in the header, next to
 * Done — keeping the destructive action off the row of attribute edits people
 * tap repeatedly.
 */
function BatchBar({
  count,
  canTag,
  onTag,
  onWeek,
  onKind,
}: {
  count: number;
  canTag: boolean;
  onTag: () => void;
  onWeek: () => void;
  onKind: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const empty = count === 0;
  const action = (label: string, onPress: () => void, disabled: boolean) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={({ pressed }) => [styles.batchAction, pressed && { opacity: 0.6 }]}
    >
      <Text style={[styles.batchActionText, { color: disabled ? theme.muted : theme.accent }]}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View
      style={[
        styles.batchBar,
        {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          paddingBottom: insets.bottom + 10,
        },
      ]}
    >
      <Text style={[styles.batchCount, { color: theme.muted }]}>
        {empty ? 'Select items' : `${count} selected`}
      </Text>
      {action('Tag', onTag, empty || !canTag)}
      {action('Week', onWeek, empty)}
      {action('Kind', onKind, empty)}
    </View>
  );
}

/**
 * "Move these items to week N". Same sheet shape as StudyTimeEditor, with the
 * number-pad + Done-accessory input the Moodle triage screen uses (iOS's
 * number pad has no return key of its own).
 */
function BatchWeekSheet({
  visible,
  count,
  maxWeek,
  onSave,
  onClose,
}: {
  visible: boolean;
  count: number;
  maxWeek?: number;
  onSave: (week: number) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Re-seed on every open: the field is a destination, not a current value.
  useEffect(() => {
    if (!visible) return;
    setText('');
    setError(null);
  }, [visible]);

  function handleSave() {
    const week = parseInt(text, 10);
    if (!Number.isInteger(week) || week < 1 || (maxWeek !== undefined && week > maxWeek)) {
      setError(maxWeek ? `Enter a week between 1 and ${maxWeek}.` : 'Enter a week number.');
      return;
    }
    onSave(week);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.avoider}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Move to week</Text>
            <Text style={[styles.sheetSub, { color: theme.muted }]}>
              {count} {count === 1 ? 'item' : 'items'}
            </Text>
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v);
                if (error) setError(null);
              }}
              autoFocus
              keyboardType="number-pad"
              inputAccessoryViewID={NUMERIC_KEYBOARD_ACCESSORY_ID}
              placeholder={maxWeek ? `1 – ${maxWeek}` : 'Week'}
              placeholderTextColor={theme.muted}
              accessibilityLabel="Week number"
              style={[
                styles.sheetInput,
                {
                  color: theme.text,
                  backgroundColor: theme.surfaceAlt,
                  borderColor: error ? ERROR_COLOR : theme.border,
                },
              ]}
            />
            {error ? <Text style={[styles.sheetError, { color: ERROR_COLOR }]}>{error}</Text> : null}
            <View style={styles.sheetActions}>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.sheetBtn,
                  { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={[styles.sheetBtnText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.sheetBtn,
                  { backgroundColor: theme.accent },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[styles.sheetBtnText, { color: '#fff', fontWeight: '600' }]}>
                  Move
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
      <NumericKeyboardDoneBar />
    </Modal>
  );
}

/** Collapsed points right, expanded points down. Drawn, not an icon font. */
function Chevron({ open, color }: { open: boolean; color: string }) {
  return (
    <View
      style={[styles.chevron, { borderLeftColor: color }, open && { transform: [{ rotate: '90deg' }] }]}
    />
  );
}

// The same red the rest of the app uses for destructive/invalid states.
const ERROR_COLOR = '#ef4444';

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Clears the tallest floating column: the bottom-left timer stack, 24 + 56
  // (timer) + 10 + 44 (study time) above the safe area, plus a little air.
  content: { padding: 16, paddingBottom: 150 },
  studyTime: { fontSize: 13 },
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
  sectionActions: { flexDirection: 'row', alignItems: 'baseline', gap: 14 },
  sectionTitle: { fontSize: 20, fontWeight: '700' },
  bulkToggle: { fontSize: 13 },
  empty: { fontSize: 14 },

  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  weekTitle: { fontSize: 14, fontWeight: '600' },
  // "Readings"/"Tasks" inside a By Week section — quieter than a week header.
  kindLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.3 },
  weekRange: { fontSize: 12, flex: 1 },
  weekCount: { fontSize: 12, fontVariant: ['tabular-nums'] },
  chevron: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: 'transparent',
  },

  // The transparent border is always there so lighting a section up as a drop
  // target doesn't move anything; the negative margin pays back its inset.
  dropSection: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 6,
    marginHorizontal: -6,
  },

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

  batchBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Also the flexible spacer that pushes the actions to the right.
  batchCount: { fontSize: 13, flex: 1 },
  batchAction: { paddingVertical: 4 },
  batchActionText: { fontSize: 15, fontWeight: '600' },

  avoider: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  sheetTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  sheetSub: { fontSize: 13, textAlign: 'center', marginTop: 2, marginBottom: 12 },
  sheetInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    textAlign: 'center',
  },
  sheetError: { fontSize: 12, marginTop: 6 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  sheetBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  sheetBtnText: { fontSize: 16 },
});
