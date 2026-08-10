import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatHoursMinutes, getCourseStudySeconds } from '@lectio/core/pomodoro-core';
import { useTheme } from '../../theme';
import { Fab } from '../Fab';
import { PomodoroFab } from '../../pomodoro/PomodoroFab';
import { StudyTimeEditor } from '../../pomodoro/StudyTimeEditor';
import { ProgressBar } from '../ProgressBar';
import { SortMenu } from '../SortMenu';
import { SwipeableRow } from '../SwipeableRow';
import { TagPickerSheet } from '../TagPickerSheet';
import type { Kind, UseCourseDetailResult, WeekGroup } from './useCourseDetail';
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

  const renderItem = (kind: Kind, item: PlannerItem, tags: Tag[]) => {
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
            {typeof item.week === 'number' && (
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

  // A "Week N · Apr 7 – Apr 13" header with a chevron, and its items when open.
  // Same idea as the desktop course view's collapsible .course-week-header.
  const renderWeekGroup = (kind: Kind, group: WeekGroup, tags: Tag[]) => (
    <View key={group.key}>
      <Pressable
        onPress={() => result.toggleWeek(group)}
        accessibilityRole="button"
        accessibilityState={{ expanded: group.open }}
        accessibilityLabel={`${group.title}, ${group.items.length} ${
          group.items.length === 1 ? 'item' : 'items'
        }`}
        accessibilityHint={group.open ? 'Collapses this week' : 'Expands this week'}
        style={({ pressed }) => [
          styles.weekHeader,
          { borderBottomColor: theme.border },
          pressed && { opacity: 0.6 },
        ]}
      >
        <Chevron open={group.open} color={theme.muted} />
        <Text style={[styles.weekTitle, { color: theme.text }]}>{group.title}</Text>
        {/* Always rendered: it doubles as the flexible spacer that pushes the
            count to the right, and the no-week group has no date range. */}
        <Text style={[styles.weekRange, { color: theme.muted }]}>{group.range}</Text>
        <Text style={[styles.weekCount, { color: theme.muted }]}>{group.items.length}</Text>
      </Pressable>
      {group.open && group.items.map((item) => renderItem(kind, item, tags))}
    </View>
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

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Readings</Text>
          <Pressable onPress={() => result.pushAddItem('reading')}>
            <Text style={{ color: theme.accent, fontSize: 15 }}>+ Add</Text>
          </Pressable>
        </View>
        {course.readings.length === 0 ? (
          <Pressable onPress={() => result.pushAddItem('reading')}>
            <Text style={[styles.empty, { color: theme.muted }]}>
              No readings. Tap to add one.
            </Text>
          </Pressable>
        ) : (
          result.weekGroups('reading').map((g) => renderWeekGroup('reading', g, readingTags))
        )}

        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Tasks</Text>
          <Pressable onPress={() => result.pushAddItem('task')}>
            <Text style={{ color: theme.accent, fontSize: 15 }}>+ Add</Text>
          </Pressable>
        </View>
        {course.tasks.length === 0 ? (
          <Pressable onPress={() => result.pushAddItem('task')}>
            <Text style={[styles.empty, { color: theme.muted }]}>No tasks. Tap to add one.</Text>
          </Pressable>
        ) : (
          result.weekGroups('task').map((g) => renderWeekGroup('task', g, taskTags))
        )}
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
  sectionTitle: { fontSize: 20, fontWeight: '700' },
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
