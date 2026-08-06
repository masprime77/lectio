// Per-week triage screen: reads the session Part B stored, shows one row per
// mapped Moodle week with a week-number suggestion and a Skip/Reading/Task
// picker, and on confirm creates the readings/tasks via PlannerCore.addItem +
// saveWithConflict. The final step of the Moodle import flow (Parts A/B/C).
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { addItem } from '@lectio/core/planner-core';
import { storage } from '../src/storage';
import { saveWithConflict } from '../src/sync/saveWithConflict';
import { getMoodleImportSession, clearMoodleImportSession } from '../src/moodle/import-session';
import { useTheme } from '../src/theme';
import { SheetHeader } from '../src/components/SheetHeader';
import type { MoodleWeek } from '../types/lectio-core';

// Same suggestion heuristic as desktop's Phase 16 Part C
// (app.js's suggestWeekFromDateRange) — kept local to this screen, not
// @lectio/core, since it's UI-suggestion logic, not a reusable pure transform.
function suggestWeekFromDateRange(
  startDate: string | undefined,
  totalWeeks: number | undefined,
  dateRange: MoodleWeek['dateRange']
): number | null {
  if (!dateRange || !startDate || !totalWeeks) return null;
  const start = new Date(startDate + 'T00:00:00');
  const startYear = start.getFullYear();
  const candidates = [startYear, startYear + 1].map(
    (year) => new Date(year, dateRange.startMonth - 1, dateRange.startDay)
  );
  let sectionDate = candidates.find((d) => d >= start);
  if (!sectionDate) sectionDate = candidates[0];
  const diffDays = Math.floor((sectionDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  return Math.max(1, Math.min(totalWeeks, week));
}

type Mode = 'skip' | 'reading' | 'task';

export default function MoodleTriageScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [session] = useState(() => getMoodleImportSession());

  const [totalWeeks, setTotalWeeks] = useState<number | undefined>();
  const [decisions, setDecisions] = useState<Record<number, { mode: Mode; week: string }>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    storage.get(session.semesterId).then((sem) => {
      setTotalWeeks(sem.weeks);
      const initial: Record<number, { mode: Mode; week: string }> = {};
      session.mapped.weeks.forEach((w) => {
        const suggested = suggestWeekFromDateRange(sem.startDate, sem.weeks, w.dateRange);
        initial[w.moodleSection] = { mode: 'skip', week: suggested ? String(suggested) : '' };
      });
      setDecisions(initial);
    });
  }, [session]);

  if (!session) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background, justifyContent: 'center' }]}>
        <SheetHeader title="Import weeks" />
        <Text style={{ color: theme.muted, textAlign: 'center' }}>
          Nothing to import — start again from the Moodle screen.
        </Text>
      </View>
    );
  }

  function setDecision(section: number, patch: Partial<{ mode: Mode; week: string }>) {
    setDecisions((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
  }

  async function handleConfirm() {
    setError(null);
    const toImport = session!.mapped.weeks.filter((w) => decisions[w.moodleSection]?.mode !== 'skip');

    for (const w of toImport) {
      const weekNum = parseInt(decisions[w.moodleSection]?.week ?? '', 10);
      if (!totalWeeks || !Number.isInteger(weekNum) || weekNum < 1 || weekNum > totalWeeks) {
        setError(`Enter a valid week (1–${totalWeeks ?? '?'}) for "${w.sectionName || 'that section'}".`);
        return;
      }
    }

    setBusy(true);
    try {
      const sem = await storage.get(session!.semesterId);
      const course = sem.courses.find((c) => c.id === session!.courseId);
      if (!course) throw new Error('Course not found.');

      let created = 0;
      toImport.forEach((w) => {
        const mode = decisions[w.moodleSection].mode as 'reading' | 'task';
        const weekNum = parseInt(decisions[w.moodleSection].week, 10);
        w.items.forEach((item) => {
          addItem(course, mode, { title: item.name, week: weekNum });
          created += 1;
        });
      });

      const outcome = await saveWithConflict(session!.semesterId, sem);
      if (outcome === 'cancelled') {
        setBusy(false);
        return;
      }
      const courseName = course.name;
      clearMoodleImportSession();
      Alert.alert('Import complete', `Imported ${created} item(s) into "${courseName}".`, [
        { text: 'OK', onPress: () => router.dismissAll() },
      ]);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SheetHeader title="Import weeks" />
      <Text style={[styles.source, { color: theme.muted }]}>From {session.accountBaseUrl}</Text>
      <FlatList
        data={session.mapped.weeks}
        keyExtractor={(w) => String(w.moodleSection)}
        renderItem={({ item: w }) => {
          const d = decisions[w.moodleSection] ?? { mode: 'skip' as Mode, week: '' };
          return (
            <View style={[styles.row, { borderColor: theme.border }]}>
              <View style={styles.rowInfo}>
                <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                  {w.sectionName || `Section ${w.moodleSection}`}
                </Text>
                <Text style={[styles.rowSub, { color: theme.muted }]}>
                  {w.items.length} {w.items.length === 1 ? 'item' : 'items'}
                </Text>
              </View>
              <TextInput
                style={[styles.weekInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
                keyboardType="number-pad"
                placeholder="Wk"
                placeholderTextColor={theme.muted}
                value={d.week}
                onChangeText={(v) => setDecision(w.moodleSection, { week: v })}
              />
              <View style={styles.modeRow}>
                {(['skip', 'reading', 'task'] as Mode[]).map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setDecision(w.moodleSection, { mode: m })}
                    style={[
                      styles.modeBtn,
                      { borderColor: theme.border },
                      d.mode === m && { backgroundColor: theme.accent, borderColor: theme.accent },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: d.mode === m ? '#fff' : theme.muted }}>
                      {m === 'skip' ? 'Skip' : m === 'reading' ? 'Read' : 'Task'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy ? (
        <ActivityIndicator color={theme.accent} style={{ marginVertical: 12 }} />
      ) : (
        <Pressable style={[styles.confirmBtn, { backgroundColor: theme.accent }]} onPress={handleConfirm}>
          <Text style={styles.confirmText}>Import selected</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  source: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  weekInput: {
    width: 44,
    height: 36,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    textAlign: 'center',
    fontSize: 14,
  },
  modeRow: { flexDirection: 'row', gap: 4 },
  modeBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  error: { color: '#ef4444', fontSize: 13, textAlign: 'center', marginHorizontal: 24, marginTop: 8 },
  confirmBtn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    marginBottom: 24,
    marginTop: 8,
  },
  confirmText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
