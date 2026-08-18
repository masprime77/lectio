// The study-timer FAB. Idle: a round clock button that opens the setup sheet.
// Running: a wider pill showing the live MM:SS, tapped to pause/resume, with a
// small stop square to end it and a long-press to skip to the next phase.
// Done: an amber pill with a tick reading "Done" instead of a stopped 00:00,
// for a phase that finished and is waiting on the "what's next?" answer —
// tapping it re-opens that question.
//
// Lives in the bottom-LEFT corner, its own column: the timer button on the
// baseline (level with the bottom-right "+" Fab, never overlapping it) and the
// smaller study-time button stacked above it. The running pill is anchored by
// its left edge only, so it grows rightwards into the empty middle of the
// screen. The hosting screen's list still needs bottom padding to clear the
// column — see the paddingBottom in the screens that use it.
//
// Every glyph here is drawn from plain Views (clock face, pause bars, play
// triangle, stop square) rather than an emoji or an icon library, matching the
// rest of the mobile UI.
//
// Both non-idle pills stack a cycle-dot row, the clock and a phase-progress bar
// in the space the clock alone used to occupy, so the pill keeps its 56px
// height and its width still follows the clock text.
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatClock, phaseDurationSeconds, phaseLabel } from '@lectio/core/pomodoro-core';
import { useTheme } from '../theme';
import { usePomodoro } from './PomodoroProvider';
import { PomodoroSetupSheet } from './PomodoroSetupSheet';
import { StudyTimeDashboard } from './StudyTimeDashboard';
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
  const [dashboardOpen, setDashboardOpen] = useState(false);

  const idle = session.phase === 'idle';
  const focus = session.phase === 'work';
  // Baseline of the left column: the same 24pt above the safe area the "+" Fab
  // uses on the right, so the two sit level.
  const bottom = insets.bottom + 24;
  // insets.left is 0 in portrait and picks up the notch in landscape.
  const left = insets.left + 20;

  // How far through the current phase, 0..1. A paused session freezes because
  // `remaining` does; a finished one waiting on an answer reads as full.
  const phaseSeconds = phaseDurationSeconds(session.phase, settings);
  const progress = awaiting
    ? 1
    : phaseSeconds > 0
      ? Math.min(1, Math.max(0, (phaseSeconds - remaining) / phaseSeconds))
      : 0;

  // One dot per focus block in the cycle. completedPomodoros reaches the full
  // count during the long break (every dot lit) and core resets it to 0 by
  // returning the session to idle once that break ends.
  const cycle = settings.pomodorosUntilLongBreak;
  const within = session.completedPomodoros % cycle;
  const blocksDone = within === 0 && session.completedPomodoros > 0 ? cycle : within;

  function confirmStop() {
    Alert.alert('Stop the timer?', 'Time studied so far in this block is still counted.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Stop', style: 'destructive', onPress: stop },
    ]);
  }

  // A smaller satellite above the timer button, in every state — the pill is
  // already carrying tap-to-pause, long-press-to-skip and stop, and study time
  // has to stay reachable while a session runs (that is where the course
  // switcher lives). Nudged 6pt right of the column edge so its 44pt circle is
  // centred over the 56pt timer button below it.
  const studyButton = (
    <Pressable
      onPress={() => setDashboardOpen(true)}
      accessibilityRole="button"
      accessibilityLabel="Study time"
      accessibilityHint="Shows tracked study time per course"
      style={({ pressed }) => [
        styles.fab,
        styles.studyFab,
        {
          bottom: bottom + 56 + 10,
          left: left + 6,
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderWidth: StyleSheet.hairlineWidth,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <BarsGlyph color={theme.accent} />
    </Pressable>
  );

  const dashboard = (
    <StudyTimeDashboard
      visible={dashboardOpen}
      semester={semester}
      onClose={() => setDashboardOpen(false)}
    />
  );

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
              left,
              backgroundColor: theme.surface,
              borderColor: theme.border,
              borderWidth: StyleSheet.hairlineWidth,
            },
            pressed && { opacity: 0.8 },
          ]}
        >
          <ClockGlyph color={theme.accent} />
        </Pressable>
        {studyButton}
        {sheet}
        {dashboard}
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
          accessibilityLabel={`Study timer, ${phaseLabel(
            session.phase
          )} finished, ${blocksDone} of ${cycle} focus blocks done`}
          accessibilityHint="Tap to choose whether to move on to the next phase"
          style={({ pressed }) => [
            styles.fab,
            styles.pill,
            { bottom, left, backgroundColor: DONE, borderWidth: 0 },
            pressed && { opacity: 0.8 },
          ]}
        >
          <CheckGlyph color="#fff" />
          <PhaseMeter
            label="Done"
            progress={1}
            dots={cycle}
            filled={blocksDone}
            fg="#fff"
            track="rgba(255,255,255,0.4)"
          />
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
        {studyButton}
        {sheet}
        {dashboard}
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
        )} remaining, ${paused ? 'paused' : 'running'}, ${blocksDone} of ${cycle} focus blocks done`}
        accessibilityHint="Tap to pause or resume, long-press to skip to the next phase"
        style={({ pressed }) => [
          styles.fab,
          styles.pill,
          {
            bottom,
            left,
            backgroundColor: onAccent ? theme.accent : theme.surface,
            borderColor: theme.accent,
            borderWidth: onAccent ? 0 : StyleSheet.hairlineWidth,
          },
          pressed && { opacity: 0.8 },
        ]}
      >
        {paused ? <PlayGlyph color={fg} /> : <PauseGlyph color={fg} />}
        <PhaseMeter
          label={formatClock(remaining)}
          progress={progress}
          dots={cycle}
          filled={blocksDone}
          fg={fg}
          track={onAccent ? 'rgba(255,255,255,0.4)' : theme.track}
        />
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
      {studyButton}
      {sheet}
      {dashboard}
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

/**
 * The middle of a pill: cycle dots, the clock (or "Done"), and a phase-progress
 * bar. Everything is centred on the clock text, which still sets the pill's
 * width — the bar stretches to it and the dots stay narrower. Dots are dropped
 * for unusually long cycles, where a row of them would be wider than the clock
 * and would push the pill out of shape; the bar always shows.
 */
function PhaseMeter({
  label,
  progress,
  dots,
  filled,
  fg,
  track,
}: {
  label: string;
  progress: number;
  dots: number;
  filled: number;
  fg: string;
  track: string;
}) {
  return (
    <View style={styles.meter}>
      {dots <= 8 && (
        <View style={styles.dots}>
          {Array.from({ length: dots }, (_, i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: i < filled ? fg : track }]}
            />
          ))}
        </View>
      )}
      <Text style={[styles.clock, { color: fg }]}>{label}</Text>
      <View style={[styles.progressTrack, { backgroundColor: track }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: fg, width: `${Math.round(progress * 100)}%` },
          ]}
        />
      </View>
    </View>
  );
}

/** Three bars of different heights — the study-time button's glyph. */
function BarsGlyph({ color }: { color: string }) {
  return (
    <View style={styles.barsWrap}>
      <View style={[styles.bar, { height: 7, backgroundColor: color }]} />
      <View style={[styles.bar, { height: 15, backgroundColor: color }]} />
      <View style={[styles.bar, { height: 11, backgroundColor: color }]} />
    </View>
  );
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
    // Left-anchored only: the pill's width follows its content and grows
    // rightwards, into the gap before the bottom-right "+" Fab. Its widest form
    // is an H:MM:SS clock (~160pt incl. glyph, stop square and padding), which
    // still clears the "+" on a 320pt screen. The components override `left`
    // with the safe-area-aware value.
    left: 20,
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
  // Smaller than the timer button and centred over it (left + (56-44)/2, set
  // inline alongside the safe-area offset).
  studyFab: { width: 44, height: 44, borderRadius: 22 },
  barsWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 15 },
  bar: { width: 4, borderRadius: 1.5 },
  pill: { flexDirection: 'row', gap: 10, borderRadius: 28, paddingHorizontal: 18 },
  // tabular-nums keeps the pill from jittering in width every second.
  clock: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'], textAlign: 'center' },

  // Dots + clock + progress bar, stacked in the clock's old slot. `stretch`
  // hands the bar the clock's width, so nothing here widens the pill.
  meter: { alignItems: 'stretch', gap: 3 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  progressTrack: { height: 3, borderRadius: 1.5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 1.5 },

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
