import { supabase } from '../supabase/client';

// Account deletion. Supabase does NOT allow a client with the anon key to delete
// its own auth user — that needs the service_role key, which must never ship in the
// app. So deletion runs through a server-side Edge Function (`delete-account`) that
// holds the service_role key in its own environment, verifies the caller's JWT, and
// deletes that user. `functions.invoke` forwards the access token automatically.
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account');
  if (error) throw error;
  // After deletion, sign out locally to clear the now-stale session.
  await supabase.auth.signOut();
}
