import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import { ensureSeed, storage } from '../src/storage';
import { useTheme } from '../src/theme';
import type { SemesterSummary } from '../types/lectio-core';

export default function SemestersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [semesters, setSemesters] = useState<SemesterSummary[] | null>(null);

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
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable onPress={() => router.push('/profile')}>
                <Text style={{ color: theme.accent, fontSize: 15 }}>Profile</Text>
              </Pressable>
              <Pressable
                style={[styles.newBtn, { backgroundColor: theme.accent }]}
                onPress={() => router.push('/semester-form')}
              >
                <Text style={styles.newBtnText}>+ New</Text>
              </Pressable>
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
        </View>
      ) : (
        <FlatList
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={styles.list}
          data={semesters ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Link href={`/semester/${item.id}`} asChild>
              <Pressable
                onLongPress={() => showRowActions(item)}
                style={StyleSheet.flatten([
                  styles.row,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ])}
              >
                <Text style={[styles.rowTitle, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.chevron, { color: theme.muted }]}>›</Text>
              </Pressable>
            </Link>
          )}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  list: { padding: 16, gap: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 4 },
  newBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  newBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
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
