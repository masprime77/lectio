import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { createURL } from 'expo-linking';
import { supabase } from '../supabase/client';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  // True after a signUp that requires email confirmation (no immediate session).
  // Stays false while confirmation is disabled in the Supabase console.
  lastSignUpNeedsConfirmation: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  resendConfirmation(email: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signInWithApple(): Promise<void>;
  updateEmail(newEmail: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSignUpNeedsConfirmation, setLastSignUpNeedsConfirmation] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

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
    setLastSignUpNeedsConfirmation(!data.session && !!data.user);
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

  // OAuth stubs — 8.2 fills in the bodies. Exposed now so the sign-in screen and
  // 8.2 only have to replace the implementation.
  async function signInWithGoogle() {
    throw new Error('OAuth is available in the installed app, not in Expo Go.');
  }

  async function signInWithApple() {
    throw new Error('OAuth is available in the installed app, not in Expo Go.');
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
        lastSignUpNeedsConfirmation,
        signIn,
        signUp,
        signOut,
        resetPassword,
        resendConfirmation,
        signInWithGoogle,
        signInWithApple,
        updateEmail,
        updatePassword,
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
