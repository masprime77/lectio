// iOS's number-pad/decimal-pad keyboards have no Return/Done key, so a
// TextInput using them can't be dismissed without backgrounding the app or
// navigating away. This renders a "Done" accessory bar via RN's
// InputAccessoryView (the standard iOS-only mechanism for this) and no-ops on
// Android, whose number-pad already has a system-provided way to dismiss.
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

export const NUMERIC_KEYBOARD_ACCESSORY_ID = 'lectio-numeric-done';

export function NumericKeyboardDoneBar() {
  const theme = useTheme();
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={NUMERIC_KEYBOARD_ACCESSORY_ID}>
      <View style={[styles.bar, { backgroundColor: theme.surfaceAlt, borderTopColor: theme.border }]}>
        <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8}>
          <Text style={[styles.doneText, { color: theme.accent }]}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneText: { fontSize: 16, fontWeight: '600' },
});
