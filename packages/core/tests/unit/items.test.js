import { describe, it, expect } from 'vitest';
import core from '../../src/planner-core.js';
import cjsCore from '../helpers/require-core.cjs';

const course = () => ({
  id: 'c1',
  name: 'Algorithms',
  color: '#111',
  readings: [{ id: 'r-1', week: 1, title: 'Asymptotic Notation', status: 'r-pending' }],
  tasks: [
    { id: 't-1', week: 1, title: 'Problem Set 1', dueDate: '2025-04-14', status: 't-pending' },
  ],
});

describe('item operations', () => {
  it('adding a reading sets r-pending, a unique id, week and title, and no dueDate', () => {
    const c = course();
    const a = core.addItem(c, 'reading', { title: 'Sorting', week: 2 });
    const b = core.addItem(c, 'reading', { title: 'Hashing', week: 3 });
    expect(a).toMatchObject({ week: 2, title: 'Sorting', status: 'r-pending' });
    expect(a.id).not.toBe(b.id);
    expect('dueDate' in a).toBe(false);
    expect(c.readings).toHaveLength(3);
  });

  it('adding a task sets t-pending and an empty dueDate when none is given', () => {
    const c = course();
    const item = core.addItem(c, 'task', { title: 'Lab 1', week: 2 });
    expect(item).toMatchObject({ week: 2, title: 'Lab 1', dueDate: '', status: 't-pending' });
  });

  it('adding a task keeps the given dueDate', () => {
    const c = course();
    const item = core.addItem(c, 'task', { title: 'Lab 2', week: 3, dueDate: '2025-05-05' });
    expect(item.dueDate).toBe('2025-05-05');
  });

  it('adding initializes a missing readings/tasks array', () => {
    const bare = { id: 'c2', name: 'Bare' };
    core.addItem(bare, 'reading', { title: 'R', week: 1 });
    core.addItem(bare, 'task', { title: 'T', week: 1 });
    expect(bare.readings).toHaveLength(1);
    expect(bare.tasks).toHaveLength(1);
  });

  it('editing patches only the provided fields', () => {
    const c = course();
    const item = core.editItem(c, 'reading', 'r-1', { week: 4 });
    expect(item).toBe(c.readings[0]);
    expect(item).toMatchObject({ week: 4, title: 'Asymptotic Notation', status: 'r-pending' });
  });

  it('editing with an empty dueDate clears a task due date', () => {
    const c = course();
    core.editItem(c, 'task', 't-1', { dueDate: '' });
    expect(c.tasks[0].dueDate).toBe('');
  });

  it('editing ignores dueDate for readings', () => {
    const c = course();
    core.editItem(c, 'reading', 'r-1', { dueDate: '2025-05-05' });
    expect('dueDate' in c.readings[0]).toBe(false);
  });

  it('editing an unknown item returns null', () => {
    const c = course();
    expect(core.editItem(c, 'reading', 'nope', { title: 'X' })).toBeNull();
  });

  it('deleting an item removes it and returns true', () => {
    const c = course();
    expect(core.deleteItem(c, 'task', 't-1')).toBe(true);
    expect(c.tasks).toEqual([]);
  });

  it('deleting an unknown item returns false and leaves the array untouched', () => {
    const c = course();
    expect(core.deleteItem(c, 'reading', 'nope')).toBe(false);
    expect(c.readings).toHaveLength(1);
  });
});

describe('convertItemKind', () => {
  it('moves a reading into tasks keeping its id, title and week', () => {
    const c = course();
    const item = core.convertItemKind(c, 'r-1', 'task');
    expect(c.readings).toEqual([]);
    expect(c.tasks).toHaveLength(2);
    expect(item).toMatchObject({
      id: 'r-1',
      title: 'Asymptotic Notation',
      week: 1,
      status: 't-pending',
      dueDate: '',
    });
    expect(c.tasks[1]).toBe(item);
  });

  it('moves a task into readings, dropping its dueDate', () => {
    const c = course();
    const item = core.convertItemKind(c, 't-1', 'reading');
    expect(c.tasks).toEqual([]);
    expect(c.readings).toHaveLength(2);
    expect(item).toMatchObject({ id: 't-1', title: 'Problem Set 1', status: 'r-pending' });
    expect('dueDate' in item).toBe(false);
  });

  it('round-trips an item back to its original kind', () => {
    const c = course();
    core.convertItemKind(c, 'r-1', 'task');
    // Converting back and forth loses the tag (the two tag lists are separate)
    // but never the identity of the item.
    const back = core.convertItemKind(c, 'r-1', 'reading');
    expect(back).toMatchObject({ id: 'r-1', title: 'Asymptotic Notation', status: 'r-pending' });
    expect(c.readings.map((r) => r.id)).toEqual(['r-1']);
  });

  it('clears a ghost marker so a converted item is no longer a ghost', () => {
    const c = course();
    c.readings[0].status = '__deleted__';
    c.readings[0]._ghostSection = 'done';
    const item = core.convertItemKind(c, 'r-1', 'task');
    expect(item.status).toBe('t-pending');
    expect('_ghostSection' in item).toBe(false);
  });

  it('is a no-op for an item that is already the target kind', () => {
    const c = course();
    expect(core.convertItemKind(c, 'r-1', 'reading')).toBeNull();
    expect(c.readings).toHaveLength(1);
    expect(c.tasks).toHaveLength(1);
  });

  it('returns null for an unknown id', () => {
    const c = course();
    expect(core.convertItemKind(c, 'nope', 'task')).toBeNull();
    expect(c.tasks).toHaveLength(1);
  });

  it('initializes a missing destination array', () => {
    const bare = { id: 'c2', name: 'Bare', readings: [{ id: 'r-9', title: 'R', status: 'r-pending' }] };
    core.convertItemKind(bare, 'r-9', 'task');
    expect(bare.readings).toEqual([]);
    expect(bare.tasks).toHaveLength(1);
  });

  it('is reachable through the CommonJS surface', () => {
    const c = course();
    expect(cjsCore.convertItemKind(c, 'r-1', 'task').status).toBe('t-pending');
  });
});
