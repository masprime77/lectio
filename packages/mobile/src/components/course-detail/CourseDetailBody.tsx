import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatHoursMinutes, getCourseStudySeconds } from '@lectio/core/pomodoro-core';
import { useTheme } from '../../theme';
import { Fab } from '../Fab';
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

  const { course, readingTags, taskTags, progress, editing, selected, picker } = result;

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
              ? 'Tap items to select them, then delete.'
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
      <StudyTimeEditor
        visible={result.timeEditorOpen}
        courseName={course.name}
        currentSeconds={getCourseStudySeconds(course)}
        onSave={result.handleSaveStudyTime}
        onClose={() => result.setTimeEditorOpen(false)}
      />
      <PomodoroFab semester={result.semester} defaultCourseId={course.id} />
      {/* The "+" opens the add-sheet on the Tags tab; readings/tasks are added
          from the per-section "+ Add" controls next to the Readings/Tasks headers. */}
      <Fab onPress={() => router.push(`/add?context=tags&id=${result.semester?.id}`)} />
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
    </>
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

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 180 },
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
});
