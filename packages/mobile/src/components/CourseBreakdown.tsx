import { StyleSheet, Text, View } from 'react-native';
import { courseBreakdown } from '@lectio/core/planner-core';
import { useTheme } from '../theme';
import { ProgressBar } from './ProgressBar';
import type { Course, Semester } from '../../types/lectio-core';

/**
 * Per-course readings-vs-tasks breakdown: two mini progress lines showing
 * Readings done/total and Tasks done/total, mirroring the desktop's Breakdown
 * panel. Counts honor Study Mode (Studied-only) via core's courseBreakdown.
 */
export function CourseBreakdown({
  course,
  semester,
  studyMode,
}: {
  course: Course;
  semester: Semester;
  studyMode: boolean;
}) {
  const theme = useTheme();
  const bd = courseBreakdown(course, semester, studyMode);
  const color = course.color || theme.accent;

  return (
    <View style={styles.wrap}>
      <BreakdownLine
        label="Readings"
        done={bd.readings.done}
        total={bd.readings.total}
        color={color}
        muted={theme.muted}
      />
      <BreakdownLine
        label="Tasks"
        done={bd.tasks.done}
        total={bd.tasks.total}
        color={color}
        muted={theme.muted}
      />
    </View>
  );
}

function BreakdownLine({
  label,
  done,
  total,
  color,
  muted,
}: {
  label: string;
  done: number;
  total: number;
  color: string;
  muted: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <View style={styles.line}>
      <Text style={[styles.label, { color: muted }]}>{label}</Text>
      <View style={styles.bar}>
        <ProgressBar value={pct} color={color} />
      </View>
      <Text style={[styles.count, { color: muted }]}>
        {done}/{total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontSize: 12, width: 56 },
  bar: { flex: 1 },
  count: { fontSize: 12, width: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
