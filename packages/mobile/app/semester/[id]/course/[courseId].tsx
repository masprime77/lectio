import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  courseProgress,
  getCourses,
  getReadingTags,
  getTaskTags,
} from '@lectio/core/planner-core';
import { storage } from '../../../../src/storage';
import { useTheme } from '../../../../src/theme';
import { ProgressBar } from '../../../../src/components/ProgressBar';
import type { PlannerItem, Semester, Tag } from '../../../../types/lectio-core';

type Kind = 'reading' | 'task';

export default function CourseDetailScreen() {
  const theme = useTheme();
  const { id, courseId } = useLocalSearchParams<{ id: string; courseId: string }>();
  const [semester, setSemester] = useState<Semester | null>(null);

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

  // Advance an item to the next tag of its kind, persist, and re-render.
  const cycleTag = useCallback(
    (kind: Kind, itemId: string | undefined) => {
      if (!semester) return;
      const next: Semester = JSON.parse(JSON.stringify(semester));
      const c = getCourses(next).find((x) => x.id === courseId);
      if (!c) return;
      const items = kind === 'reading' ? c.readings : c.tasks;
      const item = items.find((it) => it.id === itemId);
      if (!item) return;
      const tags = kind === 'reading' ? getReadingTags(next) : getTaskTags(next);
      if (tags.length === 0) return;
      const idx = tags.findIndex((t) => t.id === item.status);
      item.status = tags[(idx + 1) % tags.length].id;
      delete item._ghostSection;
      setSemester(next);
      storage.save(id, next).catch((err) => console.warn('save failed', err));
    },
    [semester, courseId, id]
  );

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
  const progress = courseProgress(course, semester!, false);

  const renderItem = (kind: Kind, item: PlannerItem, tags: Tag[]) => {
    const tag = tags.find((t) => t.id === item.status);
    return (
      <Pressable
        key={item.id}
        onPress={() => cycleTag(kind, item.id)}
        style={[styles.item, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <View style={styles.itemMain}>
          <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
          {typeof item.week === 'number' && (
            <Text style={[styles.itemWeek, { color: theme.muted }]}>Week {item.week}</Text>
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
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: course.name }} />
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
            Tap an item to advance its tag.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Readings</Text>
        {course.readings.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>No readings.</Text>
        ) : (
          course.readings.map((r) => renderItem('reading', r, readingTags))
        )}

        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}>Tasks</Text>
        {course.tasks.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>No tasks.</Text>
        ) : (
          course.tasks.map((t) => renderItem('task', t, taskTags))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  summary: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    marginBottom: 8,
  },
  summaryPct: { fontSize: 28, fontWeight: '700' },
  hint: { fontSize: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  empty: { fontSize: 14 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    gap: 12,
  },
  itemMain: { flexShrink: 1, gap: 2 },
  itemTitle: { fontSize: 15, fontWeight: '500' },
  itemWeek: { fontSize: 12 },
  tagWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagDot: { width: 10, height: 10, borderRadius: 5 },
  tagName: { fontSize: 13 },
});
