// Minimal in-memory stand-in for @react-native-async-storage/async-storage,
// implementing only the methods device-storage uses (getAllKeys, multiGet,
// getItem, setItem, removeItem). Vitest aliases the real module to this one so
// the adapter runs in plain Node. `__reset()` clears the store so each
// makeEmptyStorage() in the contract suite starts from an empty backing store.
const store = new Map<string, string>();

const AsyncStorage = {
  async getAllKeys(): Promise<string[]> {
    return [...store.keys()];
  },
  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    return keys.map((k) => [k, store.get(k) ?? null]);
  },
  async getItem(key: string): Promise<string | null> {
    return store.get(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    store.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    store.delete(key);
  },
  __reset(): void {
    store.clear();
  },
};

export default AsyncStorage;
