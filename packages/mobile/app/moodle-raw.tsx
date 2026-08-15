// Raw per-item import screen — the per-item counterpart to moodle-triage.tsx.
// Reads the same in-memory import session, but flattens mapped.weeks[].items
// into one row per item: every importable module of the Moodle course, flat,
// each carrying its own week number and its own Skip/Read/Task choice. That's
// what a section mixing readings and tasks (or spanning weeks) needs, which
// the one-decision-per-section screen can't express.
//
// Mirrors desktop's raw import mode, including the section-counted week
// cascade. Creation goes through the same PlannerCore.addItem +
// saveWithConflict path as the triage screen.
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
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
import { suggestWeekFromDateRange } from '../src/moodle/suggest-week';
import { flattenItems, seedWeeks, cascadeWeeksFrom, type RawRow } from '../src/moodle/raw-rows';
import { useTheme } from '../src/theme';
import { SheetHeader } from '../src/components/SheetHeader';
import { NumericKeyboardDoneBar, NUMERIC_KEYBOARD_ACCESSORY_ID } from '../src/components/NumericKeyboardDoneBar';
import type { Semester } from '../types/lectio-core';

type Mode = 'skip' | 'reading' | 'task';
type Decision = { mode: Mode; week: string };
const MODES: Mode[] = ['skip', 'reading', 'task'];
const MODE_LABEL: Record<Mode, string> = { skip: 'Skip', reading: 'Read', task: 'Task' };
// The one default for a row with no decision yet. Render, edit and confirm all
// read through it, so a missing entry can never mean "skipped" in one place and
// "importable" in another.
const DEFAULT_DECISION: Decision = { mode: 'skip', week: '' };

// Memoized so editing one row (or cascading into the rows below it) doesn't
// re-render all 60 — only the rows whose decision object actually changed.
// That means the handlers have to be referentially stable; they're useCallback'd
// in the screen below.
const ItemRow = memo(function ItemRow({
  row,
  index,
  decision,
  theme,
  onWeekChange,
  onModeChange,
}: {
  row: RawRow;
  index: number;
  decision: Decision;
  theme: ReturnType<typeof useTheme>;
  onWeekChange: (index: number, value: string) => void;
  onModeChange: (key: string, mode: Mode) => void;
}) {
  return (
    <View style={[styles.row, { borderColor: theme.border }]}>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
          {row.item.name}
        </Text>
        <Text style={[styles.rowSub, { color: theme.muted }]} numberOfLines={1}>
          {row.sectionName}
        </Text>
      </View>
      <TextInput
        style={[styles.weekInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
        keyboardType="number-pad"
        inputAccessoryViewID={NUMERIC_KEYBOARD_ACCESSORY_ID}
        placeholder="Wk"
        placeholderTextColor={theme.muted}
        value={decision.week}
        onChangeText={(v) => onWeekChange(index, v)}
        accessibilityLabel={`Week for ${row.item.name}`}
      />
      <View style={styles.modeRow}>
        {MODES.map((m) => (
          <Pressable
            key={m}
            onPress={() => onModeChange(row.key, m)}
            accessibilityRole="button"
            accessibilityState={{ selected: decision.mode === m }}
            style={[
              styles.modeBtn,
              { borderColor: theme.border },
              decision.mode === m && { backgroundColor: theme.accent, borderColor: theme.accent },
            ]}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: decision.mode === m ? '#fff' : theme.muted }}>
              {MODE_LABEL[m]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
});

export default function MoodleRawScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [session] = useState(() => getMoodleImportSession());
  const rows = useMemo(() => (session ? flattenItems(session.mapped) : []), [session]);

  const [totalWeeks, setTotalWeeks] = useState<number | undefined>();
  // One week suggestion per section, computed once on load — the seed for
  // every row and what "Weeks from sections" restores, so resetting costs no
  // second read of the semester.
  const [suggestions, setSuggestions] = useState<(number | null)[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  // False until the semester (and with it totalWeeks + the seeded weeks) has
  // loaded; confirming before that would import against an empty map.
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    storage
      .get(session.semesterId)
      .then((sem: Semester) => {
        // Every item in a section starts on that section's suggestion, so a
        // course whose section names carry date ranges needs no week typing at
        // all — only the per-item type choices.
        const perSection = session.mapped.weeks.map((w) =>
          suggestWeekFromDateRange(sem.startDate, sem.weeks, w.dateRange)
        );
        const seeded = seedWeeks(flattenItems(session.mapped), perSection);
        const initial: Record<string, Decision> = {};
        Object.entries(seeded).forEach(([key, week]) => {
          initial[key] = { ...DEFAULT_DECISION, week };
        });
        setTotalWeeks(sem.weeks);
        setSuggestions(perSection);
        setDecisions(initial);
        setLoaded(true);
      })
      .catch((e: any) => setError(e?.message ?? 'Could not load this semester.'));
  }, [session]);

  const decisionFor = useCallback(
    (key: string): Decision => decisions[key] ?? DEFAULT_DECISION,
    [decisions]
  );

  const handleModeChange = useCallback((key: string, mode: Mode) => {
    setDecisions((prev) => ({ ...prev, [key]: { ...(prev[key] ?? DEFAULT_DECISION), mode } }));
  }, []);

  // Editing a row's week cascades into every row below it (rows above stay
  // put), and re-editing an earlier row re-cascades from there. See
  // cascadeWeeksFrom for why the step is counted in sections, not rows.
  const handleWeekChange = useCallback(
    (index: number, value: string) => {
      const from = rows[index];
      setDecisions((prev) => {
        const next = { ...prev, [from.key]: { ...(prev[from.key] ?? DEFAULT_DECISION), week: value } };
        const patch = cascadeWeeksFrom(rows, index, parseInt(value, 10), totalWeeks);
        Object.entries(patch).forEach(([key, week]) => {
          next[key] = { ...(next[key] ?? DEFAULT_DECISION), week };
        });
        return next;
      });
    },
    [rows, totalWeeks]
  );

  // Sets every row's type in one tap — a starting point, not a lock; any row
  // can still be changed by hand afterwards. Week numbers are untouched.
  // "Skip" doubles as clear-all, since Skip is exactly what creates nothing.
  function setAllModes(mode: Mode) {
    setDecisions((prev) => {
      const next = { ...prev };
      rows.forEach((r) => {
        next[r.key] = { ...(next[r.key] ?? DEFAULT_DECISION), mode };
      });
      return next;
    });
  }

  // Puts every row back on its own section's suggestion — the undo for a
  // cascade that went the wrong way, without losing the type choices.
  function resetWeeksFromSections() {
    const seeded = seedWeeks(rows, suggestions);
    setDecisions((prev) => {
      const next = { ...prev };
      Object.entries(seeded).forEach(([key, week]) => {
        next[key] = { ...(next[key] ?? DEFAULT_DECISION), week };
      });
      return next;
    });
  }

  async function handleConfirm() {
    if (!loaded) return;
    setError(null);

    const toImport = rows.filter((r) => decisionFor(r.key).mode !== 'skip');
    if (toImport.length === 0) {
      setError('Choose Read or Task for at least one item.');
      return;
    }

    // Validate every contributing row up front so a bad week number can never
    // leave a half-finished import behind. Skipped rows are filtered out
    // above, so a blank week on one of them can't block the import.
    for (const r of toImport) {
      const weekNum = parseInt(decisionFor(r.key).week, 10);
      if (!totalWeeks || !Number.isInteger(weekNum) || weekNum < 1 || weekNum > totalWeeks) {
        setError(`Enter a valid week (1–${totalWeeks ?? '?'}) for "${r.item.name}".`);
        return;
      }
    }

    setBusy(true);
    try {
      const sem = await storage.get(session!.semesterId);
      const course = sem.courses.find((c) => c.id === session!.courseId);
      if (!course) throw new Error('Course not found.');

      toImport.forEach((r) => {
        const d = decisionFor(r.key);
        addItem(course, d.mode as 'reading' | 'task', {
          title: r.item.name,
          week: parseInt(d.week, 10),
        });
      });

      const outcome = await saveWithConflict(session!.semesterId, sem);
      if (outcome === 'cancelled') {
        setBusy(false);
        return;
      }
      const courseName = course.name;
      clearMoodleImportSession();
      Alert.alert('Import complete', `Imported ${toImport.length} item(s) into "${courseName}".`, [
        { text: 'Done', onPress: () => router.dismissAll() },
        { text: 'Import another', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background, justifyContent: 'center' }]}>
        <SheetHeader title="Import items" />
        <Text style={{ color: theme.muted, textAlign: 'center' }}>
          Nothing to import — start again from the Moodle screen.
        </Text>
      </View>
    );
  }

  const readingCount = rows.filter((r) => decisionFor(r.key).mode === 'reading').length;
  const taskCount = rows.filter((r) => decisionFor(r.key).mode === 'task').length;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SheetHeader title="Import items" />
      <Text style={[styles.source, { color: theme.muted }]}>From {session.accountBaseUrl}</Text>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        extraData={decisions}
        initialNumToRender={12}
        windowSize={11}
        ListHeaderComponent={
          <View style={[styles.toolbar, { borderColor: theme.border }]}>
            <Text style={[styles.toolbarLabel, { color: theme.muted }]}>All items</Text>
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
              <Pressable onPress={resetWeeksFromSections}>
                <Text style={[styles.link, { color: theme.accent }]}>Weeks from sections</Text>
              </Pressable>
            </View>
            <Text style={[styles.summary, { color: theme.muted }]}>
              {readingCount} reading(s), {taskCount} task(s) of {rows.length} item(s)
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.muted }]}>
            This Moodle course has no importable items.
          </Text>
        }
        renderItem={({ item: row, index }) => (
          <ItemRow
            row={row}
            index={index}
            decision={decisionFor(row.key)}
            theme={theme}
            onWeekChange={handleWeekChange}
            onModeChange={handleModeChange}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      />
      <NumericKeyboardDoneBar />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy || (!loaded && !error) ? (
        <ActivityIndicator color={theme.accent} style={{ marginVertical: 12 }} />
      ) : (
        <Pressable
          style={[styles.confirmBtn, { backgroundColor: theme.accent }, !loaded && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!loaded}
        >
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
  summary: { fontSize: 12 },
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
  empty: { fontSize: 14, textAlign: 'center', paddingVertical: 24 },
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
  confirmBtnDisabled: { opacity: 0.5 },
  confirmText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
