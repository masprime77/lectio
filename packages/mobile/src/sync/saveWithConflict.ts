// Central conflict-aware save. Every semester write in the app goes through
// here so a ConflictError thrown by the Supabase adapter (see 12.1) surfaces a
// resolution dialog instead of being swallowed by a fire-and-forget
// `.catch(console.warn)`.
//
// The dialog itself is React (ConflictProvider/ConflictDialog); this helper is
// a plain module so it can be called from anywhere. The provider registers an
// `opener` callback on mount that this helper invokes to raise the dialog and
// awaits the user's choice.
import { storage } from '../storage';
import { ConflictError } from '@lectio/core/storage/conflict';
import type { Semester } from '../../types/lectio-core';

export type ConflictChoice = 'keep' | 'discard' | 'cancel';

// What actually happened, so navigation-style callers (the add/edit forms) can
// decide whether to leave the screen. State-swap callers ignore it and use
// `onApplied` instead.
export type SaveOutcome = 'saved' | 'discarded' | 'cancelled';

export interface ConflictInfo {
  id: string;
  local: Semester;
  remote: Semester | null;
  resolve: (choice: ConflictChoice) => void;
}

// The provider registers its dialog-opener here; null when unmounted (the
// helper then defaults conflicts to 'cancel' so nothing is silently overwritten).
let opener: ((c: ConflictInfo) => void) | null = null;
export function registerConflictOpener(fn: ((c: ConflictInfo) => void) | null): void {
  opener = fn;
}

/**
 * Save `local` under `id`. On a normal save this is just `storage.save`. On a
 * ConflictError it raises the resolution dialog and applies the user's choice:
 *   - keep    → back up the remote version, then force `local` through (wins);
 *   - discard → leave the cloud version in place, hand it to `onApplied`;
 *   - cancel  → do nothing (the caller's unsaved edits stay on screen).
 * `onApplied` receives the semester that is now authoritative (local for keep,
 * remote for discard) so a screen can swap its state to match.
 */
export async function saveWithConflict(
  id: string,
  local: Semester,
  onApplied?: (applied: Semester) => void
): Promise<SaveOutcome> {
  try {
    await storage.save(id, local);
    return 'saved';
  } catch (err) {
    if ((err as { code?: string })?.code !== 'CONFLICT') throw err; // real errors propagate
    const remote = (err as ConflictError).remote;
    const choice = await new Promise<ConflictChoice>((res) => {
      if (opener) opener({ id, local, remote, resolve: res });
      else res('cancel');
    });

    if (choice === 'cancel') return 'cancelled';

    if (choice === 'discard') {
      if (remote) onApplied?.(remote); // caller swaps state to the cloud version
      return 'discarded';
    }

    // choice === 'keep': keep the on-screen edits but don't lose the other
    // device's version — stash it as a recoverable backup, then force the write.
    if (remote) await backupRemote(id, remote);
    // 12.1's adapter keyed the conflict off a stale baseline; re-reading refreshes
    // its `seen` timestamp to the actual row so the next save is not a conflict.
    await storage.get(id).catch(() => {});
    await storage.save(id, local); // baseline == actual now, so this lands
    onApplied?.(local);
    return 'saved';
  }
}

// Save the remote blob under a derived, non-colliding id so the overwritten
// version stays recoverable. Named "(conflict backup)" so the user spots it in
// the semesters list.
async function backupRemote(id: string, remote: Semester): Promise<void> {
  const existing = new Set((await storage.list()).map((s) => s.id));
  let bid = `${id}-conflict-backup`;
  let n = 2;
  while (existing.has(bid)) bid = `${id}-conflict-backup-${n++}`;
  const backup: Semester = {
    ...remote,
    id: bid,
    name: `${remote?.name ?? id} (conflict backup)`,
  };
  await storage.save(bid, backup);
}
