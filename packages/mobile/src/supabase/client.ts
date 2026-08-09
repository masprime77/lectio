import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// A missing env var must NEVER throw here: this module is imported at
// the very top of AuthProvider.tsx, which wraps the whole app, so a
// throw at module-evaluation time happens before React mounts anything —
// no error boundary, no connectionError screen, just an instant crash on
// open. Instead, flag it and hand back a client pointed at a
// syntactically valid but unreachable URL; every call then fails with a
// normal network error, which AuthProvider's loadSession() already
// classifies via isConnectivityError() into the existing "Can't reach
// Lectio's servers" retry screen — the safety net that already exists
// just needs the chance to run.
export const isSupabaseConfigured = Boolean(url && key);

if (!isSupabaseConfigured) {
  console.error(
    'Missing Supabase env vars (EXPO_PUBLIC_SUPABASE_URL / ' +
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY). Locally: copy .env.example ' +
      'to .env. In EAS builds: eas env:create --scope project --name ' +
      '<NAME> --value <VALUE> --environment <preview|production>.'
  );
}

export const supabase = createClient(
  isSupabaseConfigured ? (url as string) : 'https://misconfigured.invalid',
  isSupabaseConfigured ? (key as string) : 'placeholder-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Resume/pause token auto-refresh with app foreground/background lifecycle.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
