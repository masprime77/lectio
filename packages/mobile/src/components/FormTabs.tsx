// Tab row shown at the top of the add forms, indicating (and on the item form,
// choosing) what is being added — e.g. ["Semester"], ["Course"], ["Reading", "Task"].
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

interface Props {
  tabs: string[];
  active: string;
  onSelect?: (tab: string) => void;
}

export function FormTabs({ tabs, active, onSelect }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      {tabs.map((tab) => {
        const isActive = tab === active;
        return (
          <Pressable
            key={tab}
            onPress={onSelect ? () => onSelect(tab) : undefined}
            style={[
              styles.tab,
              { backgroundColor: theme.surface, borderColor: theme.border },
              isActive && { backgroundColor: theme.accent, borderColor: theme.accent },
            ]}
          >
            <Text style={[styles.tabText, { color: isActive ? '#fff' : theme.muted }]}>
              {tab}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  tabText: { fontSize: 14, fontWeight: '600' },
});
