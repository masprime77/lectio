import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { storage } from '../src/storage';
import { useTheme } from '../src/theme';
import type { SemesterSummary } from '../types/lectio-core';

export default function SemestersScreen() {
  const theme = useTheme();
  const [semesters, setSemesters] = useState<SemesterSummary[] | null>(null);

  // Reload on focus so changes made deeper in the stack are reflected.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      storage.list().then((list) => {
        if (active) setSemesters(list);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  if (semesters !== null && semesters.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.muted }}>No semesters yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.list}
      data={semesters ?? []}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Link href={`/semester/${item.id}`} asChild>
          <Pressable
            style={[
              styles.row,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.rowTitle, { color: theme.text }]}>{item.name}</Text>
            <Text style={[styles.chevron, { color: theme.muted }]}>›</Text>
          </Pressable>
        </Link>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 12 },
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
});
