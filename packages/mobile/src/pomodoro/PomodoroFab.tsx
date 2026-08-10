// The study-timer FAB. Idle: a round clock button that opens the setup sheet.
// Running: a wider pill showing the live MM:SS, tapped to pause/resume, with a
// small stop square to end it and a long-press to skip to the next phase.
// Done: an amber pill with a tick reading "Done" instead of a stopped 00:00,
// for a phase that finished and is waiting on the "what's next?" answer —
// tapping it re-opens that question.
//
// Sits above the "+" Fab (which keeps its own bottom offset), so the hosting
// screen's list needs enough bottom padding for both — see the paddingBottom
// bump in the screens that use it.
//
// Every glyph here is drawn from plain Views (clock face, pause bars, play
// triangle, stop square) rather than an emoji or an icon library, matching the
// rest of the mobile UI.
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatClock, phaseLabel } from '@lectio/core/pomodoro-core';
import { useTheme } from '../theme';
import { usePomodoro } from './PomodoroProvider';
import { PomodoroSetupSheet } from './PomodoroSetupSheet';
import type { Semester } from '../../types/lectio-core';

export function PomodoroFab({
  semester,
  defaultCourseId = null,
}: {
  semester: Semester | null;
  defaultCourseId?: string | null;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session, settings, remaining, paused, awaiting, promptAdvance, start, togglePause, skip, stop } =
    usePomodoro();
  const [sheetOpen, setSheetOpen] = useState(false);

  const idle = session.phase === 'idle';
  const focus = session.phase === 'work';
  // Sits one FAB-height plus a gap above the "+" button.
  const bottom = insets.bottom + 24 + 56 + 12;

  function confirmStop() {
    Alert.alert('Stop the timer?', 'Time studied so far in this block is still counted.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Stop', style: 'destructive', onPress: stop },
    ]);
  }

  const sheet = (
    <PomodoroSetupSheet
      visible={sheetOpen}
      semester={semester}
      initialCourseId={defaultCourseId}
      initialSettings={settings}
      onClose={() => setSheetOpen(false)}
      onStart={({ settings: next, courseId }) => {
        setSheetOpen(false);
        void start({
          settings: next,
          courseId,
          semesterId: semester ? semester.id : null,
        });
      }}
    />
  );

  if (idle) {
    return (
      <>
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Start a study timer"
          style={({ pressed }) => [
            styles.fab,
            styles.round,
            {
              bottom,
              backgroundColor: theme.surface,
              borderColor: theme.border,
              borderWidth: StyleSheet.hairlineWidth,
            },
            pressed && { opacity: 0.8 },
          ]}
        >
          <ClockGlyph color={theme.accent} />
        </Pressable>
        {sheet}
      </>
    );
  }

  // Finished, waiting for an answer: amber and static, so it never reads as a
  // countdown that froze. Tapping re-asks; the stop square still ends it.
  if (awaiting) {
    return (
      <>
        <Pressable
          onPress={promptAdvance}
          accessibilityRole="button"
          accessibilityLabel={`Study timer, ${phaseLabel(session.phase)} finished`}
          accessibilityHint="Tap to choose whether to move on to the next phase"
          style={({ pressed }) => [
            styles.fab,
            styles.pill,
            { bottom, backgroundColor: DONE, borderWidth: 0 },
            pressed && { opacity: 0.8 },
          ]}
        >
          <CheckGlyph color="#fff" />
          <Text style={[styles.clock, { color: '#fff' }]}>Done</Text>
          <Pressable
            onPress={confirmStop}
            accessibilityRole="button"
            accessibilityLabel="Stop the study timer"
            hitSlop={8}
            style={({ pressed }) => [styles.stopHit, pressed && { opacity: 0.6 }]}
          >
            <View style={[styles.stopSquare, { backgroundColor: '#fff' }]} />
          </Pressable>
        </Pressable>
        {sheet}
      </>
    );
  }

  const onAccent = focus;
  const fg = onAccent ? '#fff' : theme.accent;

  return (
    <>
      <Pressable
        onPress={togglePause}
        onLongPress={skip}
        accessibilityRole="button"
        accessibilityLabel={`Study timer, ${phaseLabel(session.phase)}, ${formatClock(
          remaining
        )} remaining, ${paused ? 'paused' : 'running'}`}
        accessibilityHint="Tap to pause or resume, long-press to skip to the next phase"
        style={({ pressed }) => [
          styles.fab,
          styles.pill,
          {
            bottom,
            backgroundColor: onAccent ? theme.accent : theme.surface,
            borderColor: theme.accent,
            borderWidth: onAccent ? 0 : StyleSheet.hairlineWidth,
          },
          pressed && { opacity: 0.8 },
        ]}
      >
        {paused ? <PlayGlyph color={fg} /> : <PauseGlyph color={fg} />}
        <Text style={[styles.clock, { color: fg }]}>{formatClock(remaining)}</Text>
        <Pressable
          onPress={confirmStop}
          accessibilityRole="button"
          accessibilityLabel="Stop the study timer"
          hitSlop={8}
          style={({ pressed }) => [styles.stopHit, pressed && { opacity: 0.6 }]}
        >
          <View style={[styles.stopSquare, { backgroundColor: fg }]} />
        </Pressable>
      </Pressable>
      {sheet}
    </>
  );
}

/** A clock face: a ring with an hour and a minute hand. */
function ClockGlyph({ color }: { color: string }) {
  return (
    <View style={[styles.clockFace, { borderColor: color }]}>
      <View style={[styles.handMinute, { backgroundColor: color }]} />
      <View style={[styles.handHour, { backgroundColor: color }]} />
    </View>
  );
}

function PauseGlyph({ color }: { color: string }) {
  return (
    <View style={styles.pauseWrap}>
      <View style={[styles.pauseBar, { backgroundColor: color }]} />
      <View style={[styles.pauseBar, { backgroundColor: color }]} />
    </View>
  );
}

/** A right-pointing triangle drawn with the transparent-border technique. */
function PlayGlyph({ color }: { color: string }) {
  return <View style={[styles.playTriangle, { borderLeftColor: color }]} />;
}

/** A tick: two edges of a box, rotated 45°. */
function CheckGlyph({ color }: { color: string }) {
  return <View style={[styles.check, { borderColor: color }]} />;
}

// The "waiting for you" amber. Not a theme token: it is the only place in the
// mobile UI that needs it, and it reads the same on both backgrounds.
const DONE = '#e0952f';

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  round: { width: 56, borderRadius: 28 },
  pill: { flexDirection: 'row', gap: 10, borderRadius: 28, paddingHorizontal: 18 },
  // tabular-nums keeps the pill from jittering in width every second.
  clock: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },

  clockFace: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handMinute: { position: 'absolute', width: 2, height: 7, borderRadius: 1, top: 4 },
  handHour: { position: 'absolute', width: 6, height: 2, borderRadius: 1, left: 11, top: 10 },

  pauseWrap: { flexDirection: 'row', gap: 3 },
  pauseBar: { width: 3.5, height: 14, borderRadius: 1 },
  playTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: 'transparent',
  },
  check: {
    width: 14,
    height: 8,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    borderTopWidth: 0,
    borderRightWidth: 0,
    transform: [{ rotate: '-45deg' }],
    marginTop: -3,
  },
  stopHit: { padding: 2 },
  stopSquare: { width: 12, height: 12, borderRadius: 2 },
});
