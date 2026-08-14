import { useEffect, useState } from 'react';
import {
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
  Kind,
  UseCourseDetailResult,
  WeekGroup,
  WeekSection,
} from './useCourseDetail';
import type { PlannerItem, Tag } from '../../../types/lectio-core';

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
  const renderItem = (kind: Kind, item: PlannerItem, tags: Tag[], showWeek = true) => {
    const tag = tags.find((t) => t.id === item.status);
    return (
      <SwipeableRow
        key={item.id}
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
  const renderWeekGroup = (kind: Kind, group: WeekGroup, tags: Tag[]) => (
    <View key={group.key}>
      {renderSectionHeader(group, group.items.length)}
      {group.open && group.items.map((item) => renderItem(kind, item, tags))}
    </View>
  );

  // By Week: one week of the course, its readings then its tasks. The kind
  // labels are the desktop week body's "Readings"/"Tasks" section titles; an
  // empty one is dropped rather than shown as a placeholder — a phone week
  // section is usually short and the label alone would be noise.
  const renderWeekSection = (section: WeekSection) => (
    <View key={section.key}>
      {renderSectionHeader(section, section.count)}
      {section.open && (
        <>
          {section.readings.length > 0 && (
            <>
              <Text style={[styles.kindLabel, { color: theme.muted }]}>Readings</Text>
              {section.readings.map((item) => renderItem('reading', item, readingTags, false))}
            </>
          )}
          {section.tasks.length > 0 && (
            <>
              <Text style={[styles.kindLabel, { color: theme.muted }]}>Tasks</Text>
              {section.tasks.map((item) => renderItem('task', item, taskTags, false))}
            </>
          )}
        </>
      )}
    </View>
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

  const byWeek = result.groupMode === 'week';
  const readingGroups = byWeek ? [] : result.weekGroups('reading');
  const taskGroups = byWeek ? [] : result.weekGroups('task');
  const weekSections = byWeek ? result.weekSections() : [];

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
        <Pressable onPress={() => result.pushAddItem('reading')}>
          <Text style={[styles.empty, { color: theme.muted }]}>No readings. Tap to add one.</Text>
        </Pressable>
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
        <Pressable onPress={() => result.pushAddItem('task')}>
          <Text style={[styles.empty, { color: theme.muted }]}>No tasks. Tap to add one.</Text>
        </Pressable>
      ) : (
        taskGroups.map((g) => renderWeekGroup('task', g, taskTags))
      )}
    </>
  );

  return (
    <>
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
              ? 'Tap items to select them, then edit or delete them together.'
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
      </ScrollView>
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
