// Minimal in-memory stand-in for expo-secure-store, implementing only the
// methods moodle-token-store.ts uses (getItemAsync, setItemAsync,
// deleteItemAsync). Vitest aliases the real module to this one so the
// adapter runs in plain Node. `__reset()` clears the store so each test
// starts from a clean slate — call it in a `beforeEach`.
const store = new Map<string, string>();

export async function getItemAsync(key: string): Promise<string | null> {
  return store.get(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  store.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  store.delete(key);
}

export function __reset(): void {
  store.clear();
}
