import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, UserIdentity } from '@supabase/supabase-js';
import { createURL } from 'expo-linking';
import { supabase, isSupabaseConfigured } from '../supabase/client';
import { isExpoGo } from './env';
import {
  signInWithProvider,
  signInWithAppleNative,
  linkGoogle as linkGoogleIdentity,
  linkAppleNative,
  listIdentities,
  unlinkProvider,
} from './oauth';
import { isConnectivityError } from './auth-errors';
import { deleteAccount } from './account';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  // True when the initial session load failed because the project is paused /
  // unreachable (no cached session). The launch UI shows a retry state.
  connectionError: boolean;
  // True after a signUp that requires email confirmation (no immediate session).
  // Stays false while confirmation is disabled in the Supabase console, and
  // always false while EMAIL_CONFIRMATION_UI_ENABLED below is off.
  lastSignUpNeedsConfirmation: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  resendConfirmation(email: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signInWithApple(): Promise<void>;
  linkGoogle(): Promise<void>;
  linkApple(): Promise<void>;
  listIdentities(): Promise<UserIdentity[]>;
  unlinkIdentity(identity: UserIdentity): Promise<void>;
  updateEmail(newEmail: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
  deleteAccount(): Promise<void>;
  retryConnection(): void;
}

// Kill switch: forces the app to behave as if email confirmation is not
// required, regardless of what signUp() reports. Keep this in sync with the
// Supabase project's "Confirm email" toggle (Authentication → Providers →
// Email) — this flag only hides the app's own UI states, it does not override
// Supabase's server-side enforcement. Flip both back on together when ready to
// re-enable the flow. Exported so the screens gate their confirmation UI off
// the same constant (one place to flip).
export const EMAIL_CONFIRMATION_UI_ENABLED = false;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [lastSignUpNeedsConfirmation, setLastSignUpNeedsConfirmation] = useState(false);

  // Load the cached/remote session. If the project is paused or the device is
  // offline, getSession can reject — flag it instead of spinning forever.
  async function loadSession() {
    setConnectionError(false);
    setLoading(true);
    if (!isSupabaseConfigured) {
      setConnectionError(true);
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    } catch (e) {
      if (isConnectivityError(e)) setConnectionError(true);
      // Either way, stop blocking the launch on a hung request.
    } finally {
      setLoading(false);
    }
  }

  function retryConnection() {
    void loadSession();
  }

  useEffect(() => {
    void loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // When email confirmation is ENABLED, Supabase returns no session and a user
    // (a confirm email was sent); when DISABLED, a session is present immediately.
    // The kill switch pins this to false so the confirmation UI stays dormant.
    setLastSignUpNeedsConfirmation(
      EMAIL_CONFIRMATION_UI_ENABLED && !data.session && !!data.user
    );
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function resetPassword(email: string) {
    const redirectTo = createURL('/sign-in');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  async function resendConfirmation(email: string) {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
  }

  // Browser-based OAuth. onAuthStateChange picks up the new session and the layout
  // redirect navigates to '/'. In Expo Go the redirect round-trip is unreliable, so
  // we show a clear "installed app only" message instead of failing cryptically.
  async function signInWithGoogle() {
    if (isExpoGo) throw new Error('Google sign-in needs the installed app (not Expo Go).');
    await signInWithProvider('google');
  }

  async function signInWithApple() {
    if (isExpoGo) throw new Error('Apple sign-in needs the installed app (not Expo Go).');
    await signInWithAppleNative();
  }

  // Same Expo Go guard as the sign-in paths above: both linking flows need the
  // installed app (the browser round-trip / native Apple sheet).
  async function linkGoogle() {
    if (isExpoGo) throw new Error('Google linking needs the installed app (not Expo Go).');
    await linkGoogleIdentity();
  }

  async function linkApple() {
    if (isExpoGo) throw new Error('Apple linking needs the installed app (not Expo Go).');
    await linkAppleNative();
  }

  async function updateEmail(newEmail: string) {
    // Supabase sends a confirmation to the new address; the change applies after confirm.
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw error;
  }

  async function updatePassword(newPassword: string) {
    // Requires an active session — used from Profile when already signed in.
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        connectionError,
        lastSignUpNeedsConfirmation,
        signIn,
        signUp,
        signOut,
        resetPassword,
        resendConfirmation,
        signInWithGoogle,
        signInWithApple,
        linkGoogle,
        linkApple,
        listIdentities,
        unlinkIdentity: unlinkProvider,
        updateEmail,
        updatePassword,
        deleteAccount,
        retryConnection,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
