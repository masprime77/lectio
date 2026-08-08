import { describe, it, expect } from 'vitest';
import core from '../../src/planner-core.js';

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
