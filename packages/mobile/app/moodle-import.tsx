// Import-from-Moodle picker: pick a semester, a connected account (when more
// than one), a Moodle course, and a target Lectio course (existing or new),
// then fetch that course's content and hand off to the Part C triage screen
// via the in-memory import-session holder. This screen itself only resolves
// (or creates) the target course and fetches + maps content — it never
// creates readings/tasks directly.
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getCourses, addCourse } from '@lectio/core/planner-core';
import { createMoodleClient } from '@lectio/core/integrations/moodle-client';
import { mapCourseContents } from '@lectio/core/integrations/moodle';
import { storage } from '../src/storage';
import { saveWithConflict } from '../src/sync/saveWithConflict';
import { listMoodleAccounts, getMoodleAccountToken, type MoodleAccountSummary } from '../src/auth/moodle-token-store';
import { setMoodleImportSession } from '../src/moodle/import-session';
import { useTheme } from '../src/theme';
import { SheetHeader } from '../src/components/SheetHeader';
import type { SemesterSummary, Course, MoodleCourse } from '../types/lectio-core';

// One small reusable picker for this screen's four choices (semester,
// account, Moodle course, target course) — mirrors add.tsx's private
// SemesterPicker's pill-row look, but that component isn't exported, so this
// is a fresh, self-contained equivalent rather than a shared import.
function Picker({
  items,
  selectedKey,
  onSelect,
  theme,
}: {
  items: { key: string; label: string }[];
  selectedKey?: string;
  onSelect: (key: string) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.pillRow}>
      {items.map((it) => {
        const isActive = it.key === selectedKey;
        return (
          <Pressable
            key={it.key}
            onPress={() => onSelect(it.key)}
            style={[
              styles.pill,
              { backgroundColor: theme.surface, borderColor: theme.border },
              isActive && { backgroundColor: theme.accent, borderColor: theme.accent },
            ]}
          >
            <Text style={[styles.pillText, { color: isActive ? '#fff' : theme.text }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function MoodleImportScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [semesters, setSemesters] = useState<SemesterSummary[] | null>(null);
  const [semesterId, setSemesterId] = useState<string | undefined>();
  const [semesterCourses, setSemesterCourses] = useState<Course[]>([]);

  const [accounts, setAccounts] = useState<MoodleAccountSummary[] | null>(null);
  const [accountBaseUrl, setAccountBaseUrl] = useState<string | undefined>();

  const [moodleCourses, setMoodleCourses] = useState<MoodleCourse[] | null>(null);
  const [moodleCourseId, setMoodleCourseId] = useState<number | undefined>();

  const [targetCourseId, setTargetCourseId] = useState<string>('__new__');
  const [newCourseName, setNewCourseName] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load semesters + accounts once.
  useEffect(() => {
    storage
      .list()
      .then((list) => {
        setSemesters(list);
        setSemesterId((cur) => cur ?? list[0]?.id);
      })
      .catch((e) => setError(e?.message ?? 'Could not load semesters.'));
    listMoodleAccounts()
      .then((list) => {
        setAccounts(list);
        setAccountBaseUrl((cur) => cur ?? list[0]?.baseUrl);
      })
      .catch((e) => setError(e?.message ?? 'Could not load Moodle accounts.'));
  }, []);

  // Reload the target-course list whenever the chosen semester changes.
  useEffect(() => {
    if (!semesterId) return;
    storage
      .get(semesterId)
      .then((sem) => setSemesterCourses(getCourses(sem)))
      .catch(() => setSemesterCourses([]));
  }, [semesterId]);

  // Fetch the Moodle course list whenever the chosen account changes.
  useEffect(() => {
    if (!accountBaseUrl) return;
    setMoodleCourses(null);
    setError(null);
    (async () => {
      try {
        const stored = await getMoodleAccountToken(accountBaseUrl);
        if (!stored) throw new Error("Could not read that account's token. Reconnect it on the Moodle screen.");
        const client = createMoodleClient({ baseUrl: stored.baseUrl, token: stored.wstoken });
        const info = await client.getSiteInfo();
        const courses = await client.getEnrolledCourses(info.userid);
        setMoodleCourses(courses);
        setMoodleCourseId((cur) => cur ?? courses[0]?.id);
      } catch (e: any) {
        setError(e?.message ?? 'Could not reach Moodle.');
        setMoodleCourses([]);
      }
    })();
  }, [accountBaseUrl]);

  async function handleFetch() {
    setError(null);
    if (!semesterId || !accountBaseUrl || !moodleCourseId) return;
    if (targetCourseId === '__new__' && !newCourseName.trim()) {
      setError('Enter a name for the new course.');
      return;
    }

    setBusy(true);
    try {
      const stored = await getMoodleAccountToken(accountBaseUrl);
      if (!stored) throw new Error("Could not read that account's token.");
      const client = createMoodleClient({ baseUrl: stored.baseUrl, token: stored.wstoken });
      const contents = await client.getCourseContents(moodleCourseId);
      // Tag every item with the source account's baseUrl so two accounts'
      // items never collide on moodleModuleId.
      const mapped = mapCourseContents(contents, { source: accountBaseUrl });

      // Resolve (or create) the target course now, before handing off to the
      // triage screen — a fresh course must exist so triage always has a
      // real course id to attach items to.
      const sem = await storage.get(semesterId);
      let targetId = targetCourseId;
      if (targetCourseId === '__new__') {
        const created = addCourse(sem, { name: newCourseName.trim(), color: '#4a90d9' });
        targetId = created.id;
        const outcome = await saveWithConflict(semesterId, sem);
        if (outcome === 'cancelled') {
          setBusy(false);
          return;
        }
      }

      setMoodleImportSession({ semesterId, courseId: targetId, accountBaseUrl, mapped });
      router.push('/moodle-triage');
    } catch (e: any) {
      setError(e?.message ?? 'Could not fetch course content.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SheetHeader title="Import from Moodle" />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[styles.label, { color: theme.muted }]}>Semester</Text>
        {semesters === null ? (
          <ActivityIndicator color={theme.accent} />
        ) : (
          <Picker
            theme={theme}
            items={semesters.map((s) => ({ key: s.id, label: s.name }))}
            selectedKey={semesterId}
            onSelect={setSemesterId}
          />
        )}

        {/* Only worth asking when there's an actual choice — one account is
            the common case and shouldn't force an extra step. */}
        {accounts && accounts.length > 1 ? (
          <>
            <Text style={[styles.label, { color: theme.muted }]}>Moodle account</Text>
            <Picker
              theme={theme}
              items={accounts.map((a) => ({ key: a.baseUrl, label: a.label ?? a.baseUrl }))}
              selectedKey={accountBaseUrl}
              onSelect={setAccountBaseUrl}
            />
          </>
        ) : null}

        <Text style={[styles.label, { color: theme.muted }]}>Moodle course</Text>
        {moodleCourses === null ? (
          <ActivityIndicator color={theme.accent} />
        ) : moodleCourses.length === 0 ? (
          <Text style={{ color: theme.muted, fontSize: 14 }}>No enrolled courses found.</Text>
        ) : (
          <Picker
            theme={theme}
            items={moodleCourses.map((c) => ({
              key: String(c.id),
              label: c.fullname || c.shortname || `Course ${c.id}`,
            }))}
            selectedKey={moodleCourseId ? String(moodleCourseId) : undefined}
            onSelect={(k) => setMoodleCourseId(parseInt(k, 10))}
          />
        )}

        <Text style={[styles.label, { color: theme.muted }]}>Import into</Text>
        <Picker
          theme={theme}
          items={[
            { key: '__new__', label: '+ New course' },
            ...semesterCourses.map((c) => ({ key: c.id, label: c.name })),
          ]}
          selectedKey={targetCourseId}
          onSelect={setTargetCourseId}
        />
        {targetCourseId === '__new__' ? (
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            placeholder="Course name…"
            placeholderTextColor={theme.muted}
            value={newCourseName}
            onChangeText={setNewCourseName}
            editable={!busy}
          />
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {busy ? (
          <ActivityIndicator color={theme.accent} style={{ marginTop: 12 }} />
        ) : (
          <Pressable style={[styles.btn, { backgroundColor: theme.accent }]} onPress={handleFetch}>
            <Text style={styles.btnText}>Fetch content</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 16 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1 },
  pillText: { fontSize: 14, fontWeight: '600' },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 16,
    marginTop: 8,
  },
  error: { color: '#ef4444', fontSize: 13, textAlign: 'center', marginTop: 12 },
  btn: { height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
