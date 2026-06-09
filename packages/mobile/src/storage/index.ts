// Central storage accessor. Returns the Supabase adapter (cloud sync).
// createDeviceStorage is kept available as the offline/local fallback for a
// future offline-mode phase — do not delete it.
import { createSupabaseStorage } from './supabase-storage';
export { createDeviceStorage } from './device-storage';
export { ensureSeed } from './seed';

export function getStorage() {
  return createSupabaseStorage();
}

// Stable singleton used by all screens.
export const storage = getStorage();
