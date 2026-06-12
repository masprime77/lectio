// Bordered "bubble" header action (pill: surface background + hairline
// border), so header controls read as distinct buttons rather than bare
// text. Used for the Edit action next to the ↑↓ sort bubble.
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme';

export function HeaderBubble({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.bubble,
        { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.label, { color: theme.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bubble: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 15 },
});
