// Shared guard for every "Import from Moodle" entry point outside the Moodle
// screen itself (the semester detail screen's course action sheet, the add-
// sheet's Course tab). If no account is connected, offers to navigate to
// /moodle — where Part A's account list/connect flow lives — instead of
// silently opening an empty picker. Takes the caller's router instance since
// this is a plain async function, not a hook. Resolves true when it's safe
// for the caller to proceed with its own navigation.
import { Alert } from 'react-native';
import type { useRouter } from 'expo-router';
import { listMoodleAccounts } from '../auth/moodle-token-store';

export function ensureMoodleAccountOrPrompt(
  router: ReturnType<typeof useRouter>
): Promise<boolean> {
  return listMoodleAccounts()
    .catch(() => [])
    .then(
      (accounts) =>
        new Promise<boolean>((resolve) => {
          if (accounts.length > 0) {
            resolve(true);
            return;
          }
          Alert.alert('No Moodle account connected', 'Connect one now?', [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            {
              text: 'Connect',
              onPress: () => {
                router.push('/moodle');
                resolve(false); // navigating to /moodle instead; caller's own action doesn't proceed
              },
            },
          ]);
        })
    );
}
