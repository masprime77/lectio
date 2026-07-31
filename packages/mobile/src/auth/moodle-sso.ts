import * as WebBrowser from 'expo-web-browser';
import { buildLaunchUrl, parseMoodleMobileRedirect } from '@lectio/core/integrations/moodle-sso';

// Drives Moodle's SSO login via the system browser (ASWebAuthenticationSession
// on iOS / Custom Tabs on Android, through expo-web-browser) and captures the
// moodlemobile://token=... redirect — the same mechanism oauth.ts already
// uses to capture Google/Apple's OAuth redirect for Supabase sign-in (see
// signInWithProvider there for the sibling pattern). This does NOT call
// WebBrowser.maybeCompleteAuthSession() itself — oauth.ts already calls it
// once at module load, and it only needs to run once per app.
//
// Same caveat as oauth.ts: this needs a dev build. In Expo Go, the redirect
// round-trip for custom schemes is unreliable.
export interface MoodleSsoResult {
  wstoken: string;
  privatetoken?: string;
  passport?: string;
}

export async function captureMoodleToken(baseUrl: string): Promise<MoodleSsoResult> {
  const launchUrl = buildLaunchUrl(baseUrl);
  // The redirect prefix expo-web-browser watches for — matches
  // buildLaunchUrl's default urlscheme ('moodlemobile').
  const redirectTo = 'moodlemobile://token=';

  const result = await WebBrowser.openAuthSessionAsync(launchUrl, redirectTo);
  if (result.type !== 'success' || !result.url) {
    throw new Error('Moodle sign-in was cancelled.');
  }

  const parsed = parseMoodleMobileRedirect(result.url);
  if (!parsed) {
    throw new Error('Could not parse the Moodle SSO redirect.');
  }
  return parsed;
}
