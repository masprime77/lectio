// Per-semester tag editor body, embedded in the add-sheet's Tags tab.
// Mirrors the desktop's Tags tab: Readings/Tasks tags grouped by Pending/Done
// section, with add / rename / recolor / delete / reorder going through the
// shared @lectio/core tag functions so the semester JSON stays identical.
// Protected tags (pending/studied) can be recolored but not renamed, deleted,
// or reordered. The host renders the surrounding sheet and scroll view.
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  addTag,
  deleteTag,
  editTag,
  getReadingTags,
  getTaskTags,
  isProtectedTag,
  reorderTags,
} from '@lectio/core/planner-core';
import { storage } from '../storage';
import { useTheme } from '../theme';
import { FormTabs } from '../components/FormTabs';
import type { Semester, Tag, TagSection } from '../../types/lectio-core';

type TagType = 'reading' | 'task';

// Same fixed palette as the course form's color swatches.
const TAG_COLORS = ['#4a90d9', '#22c55e', '#ef4444', '#f97316',
                    '#a855f7', '#eab308', '#14b8a6', '#ec4899'];

function SwatchRow({ selected, onPick }: { selected: string; onPick: (c: string) => void }) {
  const theme = useTheme();
  // An off-palette current color leads the row so picking never loses it.
  const palette = TAG_COLORS.includes(selected) ? TAG_COLORS : [selected, ...TAG_COLORS];
  return (
    <View style={styles.swatchRow}>
      {palette.map((c) => (
        <Pressable
          key={c}
          onPress={() => onPick(c)}
          style={[
            styles.swatch,
            { backgroundColor: c },
            c === selected && { borderWidth: 2, borderColor: theme.text },
          ]}
        />
      ))}
    </View>
  );
}

function TagRow({
  tag,
  pickerOpen,
  onTogglePicker,
  onPickColor,
  onRename,
  onMove,
  onDelete,
}: {
  tag: Tag;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onPickColor: (color: string) => void;
  onRename: (name: string) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const isProtected = isProtectedTag(tag.id);
  const [name, setName] = useState(tag.name);

  return (
    <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.rowMain}>
        <Pressable
          onPress={onTogglePicker}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Change color of ${tag.name}`}
          style={[styles.colorDot, { backgroundColor: tag.color }]}
        />
        {isProtected ? (
          <Text style={[styles.name, { color: theme.text }]}>{tag.name}</Text>
        ) : (
          <TextInput
            style={[styles.nameInput, { color: theme.text }]}
            value={name}
            onChangeText={setName}
            onBlur={() => {
              const v = name.trim();
              if (v) onRename(v);
              else setName(tag.name);
            }}
          />
        )}
        {!isProtected && (
          <View style={styles.rowActions}>
            <Pressable onPress={() => onMove(-1)} hitSlop={6} accessibilityLabel="Move up">
              <Text style={[styles.actionGlyph, { color: theme.muted }]}>↑</Text>
            </Pressable>
            <Pressable onPress={() => onMove(1)} hitSlop={6} accessibilityLabel="Move down">
              <Text style={[styles.actionGlyph, { color: theme.muted }]}>↓</Text>
            </Pressable>
            <Pressable onPress={onDelete} hitSlop={6} accessibilityLabel="Delete tag">
              <Text style={[styles.actionGlyph, { color: '#ef4444' }]}>✕</Text>
            </Pressable>
          </View>
        )}
      </View>
      {pickerOpen && <SwatchRow selected={tag.color} onPick={onPickColor} />}
    </View>
  );
}

export function TagsFields({ semesterId }: { semesterId: string }) {
  const theme = useTheme();
  const [semester, setSemester] = useState<Semester | null>(null);
  const [type, setType] = useState<TagType>('reading');
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [adding, setAdding] = useState<TagSection | null>(null);
  const [addName, setAddName] = useState('');
  const [addColor, setAddColor] = useState(TAG_COLORS[0]);

  useEffect(() => {
    let active = true;
    storage.get(semesterId).then((s) => {
      if (active) setSemester(s);
    });
    return () => {
      active = false;
    };
  }, [semesterId]);

  const persist = useCallback(
    (next: Semester) => {
      setSemester(next);
      storage.save(semesterId, next).catch((err) => console.warn('save failed', err));
    },
    [semesterId]
  );

  function switchType(tab: string) {
    setType(tab === 'Tasks' ? 'task' : 'reading');
    setPickerFor(null);
    setAdding(null);
  }

  function recolorTag(tagId: string, color: string) {
    if (!semester) return;
    const next: Semester = JSON.parse(JSON.stringify(semester));
    editTag(next, type, tagId, { color });
    persist(next);
    setPickerFor(null);
  }

  function renameTag(tagId: string, name: string) {
    if (!semester) return;
    const next: Semester = JSON.parse(JSON.stringify(semester));
    editTag(next, type, tagId, { name });
    persist(next);
  }

  // Swap-based reorder within the type's full tag list. Protected tags hold
  // their position (their rows have no controls, and a neighbor can't swap
  // past them), and moves stay within the tag's section — like the desktop.
  function moveTag(tag: Tag, dir: -1 | 1) {
    if (!semester) return;
    const tags = type === 'reading' ? getReadingTags(semester) : getTaskTags(semester);
    const ids = tags.map((t) => t.id);
    const idx = ids.indexOf(tag.id);
    const swap = idx + dir;
    if (idx === -1 || swap < 0 || swap >= ids.length) return;
    if (isProtectedTag(ids[swap]) || tags[swap].section !== tag.section) return;
    [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
    const next: Semester = JSON.parse(JSON.stringify(semester));
    reorderTags(next, type, ids);
    persist(next);
  }

  function confirmDeleteTag(tag: Tag) {
    Alert.alert(
      'Delete tag',
      `Delete "${tag.name}"? Items wearing it keep their progress but lose the tag.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (!semester) return;
            const next: Semester = JSON.parse(JSON.stringify(semester));
            deleteTag(next, type, tag.id);
            persist(next);
          },
        },
      ]
    );
  }

  function openAdd(section: TagSection) {
    setAdding(section);
    setAddName('');
    setAddColor(TAG_COLORS[0]);
    setPickerFor(null);
  }

  function submitAdd(section: TagSection) {
    const name = addName.trim();
    if (!name || !semester) return;
    const next: Semester = JSON.parse(JSON.stringify(semester));
    addTag(next, type, { name, color: addColor, section });
    persist(next);
    setAdding(null);
  }

  const tags = semester
    ? type === 'reading'
      ? getReadingTags(semester)
      : getTaskTags(semester)
    : [];

  const renderGroup = (section: TagSection, label: string) => (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: theme.text }]}>{label}</Text>
      {tags
        .filter((t) => t.section === section)
        .map((tag) => (
          <TagRow
            key={tag.id}
            tag={tag}
            pickerOpen={pickerFor === tag.id}
            onTogglePicker={() => setPickerFor((cur) => (cur === tag.id ? null : tag.id))}
            onPickColor={(c) => recolorTag(tag.id, c)}
            onRename={(name) => renameTag(tag.id, name)}
            onMove={(dir) => moveTag(tag, dir)}
            onDelete={() => confirmDeleteTag(tag)}
          />
        ))}
      {adding === section ? (
        <View style={[styles.addForm, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            style={[styles.addInput, { backgroundColor: theme.surfaceAlt, color: theme.text }]}
            placeholder="Tag name"
            placeholderTextColor={theme.muted}
            value={addName}
            onChangeText={setAddName}
            autoFocus
          />
          <SwatchRow selected={addColor} onPick={setAddColor} />
          <View style={styles.addActions}>
            <Pressable onPress={() => setAdding(null)} hitSlop={6}>
              <Text style={{ color: theme.muted, fontSize: 15 }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => submitAdd(section)} hitSlop={6} disabled={!addName.trim()}>
              <Text
                style={{
                  color: addName.trim() ? theme.accent : theme.muted,
                  fontSize: 15,
                  fontWeight: '600',
                }}
              >
                Add
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => openAdd(section)} hitSlop={6}>
          <Text style={[styles.addBtn, { color: theme.accent }]}>+ Add tag</Text>
        </Pressable>
      )}
    </View>
  );

  if (!semester) {
    return <ActivityIndicator color={theme.accent} style={{ marginTop: 24 }} />;
  }

  return (
    <View style={styles.root}>
      <FormTabs
        tabs={['Readings', 'Tasks']}
        active={type === 'reading' ? 'Readings' : 'Tasks'}
        onSelect={switchType}
      />
      <Text style={[styles.hint, { color: theme.muted }]}>
        Items wearing a Done tag count toward progress. Tap a color dot to recolor.
      </Text>
      {renderGroup('pending', 'Pending')}
      {renderGroup('done', 'Done')}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 16 },
  hint: { fontSize: 12 },
  group: { marginTop: 20 },
  groupTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  row: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  colorDot: { width: 24, height: 24, borderRadius: 12 },
  name: { flex: 1, fontSize: 15, fontWeight: '500' },
  nameInput: { flex: 1, fontSize: 15, fontWeight: '500', padding: 0 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  actionGlyph: { fontSize: 16 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 32, height: 32, borderRadius: 16 },
  addBtn: { fontSize: 15, paddingVertical: 4 },
  addForm: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 12,
  },
  addInput: {
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  addActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 20,
  },
});
