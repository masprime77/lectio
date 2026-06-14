import { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { ensureSeed, storage } from '../src/storage';
import { prefs } from '../src/lib/prefs';
import { useTheme } from '../src/theme';
import { Fab } from '../src/components/Fab';
import { SwipeableRow } from '../src/components/SwipeableRow';
import * as transfer from '../src/lib/transfer';
import type { Semester, SemesterSummary } from '../types/lectio-core';

// Reopen the last-opened semester only on the first list load after app
// launch — never when the user deliberately navigates back to the list.
let didAutoOpen = false;

export default function SemestersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [semesters, setSemesters] = useState<SemesterSummary[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const editingRef = useRef(editing);
  editingRef.current = editing;

  const reload = useCallback(() => {
    return storage
      .list()
      .then((list) => {
        setSemesters(list);
        if (!didAutoOpen) {
          didAutoOpen = true;
          if (!editingRef.current) {
            prefs.getLastSemesterId().then((lastId) => {
              if (!lastId) return;
              if (list.some((s) => s.id === lastId)) {
                router.push(`/semester/${lastId}`);
              } else {
                // Last-opened semester was deleted — forget it, stay on the list.
                prefs.clearLastSemesterId();
              }
            });
          }
        }
      })
      .catch((err) => console.warn('list failed', err));
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  function toggleEditing() {
    setEditing((e) => !e);
    setSelected(new Set());
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function batchDelete() {
    const count = selected.size;
    if (count === 0) return;
    Alert.alert(
      'Delete semesters',
      `Delete ${count} ${count === 1 ? 'semester' : 'semesters'}? All their courses, readings and tasks will be lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setEditing(false);
            setSelected(new Set());
            Promise.all([...selected].map((sid) => storage.delete(sid)))
              .catch((err) => console.warn('delete failed', err))
              .then(reload);
          },
        },
      ]
    );
  }

  function confirmDelete(item: SemesterSummary) {
    Alert.alert(
      'Delete semester',
      `Delete "${item.name}"? All its courses, readings and tasks will be lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            storage
              .delete(item.id)
              .then(reload)
              .catch((err) => console.warn('delete failed', err));
          },
        },
      ]
    );
  }

  function showRowActions(item: SemesterSummary) {
    Alert.alert(item.name, undefined, [
      { text: 'Edit', onPress: () => router.push(`/semester-form?id=${item.id}`) },
      { text: 'Export', onPress: () => handleExport(item) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(item) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handleAddSample() {
    ensureSeed(storage)
      .then(reload)
      .catch((err) => console.warn('seed failed', err));
  }

  // Export a single semester via the system share sheet.
  function handleExport(item: SemesterSummary) {
    transfer.exportSemester(item.id).catch((err) => {
      if (err) Alert.alert('Export failed', err instanceof Error ? err.message : String(err));
    });
  }

  // Persist a picked semester, then refresh the list and confirm.
  function finishImport(sem: Semester, keepStatus: boolean) {
    transfer
      .saveImportedSemester(sem, keepStatus)
      .then((res) => {
        reload();
        Alert.alert('Semester imported', `"${res.name}" was imported.`);
      })
      .catch((err) => Alert.alert('Import failed', err instanceof Error ? err.message : String(err)));
  }

  // Pick a .lectio.json semester file, then ask whether to keep or reset
  // progress. A conflicting id is always imported as a new id (never overwrites).
  async function handleImport() {
    try {
      const sem = await transfer.pickSemesterFile();
      if (!sem) return; // cancelled
      const n = sem.courses.length;
      Alert.alert(
        'Import semester',
        `Import "${sem.name}" (${n} ${n === 1 ? 'course' : 'courses'})?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset progress', onPress: () => finishImport(sem, false) },
          { text: 'Keep progress', onPress: () => finishImport(sem, true) },
        ]
      );
    } catch (err) {
      Alert.alert('Import failed', err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Semesters',
          // Settings lives top-left as a drawn gear (no emoji, no icon library):
          // an 8-tooth star from two rotated squares with a center hole; Edit/Done
          // sits top-right like the other list screens.
          headerLeft: () => (
            <Pressable
              onPress={() => router.push('/settings')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              style={styles.gearBtn}
            >
              <View style={[styles.gearTooth, { backgroundColor: theme.accent }]} />
              <View
                style={[styles.gearTooth, styles.gearToothRotated, { backgroundColor: theme.accent }]}
              />
              <View style={[styles.gearHole, { backgroundColor: theme.surface }]} />
            </Pressable>
          ),
          headerRight: () =>
            editing ? (
              <View style={styles.headerActions}>
                <Pressable onPress={batchDelete} disabled={selected.size === 0}>
                  <Text
                    style={{
                      color: selected.size === 0 ? theme.muted : '#ef4444',
                      fontSize: 15,
                      fontWeight: '600',
                    }}
                  >
                    Delete{selected.size > 0 ? ` (${selected.size})` : ''}
                  </Text>
                </Pressable>
                <Pressable onPress={toggleEditing}>
                  <Text style={{ color: theme.accent, fontSize: 15 }}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.headerActions}>
                <Pressable onPress={handleImport}>
                  <Text style={{ color: theme.accent, fontSize: 15 }}>Import</Text>
                </Pressable>
                {(semesters?.length ?? 0) > 0 && (
                  <Pressable onPress={toggleEditing}>
                    <Text style={{ color: theme.accent, fontSize: 15 }}>Edit</Text>
                  </Pressable>
                )}
              </View>
            ),
        }}
      />
      {semesters !== null && semesters.length === 0 ? (
        <View style={[styles.center, { backgroundColor: theme.background }]}>
          <Text style={{ color: theme.muted }}>No semesters yet.</Text>
          <Pressable
            style={[styles.emptyBtn, { backgroundColor: theme.accent }]}
            onPress={() => router.push('/semester-form')}
          >
            <Text style={styles.emptyBtnText}>Create your first semester</Text>
          </Pressable>
          <Pressable
            style={[styles.emptyBtnOutline, { borderColor: theme.border }]}
            onPress={handleAddSample}
          >
            <Text style={[styles.emptyBtnOutlineText, { color: theme.text }]}>Add sample semester</Text>
          </Pressable>
          <Pressable
            style={[styles.emptyBtnOutline, { borderColor: theme.border }]}
            onPress={handleImport}
          >
            <Text style={[styles.emptyBtnOutlineText, { color: theme.text }]}>Import a semester</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={styles.list}
          data={semesters ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SwipeableRow
              enabled={!editing}
              editColor={theme.accent}
              onEdit={() => router.push(`/semester-form?id=${item.id}`)}
              onDelete={() => confirmDelete(item)}
            >
              <Pressable
                onPress={() =>
                  editing ? toggleSelect(item.id) : router.push(`/semester/${item.id}`)
                }
                onLongPress={editing ? undefined : () => showRowActions(item)}
                style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={styles.rowLeft}>
                  {editing && (
                    <View
                      style={[
                        styles.selectCircle,
                        { borderColor: theme.border },
                        selected.has(item.id) && {
                          backgroundColor: theme.accent,
                          borderColor: theme.accent,
                        },
                      ]}
                    />
                  )}
                  <Text style={[styles.rowTitle, { color: theme.text }]}>{item.name}</Text>
                </View>
                <Text style={[styles.chevron, { color: theme.muted }]}>›</Text>
              </Pressable>
            </SwipeableRow>
          )}
        />
      )}
      <Fab onPress={() => router.push('/add?context=semester')} />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  list: { padding: 16, gap: 12, paddingBottom: 112 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  selectCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  rowTitle: { fontSize: 17, fontWeight: '600' },
  chevron: { fontSize: 22 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 4 },
  gearBtn: { marginLeft: 4, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  gearTooth: { position: 'absolute', width: 18, height: 18, borderRadius: 4 },
  gearToothRotated: { transform: [{ rotate: '45deg' }] },
  gearHole: { width: 8, height: 8, borderRadius: 4 },
  emptyBtn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: 8,
  },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  emptyBtnOutline: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyBtnOutlineText: { fontWeight: '600', fontSize: 16 },
});
