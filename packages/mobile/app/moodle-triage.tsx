// Per-week triage screen: reads the session Part B stored, shows one row per
// mapped Moodle week with a week-number suggestion and a Skip/Reading/Task
// picker, and on confirm creates the readings/tasks via PlannerCore.addItem +
// saveWithConflict. Part D added real batch control on top of Part C's
// one-decision-per-week screen: set every week's mode at once, a sequential
// week auto-fill cascade, per-item selection within a week (expand/collapse +
// Select all/Clear all), and a loop-back offer after a successful import.
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
import { NumericKeyboardDoneBar, NUMERIC_KEYBOARD_ACCESSORY_ID } from '../src/components/NumericKeyboardDoneBar';
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
const MODES: Mode[] = ['skip', 'reading', 'task'];
const MODE_LABEL: Record<Mode, string> = { skip: 'Skip', reading: 'Read', task: 'Task' };

export default function MoodleTriageScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [session] = useState(() => getMoodleImportSession());
  const weeks = session?.mapped.weeks ?? [];

  const [totalWeeks, setTotalWeeks] = useState<number | undefined>();
  const [decisions, setDecisions] = useState<Record<number, { mode: Mode; week: string }>>({});
  // One selection flag per item, keyed by moodleSection then array index —
  // every item defaults to selected, matching the old "whole week" behavior.
  const [selected, setSelected] = useState<Record<number, boolean[]>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    storage.get(session.semesterId).then((sem) => {
      setTotalWeeks(sem.weeks);
      const initialDecisions: Record<number, { mode: Mode; week: string }> = {};
      const initialSelected: Record<number, boolean[]> = {};
      session.mapped.weeks.forEach((w) => {
        const suggested = suggestWeekFromDateRange(sem.startDate, sem.weeks, w.dateRange);
        initialDecisions[w.moodleSection] = { mode: 'skip', week: suggested ? String(suggested) : '' };
        initialSelected[w.moodleSection] = w.items.map(() => true);
      });
      setDecisions(initialDecisions);
      setSelected(initialSelected);
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

  // Sets every week's mode in one click — a starting point, not a lock; any
  // row can still be changed by hand afterwards. Week numbers are untouched.
  function setAllModes(mode: Mode) {
    setDecisions((prev) => {
      const next = { ...prev };
      weeks.forEach((w) => {
        next[w.moodleSection] = { ...next[w.moodleSection], mode };
      });
      return next;
    });
  }

  // Editing a row's week number cascades incrementing values into every row
  // below it (rows above stay put); re-editing an earlier row re-cascades
  // from there forward, overwriting whatever was below. A blank, zero, or
  // negative base cascades nothing downstream — it only updates its own field.
  function handleWeekChange(index: number, value: string) {
    const section = weeks[index].moodleSection;
    setDecision(section, { week: value });
    const base = parseInt(value, 10);
    if (!totalWeeks || !Number.isInteger(base) || base < 1) return;
    setDecisions((prev) => {
      const next = { ...prev };
      for (let j = index + 1; j < weeks.length; j += 1) {
        const sec = weeks[j].moodleSection;
        next[sec] = { ...next[sec], week: String(Math.min(totalWeeks, base + (j - index))) };
      }
      return next;
    });
  }

  function toggleItemSelected(section: number, itemIndex: number) {
    setSelected((prev) => {
      const arr = [...(prev[section] ?? [])];
      arr[itemIndex] = !arr[itemIndex];
      return { ...prev, [section]: arr };
    });
  }

  // Spans every week at once, not just the expanded ones.
  function setAllItemsSelected(value: boolean) {
    setSelected(() => {
      const next: Record<number, boolean[]> = {};
      weeks.forEach((w) => {
        next[w.moodleSection] = w.items.map(() => value);
      });
      return next;
    });
  }

  function toggleExpanded(section: number) {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  const allExpanded = weeks.length > 0 && weeks.every((w) => expanded[w.moodleSection]);
  function toggleExpandAll() {
    const next: Record<number, boolean> = {};
    weeks.forEach((w) => {
      next[w.moodleSection] = !allExpanded;
    });
    setExpanded(next);
  }

  async function handleConfirm() {
    setError(null);

    // A week contributes only if it isn't skipped AND still has at least one
    // item selected. Filtering happens before week-number validation, so a
    // week whose items were all deselected can't block the import over a
    // week number that no longer matters.
    const toImport = weeks.filter((w) => {
      if (decisions[w.moodleSection]?.mode === 'skip') return false;
      const sel = selected[w.moodleSection];
      return sel ? sel.some(Boolean) : true;
    });

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
        const sel = selected[w.moodleSection];
        w.items.forEach((item, idx) => {
          if (sel && sel[idx] === false) return;
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
        { text: 'Done', onPress: () => router.dismissAll() },
        { text: 'Import another', onPress: () => router.back() },
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
        data={weeks}
        keyExtractor={(w) => String(w.moodleSection)}
        ListHeaderComponent={
          <View style={[styles.toolbar, { borderColor: theme.border }]}>
            <Text style={[styles.toolbarLabel, { color: theme.muted }]}>All weeks</Text>
            <View style={styles.modeRow}>
              {MODES.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setAllModes(m)}
                  style={[styles.modeBtn, { borderColor: theme.border }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text }}>{MODE_LABEL[m]}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.toolbarLinkRow}>
              <Pressable onPress={() => setAllItemsSelected(true)}>
                <Text style={[styles.link, { color: theme.accent }]}>Select all</Text>
              </Pressable>
              <Pressable onPress={() => setAllItemsSelected(false)}>
                <Text style={[styles.link, { color: theme.accent }]}>Clear all</Text>
              </Pressable>
              <Pressable onPress={toggleExpandAll}>
                <Text style={[styles.link, { color: theme.accent }]}>
                  {allExpanded ? 'Collapse all' : 'Expand all'}
                </Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item: w, index }) => {
          const d = decisions[w.moodleSection] ?? { mode: 'skip' as Mode, week: '' };
          const sel = selected[w.moodleSection] ?? w.items.map(() => true);
          const selCount = sel.filter(Boolean).length;
          const isOpen = !!expanded[w.moodleSection];
          return (
            <View style={[styles.weekBlock, { borderColor: theme.border }]}>
              <View style={styles.row}>
                <Pressable onPress={() => toggleExpanded(w.moodleSection)} hitSlop={8}>
                  <Text style={{ color: theme.muted, fontSize: 14, width: 16 }}>{isOpen ? '▾' : '▸'}</Text>
                </Pressable>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                    {w.sectionName || `Section ${w.moodleSection}`}
                  </Text>
                  <Text style={[styles.rowSub, { color: theme.muted }]}>
                    {selCount === w.items.length
                      ? `${w.items.length} ${w.items.length === 1 ? 'item' : 'items'}`
                      : `${selCount} of ${w.items.length} items`}
                  </Text>
                </View>
                <TextInput
                  style={[styles.weekInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
                  keyboardType="number-pad"
                  inputAccessoryViewID={NUMERIC_KEYBOARD_ACCESSORY_ID}
                  placeholder="Wk"
                  placeholderTextColor={theme.muted}
                  value={d.week}
                  onChangeText={(v) => handleWeekChange(index, v)}
                />
                <View style={styles.modeRow}>
                  {MODES.map((m) => (
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
                        {MODE_LABEL[m]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              {isOpen ? (
                <View style={styles.itemList}>
                  {w.items.map((item, idx) => (
                    <Pressable
                      key={idx}
                      style={styles.itemRow}
                      onPress={() => toggleItemSelected(w.moodleSection, idx)}
                    >
                      <View
                        style={[
                          styles.itemCheck,
                          { borderColor: theme.border },
                          sel[idx] && { backgroundColor: theme.accent, borderColor: theme.accent },
                        ]}
                      />
                      <Text style={[styles.itemText, { color: theme.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
      />
      <NumericKeyboardDoneBar />
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
  toolbar: { gap: 8, paddingBottom: 12, marginBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  toolbarLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  toolbarLinkRow: { flexDirection: 'row', gap: 20 },
  link: { fontSize: 13, fontWeight: '600' },
  weekBlock: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
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
  itemList: { gap: 2, paddingLeft: 24, paddingBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  itemCheck: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  itemText: { flex: 1, fontSize: 13 },
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
