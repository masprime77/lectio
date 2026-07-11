import { describe, it, expect } from 'vitest';
import { detectConflict, ConflictError } from '../../src/storage/conflict.js';

describe('detectConflict', () => {
  it('returns false when there is no observed baseline (expected == null)', () => {
    expect(detectConflict(null, '2025-01-01T00:00:00.000Z')).toBe(false);
    expect(detectConflict(undefined, '2025-01-01T00:00:00.000Z')).toBe(false);
  });

  it('returns false when the remote row is missing (actual == null)', () => {
    expect(detectConflict('2025-01-01T00:00:00.000Z', null)).toBe(false);
    expect(detectConflict('2025-01-01T00:00:00.000Z', undefined)).toBe(false);
  });

  it('returns false when timestamps are equal', () => {
    const ts = '2025-01-01T00:00:00.000Z';
    expect(detectConflict(ts, ts)).toBe(false);
  });

  it('returns true when timestamps differ', () => {
    expect(
      detectConflict('2025-01-01T00:00:00.000Z', '2025-01-02T00:00:00.000Z')
    ).toBe(true);
  });
});

describe('ConflictError', () => {
  it('carries id, expected/actual timestamps, remote blob, and a CONFLICT code', () => {
    const remote = { id: 'x', name: 'X', courses: [] };
    const err = new ConflictError('x', {
      expectedUpdatedAt: '2025-01-01T00:00:00.000Z',
      actualUpdatedAt: '2025-01-02T00:00:00.000Z',
      remote,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ConflictError');
    expect(err.code).toBe('CONFLICT');
    expect(err.semesterId).toBe('x');
    expect(err.expectedUpdatedAt).toBe('2025-01-01T00:00:00.000Z');
    expect(err.actualUpdatedAt).toBe('2025-01-02T00:00:00.000Z');
    expect(err.remote).toBe(remote);
    expect(err.message).toMatch(/changed on another device/i);
  });

  it('defaults expected/actual/remote to null when omitted', () => {
    const err = new ConflictError('y', {});
    expect(err.expectedUpdatedAt).toBeNull();
    expect(err.actualUpdatedAt).toBeNull();
    expect(err.remote).toBeNull();
  });

  it('tolerates being constructed with no options object', () => {
    const err = new ConflictError('z');
    expect(err.code).toBe('CONFLICT');
    expect(err.remote).toBeNull();
  });
});
