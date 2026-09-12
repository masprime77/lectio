import { describe, it, expect } from 'vitest';
import { STORAGE_METHODS, assertStorage } from '../../src/storage/contract.js';

// assertStorage's whole job is rejecting adapters of the wrong shape, so the
// rejection paths are what actually need covering — the adapter test files only
// ever hand it a valid adapter.

const validAdapter = () => ({
  list: async () => [],
  get: async () => ({}),
  save: async () => ({ ok: true }),
  delete: async () => ({ ok: true }),
});

describe('STORAGE_METHODS', () => {
  it('is exactly the four contract methods, in order', () => {
    expect(STORAGE_METHODS).toEqual(['list', 'get', 'save', 'delete']);
  });
});

describe('assertStorage', () => {
  it('returns the adapter it was given when every method is present', () => {
    const adapter = validAdapter();
    expect(assertStorage(adapter)).toBe(adapter);
  });

  it('accepts extra properties alongside the required methods', () => {
    const adapter = { ...validAdapter(), somethingElse: 42 };
    expect(() => assertStorage(adapter)).not.toThrow();
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'storage'],
    ['a number', 7],
    ['false', false],
  ])('rejects %s as not an object', (_label, value) => {
    expect(() => assertStorage(value)).toThrow('storage adapter must be an object');
  });

  it.each(STORAGE_METHODS)('rejects an adapter missing %s, naming it', (method) => {
    const adapter = validAdapter();
    delete adapter[method];
    expect(() => assertStorage(adapter)).toThrow(`storage adapter missing method: ${method}`);
  });

  it('rejects a property that exists but is not callable', () => {
    const adapter = { ...validAdapter(), save: 'not a function' };
    expect(() => assertStorage(adapter)).toThrow('storage adapter missing method: save');
  });

  it('reports the first missing method when several are absent', () => {
    // list is checked before get, so an empty object names list.
    expect(() => assertStorage({})).toThrow('storage adapter missing method: list');
  });
});
