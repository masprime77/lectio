import { describe, it, expect } from 'vitest';
import core from '../../src/planner-core.js';
import cjsCore from '../helpers/require-core.cjs';

const semester = () => ({
  readingTags: JSON.parse(JSON.stringify(core.DEFAULT_READING_TAGS)),
  taskTags: JSON.parse(JSON.stringify(core.DEFAULT_TASK_TAGS)),
});

// Three courses with distinct names and progress: Zeta 0%, Mid 50%, Alpha 100%.
const courses = () => [
  { id: 'c-z', name: 'Zeta', readings: [{ status: 'r-pending' }], tasks: [] },
  {
    id: 'c-m',
    name: 'Mid',
    readings: [{ status: 'r-studied' }, { status: 'r-pending' }],
    tasks: [],
  },
  { id: 'c-a', name: 'Alpha', readings: [{ status: 'r-studied' }], tasks: [] },
];

const names = (arr) => arr.map((c) => c.name);

describe('SORT_ORDERS', () => {
  it('lists the exact sort order values the UI offers', () => {
    expect(core.SORT_ORDERS).toEqual([
      'progress-asc',
      'progress-desc',
      'alpha-asc',
      'alpha-desc',
      'week-asc',
      'week-desc',
    ]);
  });
});

describe('sortedCourses', () => {
  it('progress-asc orders by courseProgress ascending', () => {
    expect(names(core.sortedCourses(courses(), semester(), 'progress-asc'))).toEqual([
      'Zeta',
      'Mid',
      'Alpha',
    ]);
  });

  it('progress-desc orders by courseProgress descending', () => {
    expect(names(core.sortedCourses(courses(), semester(), 'progress-desc'))).toEqual([
      'Alpha',
      'Mid',
      'Zeta',
    ]);
  });

  it('progress sorts respect study mode', () => {
    // In study mode only r-studied counts; r-summarized drops to 0%.
    const cs = [
      { id: 'c-1', name: 'Summarized', readings: [{ status: 'r-summarized' }], tasks: [] },
      { id: 'c-2', name: 'Studied', readings: [{ status: 'r-studied' }], tasks: [] },
    ];
    expect(names(core.sortedCourses(cs, semester(), 'progress-desc', true))).toEqual([
      'Studied',
      'Summarized',
    ]);
    expect(names(core.sortedCourses(cs, semester(), 'progress-desc', false))).toEqual([
      'Summarized',
      'Studied',
    ]);
  });

  it('alpha-asc orders by name A → Z', () => {
    expect(names(core.sortedCourses(courses(), semester(), 'alpha-asc'))).toEqual([
      'Alpha',
      'Mid',
      'Zeta',
    ]);
  });

  it('alpha-desc orders by name Z → A', () => {
    expect(names(core.sortedCourses(courses(), semester(), 'alpha-desc'))).toEqual([
      'Zeta',
      'Mid',
      'Alpha',
    ]);
  });

  it('week-asc and week-desc fall back to alphabetical A → Z', () => {
    expect(names(core.sortedCourses(courses(), semester(), 'week-asc'))).toEqual([
      'Alpha',
      'Mid',
      'Zeta',
    ]);
    expect(names(core.sortedCourses(courses(), semester(), 'week-desc'))).toEqual([
      'Alpha',
      'Mid',
      'Zeta',
    ]);
  });

  it('never mutates the input array', () => {
    const input = courses();
    const before = names(input);
    const out = core.sortedCourses(input, semester(), 'alpha-asc');
    expect(out).not.toBe(input);
    expect(names(input)).toEqual(before);
  });
});

describe('setItemStatus', () => {
  it('sets the tag id on a reading and returns the item', () => {
    const c = { readings: [{ id: 'r-1', status: 'r-pending' }], tasks: [] };
    const item = core.setItemStatus(c, 'reading', 'r-1', 'r-studied');
    expect(item).toBe(c.readings[0]);
    expect(c.readings[0].status).toBe('r-studied');
  });

  it('sets the tag id on a task and clears the ghost marker', () => {
    const c = {
      readings: [],
      tasks: [{ id: 't-1', status: '__deleted__', _ghostSection: 'done' }],
    };
    const item = core.setItemStatus(c, 'task', 't-1', 't-done');
    expect(item.status).toBe('t-done');
    expect('_ghostSection' in item).toBe(false);
  });

  it('returns null for an unknown item id', () => {
    const c = { readings: [{ id: 'r-1', status: 'r-pending' }], tasks: [] };
    expect(core.setItemStatus(c, 'reading', 'nope', 'r-studied')).toBeNull();
    expect(c.readings[0].status).toBe('r-pending');
  });
});

describe('CommonJS surface (desktop main-process path)', () => {
  it('exposes SORT_ORDERS and sortedCourses', () => {
    expect(cjsCore.SORT_ORDERS).toEqual(core.SORT_ORDERS);
    expect(names(cjsCore.sortedCourses(courses(), semester(), 'alpha-desc'))).toEqual([
      'Zeta',
      'Mid',
      'Alpha',
    ]);
  });

  it('exposes setItemStatus', () => {
    const c = { readings: [{ id: 'r-1', status: 'r-pending' }], tasks: [] };
    expect(cjsCore.setItemStatus(c, 'reading', 'r-1', 'r-seen').status).toBe('r-seen');
  });
});
