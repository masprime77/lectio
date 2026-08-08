import { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { storage } from '../../../../src/storage';
import { saveWithConflict } from '../../../../src/sync/saveWithConflict';
import { useCourseDetail } from '../../../../src/components/course-detail/useCourseDetail';
import { CourseDetailHeaderActions } from '../../../../src/components/course-detail/CourseDetailHeaderActions';
import { CourseDetailBody } from '../../../../src/components/course-detail/CourseDetailBody';
import type { Semester } from '../../../../types/lectio-core';

export default function CourseDetailScreen() {
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

  const persist = useCallback(
    (next: Semester) => {
      setSemester(next);
      // Conflict-aware: onApplied swaps the screen to the cloud version when the
      // user chooses "Use the latest"; "Cancel" leaves `next` on screen unsaved.
      saveWithConflict(id, next, setSemester).catch((err) => console.warn('save failed', err));
    },
    [id]
  );

  const result = useCourseDetail(semester, courseId, persist);

  return (
    <>
      <Stack.Screen
        options={{
          title: result.course?.name ?? 'Course',
          headerRight: () => (
            <CourseDetailHeaderActions
              editing={result.editing}
              selectedCount={result.selected.size}
              hasItems={result.hasItems}
              onToggleEditing={result.toggleEditing}
              onBatchDelete={result.batchDelete}
              onExport={result.handleExportCourse}
              onSortPress={() => result.setSortMenuOpen(true)}
            />
          ),
        }}
      />
      <CourseDetailBody result={result} />
    </>
  );
}
