import { describe, it, expect } from 'vitest';
import core from '../../src/planner-core.js';

// Reusable storage-contract suite. Given a `makeEmptyStorage` factory (returns a
// fresh, empty adapter — possibly async), it exercises the full async contract:
// list/get/save/delete, migration on load, error on missing, id validation.
// Every platform adapter (fs today, Supabase later) runs against this suite.
//
// This file is intentionally NOT named *.test.js so Vitest does not collect it
// as a standalone test — it is imported by adapter test files.
export function runStorageContract(label, makeEmptyStorage) {
  describe(`storage contract: ${label}`, () => {
    it('list() on empty storage returns []', async () => {
      const s = await makeEmptyStorage();
      expect(await s.list()).toEqual([]);
    });

    it('save() then get() returns the data with default tags migrated in', async () => {
      const s = await makeEmptyStorage();
      const sample = { id: 'x', name: 'X', startDate: '2025-01-06', weeks: 4, courses: [] };
      await s.save('x', sample);
      expect(await s.get('x')).toEqual({
        ...sample,
        readingTags: core.DEFAULT_READING_TAGS,
        taskTags: core.DEFAULT_TASK_TAGS,
      });
      expect(await s.list()).toEqual([{ id: 'x', name: 'X' }]);
    });

    it('get() migrates legacy status strings to tag ids', async () => {
      const s = await makeEmptyStorage();
      const legacy = {
        id: 'y',
        name: 'Y',
        startDate: '2025-01-06',
        weeks: 4,
        courses: [
          {
            id: 'c1',
            readings: [{ status: 'pending' }, { status: 'studied' }],
            tasks: [{ status: 'not done' }, { status: 'done' }],
          },
        ],
      };
      await s.save('y', legacy);
      const got = await s.get('y');
      expect(got.courses[0].readings.map((r) => r.status)).toEqual(['r-pending', 'r-studied']);
      expect(got.courses[0].tasks.map((t) => t.status)).toEqual(['t-pending', 't-done']);
    });

    it('delete() removes a saved semester', async () => {
      const s = await makeEmptyStorage();
      await s.save('z', { id: 'z', name: 'Z', courses: [] });
      await s.delete('z');
      expect(await s.list()).toEqual([]);
    });

    it('get() on a missing semester rejects', async () => {
      const s = await makeEmptyStorage();
      await expect(s.get('missing')).rejects.toThrow(/not found/i);
    });

    it('get() with a traversal id rejects', async () => {
      const s = await makeEmptyStorage();
      await expect(s.get('../secret')).rejects.toThrow(/invalid/i);
    });
  });
}
