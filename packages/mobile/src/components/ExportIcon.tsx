import { StyleSheet, View } from 'react-native';

/**
 * A "box with an arrow pointing up" export glyph, drawn from plain Views (no
 * icon library, no emoji): an upward arrow (triangle head + shaft) sitting
 * above an open-top tray. Used as the header Export action.
 */
export function ExportIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View style={[styles.head, { borderBottomColor: color }]} />
      <View style={[styles.shaft, { backgroundColor: color }]} />
      <View style={[styles.tray, { borderColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  head: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  shaft: { width: 2, height: 5 },
  tray: {
    width: 14,
    height: 8,
    marginTop: 1,
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
});
