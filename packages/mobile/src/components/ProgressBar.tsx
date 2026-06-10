import { View } from 'react-native';
import { useTheme } from '../theme';

/** A thin progress track filled to `value` percent (0..100). */
export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View
      style={{
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.track,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 4,
          backgroundColor: color || theme.accent,
        }}
      />
    </View>
  );
}
