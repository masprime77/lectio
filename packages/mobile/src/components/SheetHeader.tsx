// Header for the add/edit modal sheets: a circular close button on the left
// plus the centered sheet title (the native stack header is hidden on these
// screens). The button dismisses the modal on both platforms; on iOS the
// sheet can additionally still be dragged down to dismiss natively.
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

export function SheetHeader({ title }: { title: string }) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.row, Platform.OS === 'android' && { marginTop: insets.top }]}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={({ pressed }) => [
          styles.close,
          { backgroundColor: theme.surfaceAlt, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text style={[styles.closeX, { color: theme.muted }]}>✕</Text>
      </Pressable>
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
        {title}
      </Text>
      {/* Mirrors the close button's width so the title stays optically centered. */}
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeX: { fontSize: 15, fontWeight: '600', lineHeight: 18 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', marginHorizontal: 8 },
  spacer: { width: 30 },
});
