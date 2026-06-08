// On-device storage adapter satisfying the @lectio/core async storage contract.
// Backed by AsyncStorage; behaves identically to the desktop fs adapter
// (same migration on load, same id guard, same not-found/invalid messages) so
// the contract suite passes against it unchanged.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateStatusToTagId } from '@lectio/core/storage/migrate';
import { assertStorage } from '@lectio/core/storage/contract';
import type { Semester, SemesterSummary, Storage } from '../../types/lectio-core';

const PREFIX = 'lectio:semester:';
const KEY = (id: string) => `${PREFIX}${id}`;
const safeId = (id: string) => /^[a-zA-Z0-9_-]+$/.test(id);

export function createDeviceStorage(): Storage {
  const adapter: Storage = {
    async list(): Promise<SemesterSummary[]> {
      const keys = (await AsyncStorage.getAllKeys()).filter((k) =>
        k.startsWith(PREFIX)
      );
      const entries = await AsyncStorage.multiGet(keys);
      return entries.map(([k, v]) => {
        const data = v ? JSON.parse(v) : {};
        return { id: k.slice(PREFIX.length), name: data.name || data.id };
      });
    },

    async get(id: string): Promise<Semester> {
      if (!safeId(id)) throw new Error(`Invalid semester id: ${id}`);
      const raw = await AsyncStorage.getItem(KEY(id));
      if (raw == null) throw new Error(`Semester not found: ${id}`);
      return migrateStatusToTagId(JSON.parse(raw));
    },

    async save(id: string, data: Semester) {
      if (!safeId(id)) throw new Error(`Invalid semester id: ${id}`);
      await AsyncStorage.setItem(KEY(id), JSON.stringify(data));
      return { ok: true as const, id };
    },

    async delete(id: string) {
      if (!safeId(id)) throw new Error(`Invalid semester id: ${id}`);
      await AsyncStorage.removeItem(KEY(id));
      return { ok: true as const, id };
    },
  };

  return assertStorage(adapter);
}
