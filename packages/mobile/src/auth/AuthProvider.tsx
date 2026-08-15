import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { createURL } from 'expo-linking';
import { supabase, isSupabaseConfigured } from '../supabase/client';
import { isExpoGo } from './env';
import { signInWithProvider, signInWithAppleNative } from './oauth';
import { isConnectivityError } from './auth-errors';
import { deleteAccount } from './account';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  // True when the initial session load failed because the project is paused /
  // unreachable (no cached session). The launch UI shows a retry state.
  connectionError: boolean;
  // True when the address last used on the sign-in screen still has to confirm
  // its email: either a signUp that returned no session, or a signIn rejected
  // with "Email not confirmed". Stays false while confirmation is disabled in
  // the Supabase console. The sign-in screen turns it into the notice + Resend.
  needsEmailConfirmation: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  resendConfirmation(email: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signInWithApple(): Promise<void>;
  updateEmail(newEmail: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
  deleteAccount(): Promise<void>;
  retryConnection(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Supabase's rejection for an account that exists but never confirmed its
// address — the same string friendlyAuthError() maps, matched here so the UI
// can offer Resend instead of only printing the message.
function isEmailNotConfirmed(err: unknown): boolean {
  const msg = (err as any)?.message ? String((err as any).message).toLowerCase() : '';
  return msg.includes('email not confirmed');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

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
    if (error) {
      // An account that never confirmed fails here on every attempt, so this is
      // the same dead end a pending sign-up is in — flag it for the same notice.
      setNeedsEmailConfirmation(isEmailNotConfirmed(error));
      throw error;
    }
    setNeedsEmailConfirmation(false);
  }

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      // Clear so a failure (e.g. "already registered") can't leave a notice up
      // for whatever address was tried before this one.
      setNeedsEmailConfirmation(false);
      throw error;
    }
    // When email confirmation is ENABLED, Supabase returns no session and a user
    // (a confirm email was sent); when DISABLED, a session is present immediately.
    setNeedsEmailConfirmation(!data.session && !!data.user);
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
        needsEmailConfirmation,
        signIn,
        signUp,
        signOut,
        resetPassword,
        resendConfirmation,
        signInWithGoogle,
        signInWithApple,
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
