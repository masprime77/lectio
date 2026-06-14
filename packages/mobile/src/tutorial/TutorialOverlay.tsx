// Full-screen paged walkthrough shown over the app. The faithful mobile
// equivalent of the desktop's spotlight tour: a dimmed backdrop with a centered
// card per step (title + description), a "Step n of total" counter, and
// Back / Skip / Next (Done on the last step). RN core Modal only — no new deps.
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { TUTORIAL_STEPS } from './steps';
import { useTutorial } from './TutorialProvider';

export function TutorialOverlay() {
  const theme = useTheme();
  const { active, index, total, next, back, skip } = useTutorial();

  if (!active) return null;

  const step = TUTORIAL_STEPS[index];
  if (!step) return null;

  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={skip}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.counter, { color: theme.muted }]}>
            Step {index + 1} of {total}
          </Text>
          <Text style={[styles.title, { color: theme.text }]}>{step.title}</Text>
          <Text style={[styles.description, { color: theme.muted }]}>{step.description}</Text>

          <View style={styles.buttons}>
            <Pressable
              onPress={skip}
              style={({ pressed }) => [styles.textBtn, pressed && styles.pressed]}
            >
              <Text style={[styles.textBtnLabel, { color: theme.muted }]}>Skip</Text>
            </Pressable>

            <View style={styles.rightButtons}>
              {!isFirst && (
                <Pressable
                  onPress={back}
                  style={({ pressed }) => [styles.textBtn, pressed && styles.pressed]}
                >
                  <Text style={[styles.textBtnLabel, { color: theme.accent }]}>Back</Text>
                </Pressable>
              )}
              <Pressable
                onPress={next}
                style={({ pressed }) => [
                  styles.nextBtn,
                  { backgroundColor: theme.accent },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.nextBtnLabel}>{isLast ? 'Done' : 'Next'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    gap: 10,
  },
  counter: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: '700' },
  description: { fontSize: 15, lineHeight: 22 },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  rightButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  textBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  textBtnLabel: { fontSize: 15, fontWeight: '600' },
  nextBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnLabel: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  pressed: { opacity: 0.6 },
});
