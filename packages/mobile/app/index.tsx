import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ensureSeed, storage } from '../src/storage';
import { useTheme } from '../src/theme';
import { SwipeableRow } from '../src/components/SwipeableRow';
import type { SemesterSummary } from '../types/lectio-core';

export default function SemestersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [semesters, setSemesters] = useState<SemesterSummary[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const reload = useCallback(() => {
    return storage
      .list()
      .then(setSemesters)
      .catch((err) => console.warn('list failed', err));
  }, []);

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
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(item) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handleAddSample() {
    ensureSeed(storage)
      .then(reload)
      .catch((err) => console.warn('seed failed', err));
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Semesters',
          headerLeft: () =>
            (semesters?.length ?? 0) > 0 ? (
              <Pressable onPress={toggleEditing} style={{ marginLeft: 4 }}>
                <Text style={{ color: theme.accent, fontSize: 15 }}>
                  {editing ? 'Done' : 'Edit'}
                </Text>
              </Pressable>
            ) : null,
          headerRight: () =>
            editing ? (
              <Pressable
                onPress={batchDelete}
                disabled={selected.size === 0}
                style={{ marginRight: 4 }}
              >
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
            ) : (
              <Pressable onPress={() => router.push('/profile')} style={{ marginRight: 4 }}>
                <Text style={{ color: theme.accent, fontSize: 15 }}>Profile</Text>
              </Pressable>
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
      {!editing && (
        <Pressable
          style={[
            styles.fab,
            { backgroundColor: theme.accent, bottom: insets.bottom + 24 },
          ]}
          onPress={() => router.push('/semester-form')}
        >
          <Text style={styles.fabText}>+ New</Text>
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  list: { padding: 16, gap: 12, paddingBottom: 112 },
  fab: {
    position: 'absolute',
    right: 20,
    height: 56,
    paddingHorizontal: 24,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 17 },
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
