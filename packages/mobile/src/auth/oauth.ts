import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase } from '../supabase/client';
import type { UserIdentity } from '@supabase/supabase-js';

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

// Native Sign in with Apple: Apple's on-device Authentication Services via
// expo-apple-authentication, then exchange the identity token with
// Supabase's signInWithIdToken. No browser round-trip, and — unlike the
// signInWithProvider() OAuth path above — no Services ID / secret-key
// rotation required on the Apple/Supabase side, just the app's Bundle ID
// registered as a Client ID in the Supabase dashboard.
export async function signInWithAppleNative(): Promise<void> {
  // Apple requires the *hashed* nonce; Supabase verifies against the *raw*
  // nonce, which must be sent separately to signInWithIdToken below.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
      throw new Error('Sign-in was cancelled.');
    }
    throw e;
  }

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;

  // Apple only sends the full name on the FIRST authorization for this
  // app; every later sign-in returns null here, so capture it now or
  // it's gone (Supabase can't recover it from the identity token itself).
  if (credential.fullName?.givenName || credential.fullName?.familyName) {
    const fullName = [credential.fullName.givenName, credential.fullName.familyName]
      .filter(Boolean)
      .join(' ');
    await supabase.auth
      .updateUser({
        data: {
          full_name: fullName,
          given_name: credential.fullName.givenName ?? undefined,
          family_name: credential.fullName.familyName ?? undefined,
        },
      })
      .catch(() => {
        // Non-fatal: the session is already established; losing the
        // display name on this one sign-in isn't worth failing the
        // whole flow over.
      });
  }
}

// Links a Google identity to the CURRENTLY SIGNED-IN user, via the same
// browser round-trip as signInWithProvider('google') above — linkIdentity()
// accepts the same credentials shape as signInWithOAuth() and returns the
// same { data: { url } } to open in the auth session browser. Requires
// "Enable Manual Linking" to be on in the Supabase project's Auth settings.
// Requires an active session (always true here — only called from the
// Profile screen).
export async function linkGoogle(): Promise<void> {
  const redirectTo = Linking.createURL('/'); // lectio:// deep link
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Could not start linking.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) {
    throw new Error('Linking was cancelled.');
  }

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

  throw new Error('Linking did not return a session.');
}

// Links a native Apple identity to the CURRENTLY SIGNED-IN user. No browser
// round-trip: linkIdentity() accepts the same SignInWithIdTokenCredentials
// shape as signInWithIdToken() (used by signInWithAppleNative() above) and
// performs the OIDC identity link directly from the identity token. Note this
// is an overload of linkIdentity(), not a separate linkIdentityWithIdToken()
// method — that name appears in some Supabase docs pages but is not exported
// by @supabase/supabase-js. Requires "Enable Manual Linking" to be on in the
// Supabase project's Auth settings. Named distinctly from
// signInWithAppleNative() above since they do different things (sign in vs.
// link to the already-signed-in user), even though the Apple + Supabase calls
// inside are nearly identical.
export async function linkAppleNative(): Promise<void> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
      throw new Error('Linking was cancelled.');
    }
    throw e;
  }

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token.');
  }

  const { error } = await supabase.auth.linkIdentity({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;
}

// All identities linked to the signed-in user. Used by the Profile screen
// to show which sign-in methods are active.
export async function listIdentities(): Promise<UserIdentity[]> {
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) throw error;
  return data.identities;
}

// Unlinks one identity (pass an entry returned by listIdentities()).
// Supabase itself requires the user to have at least 2 linked identities
// before it allows removing one — the Profile screen also disables the button
// in that case; this is a second line of defense, not the only guard.
export async function unlinkProvider(identity: UserIdentity): Promise<void> {
  const { error } = await supabase.auth.unlinkIdentity(identity);
  if (error) throw error;
}
