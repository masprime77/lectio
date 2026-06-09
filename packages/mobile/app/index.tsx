import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, Stack, useFocusEffect } from 'expo-router';
import { storage } from '../src/storage';
import { useAuth } from '../src/auth/AuthProvider';
import { useTheme } from '../src/theme';
import type { SemesterSummary } from '../types/lectio-core';

export default function SemestersScreen() {
  const theme = useTheme();
  const { signOut } = useAuth();
  const [semesters, setSemesters] = useState<SemesterSummary[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      storage.list().then((list) => {
        if (active) setSemesters(list);
      }).catch((err) => console.warn('list failed', err));
      return () => {
        active = false;
      };
    }, [])
  );

  function handleSignOut() {
    Alert.alert('Sign out', 'Sign out of Lectio?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          setSemesters(null);
          signOut().catch((err) => console.warn('sign out failed', err));
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Semesters',
          headerRight: () => (
            <Pressable onPress={handleSignOut} style={{ marginRight: 4 }}>
              <Text style={{ color: theme.accent, fontSize: 15 }}>Sign out</Text>
            </Pressable>
          ),
        }}
      />
      {semesters !== null && semesters.length === 0 ? (
        <View style={[styles.center, { backgroundColor: theme.background }]}>
          <Text style={{ color: theme.muted }}>No semesters yet.</Text>
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
