import { describe, it, expect } from 'vitest';
import core from '../../lib/planner-core.js';

describe('reading status cycle', () => {
  it('cycles pending → seen → summarized → studied → pending', () => {
    expect(core.cycleReadingStatus('pending')).toBe('seen');
    expect(core.cycleReadingStatus('seen')).toBe('summarized');
    expect(core.cycleReadingStatus('summarized')).toBe('studied');
    expect(core.cycleReadingStatus('studied')).toBe('pending');
  });
});

describe('task status cycle', () => {
  it('cycles not done → done → reviewed → not done', () => {
    expect(core.cycleTaskStatus('not done')).toBe('done');
    expect(core.cycleTaskStatus('done')).toBe('reviewed');
    expect(core.cycleTaskStatus('reviewed')).toBe('not done');
  });
});

describe('invalid status', () => {
  it('defaults back to the first status of the cycle', () => {
    expect(core.cycleReadingStatus('bogus')).toBe('pending');
    expect(core.cycleTaskStatus('bogus')).toBe('not done');
    expect(core.nextStatus(core.READING_CYCLE, undefined)).toBe('pending');
  });
});
