// Calendar entry for 'YYYY-MM-DD' string values. The picker is UX only — the
// value stays the exact string the desktop writes ('' = no date).
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useTheme } from '../theme';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Local-time formatter — toISOString() would roll the date back a day in
// negative-offset timezones.
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface DateFieldProps {
  value: string; // 'YYYY-MM-DD' or '' for none
  onChange: (next: string) => void; // emits 'YYYY-MM-DD' or '' when cleared
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
}

export function DateField({ value, onChange, placeholder, allowClear, disabled }: DateFieldProps) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const [show, setShow] = useState(false);

  // Picker starts at the current value when valid, today otherwise (the field
  // keeps showing the placeholder until the user actually picks).
  const pickerDate = DATE_RE.test(value) ? new Date(value + 'T00:00:00') : new Date();

  // Android's picker is a one-shot dialog: fires once with 'set' or 'dismissed'.
  function handleAndroidChange(event: DateTimePickerEvent, date?: Date) {
    setShow(false);
    if (event.type === 'set' && date) onChange(toYMD(date));
  }

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.field, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => !disabled && setShow(true)}
        disabled={disabled}
      >
        <Text style={{ color: value ? theme.text : theme.muted, fontSize: 16 }}>
          {value || placeholder || 'Select date'}
        </Text>
      </Pressable>

      {allowClear && value !== '' && (
        <Pressable onPress={() => onChange('')} disabled={disabled}>
          <Text style={{ color: theme.accent, fontSize: 15 }}>Clear</Text>
        </Pressable>
      )}

      {show && Platform.OS === 'android' && (
        <DateTimePicker value={pickerDate} mode="date" onChange={handleAndroidChange} />
      )}

      {/* iOS: inline picker in a bottom-sheet modal with a Done button. */}
      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="slide">
          <Pressable style={styles.backdrop} onPress={() => setShow(false)} />
          <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
            <View style={[styles.sheetBar, { borderBottomColor: theme.border }]}>
              <Pressable onPress={() => setShow(false)}>
                <Text style={{ color: theme.accent, fontSize: 16, fontWeight: '600' }}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display="inline"
              onChange={(_event, date) => {
                if (date) onChange(toYMD(date));
              }}
              accentColor={theme.accent}
              themeVariant={scheme === 'dark' ? 'dark' : 'light'}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  field: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
    paddingHorizontal: 8,
  },
  sheetBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
