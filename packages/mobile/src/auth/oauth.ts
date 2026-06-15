import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../supabase/client';

WebBrowser.maybeCompleteAuthSession();

// Browser-based provider sign-in. Works on the dev build (Phase 18); in Expo Go
// the redirect round-trip is unreliable, so callers guard with isExpoGo.
export async function signInWithProvider(provider: 'google' | 'apple'): Promise<void> {
  const redirectTo = Linking.createURL('/'); // lectio:// deep link
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Could not start sign-in.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) {
    // user cancelled or redirect failed
    throw new Error('Sign-in was cancelled.');
  }

  // Exchange the code/tokens from the returned URL for a session. Keep this
  // defensive: PKCE returns ?code=, implicit returns #access_token — handle both.
  const url = result.url;
  const params = new URL(url).hash
    ? new URLSearchParams(new URL(url).hash.slice(1))
    : new URL(url).searchParams;

  const code = params.get('code');
  if (code) {
    const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exErr) throw exErr;
    return;
  }

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    const { error: sErr } = await supabase.auth.setSession({ access_token, refresh_token });
    if (sErr) throw sErr;
    return;
  }

  throw new Error('Sign-in did not return a session.');
}
