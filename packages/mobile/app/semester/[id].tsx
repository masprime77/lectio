import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { courseProgress, getCourses } from '@lectio/core/planner-core';
import { storage } from '../../src/storage';
import { useTheme } from '../../src/theme';
import { ProgressBar } from '../../src/components/ProgressBar';
import type { Semester } from '../../types/lectio-core';

export default function CoursesScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [semester, setSemester] = useState<Semester | null>(null);

  // Reload on focus so tag changes made in course detail update the bars here.
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

  const courses = semester ? getCourses(semester) : [];

  return (
    <>
      <Stack.Screen options={{ title: semester?.name ?? 'Semester' }} />
      <FlatList
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.list}
        data={courses}
        keyExtractor={(c) => c.id}
        ListEmptyComponent={
          semester ? (
            <Text style={[styles.empty, { color: theme.muted }]}>No courses.</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const progress = courseProgress(item, semester!, false);
          return (
            <Link href={`/semester/${id}/course/${item.id}`} asChild>
              <Pressable
                style={StyleSheet.flatten([
                  styles.card,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ])}
              >
                <View style={styles.cardHeader}>
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
            </Link>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  empty: { textAlign: 'center', marginTop: 32 },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  cardTitle: { fontSize: 17, fontWeight: '600', flexShrink: 1 },
  meta: { fontSize: 13 },
});
