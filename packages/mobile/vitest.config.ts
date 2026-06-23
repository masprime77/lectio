import { defineConfig } from 'vitest/config';

// Run the mobile storage-adapter tests under Vitest in Node — the same runner
// @lectio/core uses — so they can import core's reusable storage-contract suite
// directly. The adapters' only React-Native dependency is AsyncStorage, which we
// alias to an in-memory mock so Node can exercise them without the RN runtime.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@react-native-async-storage/async-storage': new URL(
        './test/mocks/async-storage.ts',
        import.meta.url
      ).pathname,
    },
  },
});
