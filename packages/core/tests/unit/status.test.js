import { describe, it, expect } from 'vitest';
import core from '../../src/planner-core.js';

const semester = () => ({
  id: 's',
  readingTags: JSON.parse(JSON.stringify(core.DEFAULT_READING_TAGS)),
  taskTags: JSON.parse(JSON.stringify(core.DEFAULT_TASK_TAGS)),
  courses: [],
});

describe('tag defaults', () => {
  it('getReadingTags returns the semester tags when present', () => {
    const sem = semester();
    expect(core.getReadingTags(sem)).toBe(sem.readingTags);
    expect(core.getReadingTags(sem).map((t) => t.id)).toEqual([
      'r-pending',
      'r-seen',
      'r-summarized',
      'r-studied',
    ]);
  });

  it('getTaskTags returns the semester tags when present', () => {
    const sem = semester();
    expect(core.getTaskTags(sem)).toBe(sem.taskTags);
    expect(core.getTaskTags(sem).map((t) => t.id)).toEqual(['t-pending', 't-done', 't-studied']);
  });

  it('falls back to the defaults when tags are missing or empty', () => {
    expect(core.getReadingTags({})).toBe(core.DEFAULT_READING_TAGS);
    expect(core.getTaskTags({ taskTags: [] })).toBe(core.DEFAULT_TASK_TAGS);
  });
});

describe('isProtectedTag', () => {
  it('protects the pending and studied tags of each kind', () => {
    ['r-pending', 'r-studied', 't-pending', 't-studied'].forEach((id) =>
      expect(core.isProtectedTag(id)).toBe(true)
    );
  });

  it('treats custom and intermediate tags as unprotected', () => {
    ['r-seen', 'r-summarized', 't-done', 'rt-123', 'whatever'].forEach((id) =>
      expect(core.isProtectedTag(id)).toBe(false)
    );
  });
});

describe('addTag', () => {
  it('appends a tag with a generated reading-tag id', () => {
    const sem = semester();
    const tag = core.addTag(sem, 'reading', { name: 'skimmed', color: '#000', section: 'pending' });
    expect(tag.id).toMatch(/^rt-/);
    expect(sem.readingTags.at(-1)).toBe(tag);
    expect(tag).toMatchObject({ name: 'skimmed', color: '#000', section: 'pending' });
  });

  it('appends a tag with a generated task-tag id', () => {
    const sem = semester();
    const tag = core.addTag(sem, 'task', { name: 'blocked', color: '#999', section: 'pending' });
    expect(tag.id).toMatch(/^tt-/);
    expect(sem.taskTags.at(-1)).toBe(tag);
  });
});

describe('editTag', () => {
  it('renames and recolors an unprotected tag', () => {
    const sem = semester();
    expect(core.editTag(sem, 'reading', 'r-seen', { name: 'skimmed', color: '#abc' })).toBe(true);
    const tag = sem.readingTags.find((t) => t.id === 'r-seen');
    expect(tag).toMatchObject({ name: 'skimmed', color: '#abc' });
  });

  it('locks the name of a protected tag but allows recoloring', () => {
    const sem = semester();
    expect(core.editTag(sem, 'reading', 'r-pending', { name: 'nope', color: '#123' })).toBe(true);
    const tag = sem.readingTags.find((t) => t.id === 'r-pending');
    expect(tag.name).toBe('pending');
    expect(tag.color).toBe('#123');
  });

  it('returns false for an unknown tag', () => {
    expect(core.editTag(semester(), 'reading', 'ghost', { name: 'x' })).toBe(false);
  });
});

describe('deleteTag', () => {
  it('refuses to delete a protected tag', () => {
    const sem = semester();
    expect(core.deleteTag(sem, 'reading', 'r-pending')).toBe(false);
    expect(sem.readingTags.map((t) => t.id)).toContain('r-pending');
  });

  it('returns false for an unknown tag', () => {
    expect(core.deleteTag(semester(), 'reading', 'ghost')).toBe(false);
  });

  it('removes the tag and ghosts items still wearing it', () => {
    const sem = semester();
    sem.courses = [
      {
        id: 'c1',
        readings: [{ id: 'r1', week: 1, status: 'r-seen' }, { id: 'r2', week: 1, status: 'r-pending' }],
        tasks: [],
      },
    ];
    expect(core.deleteTag(sem, 'reading', 'r-seen')).toBe(true);
    expect(sem.readingTags.map((t) => t.id)).not.toContain('r-seen');
    const r1 = sem.courses[0].readings[0];
    expect(r1.status).toBe('__deleted__');
    expect(r1._ghostSection).toBe('pending');
    // Untouched item keeps its tag.
    expect(sem.courses[0].readings[1].status).toBe('r-pending');
  });

  it('ghost inherits a done section so progress is preserved', () => {
    const sem = semester();
    sem.courses = [{ id: 'c1', readings: [{ id: 'r1', week: 1, status: 'r-summarized' }], tasks: [] }];
    expect(core.courseProgress(sem.courses[0], sem)).toBe(100);
    core.deleteTag(sem, 'reading', 'r-summarized');
    expect(sem.courses[0].readings[0]._ghostSection).toBe('done');
    expect(core.courseProgress(sem.courses[0], sem)).toBe(100);
  });
});

describe('reorderTags', () => {
  it('reorders the tag list to match the given ids', () => {
    const sem = semester();
    core.reorderTags(sem, 'task', ['t-studied', 't-pending', 't-done']);
    expect(sem.taskTags.map((t) => t.id)).toEqual(['t-studied', 't-pending', 't-done']);
  });

  it('appends tags missing from the ordered ids as a safety net', () => {
    const sem = semester();
    core.reorderTags(sem, 'reading', ['r-studied', 'r-pending']);
    expect(sem.readingTags.map((t) => t.id)).toEqual([
      'r-studied',
      'r-pending',
      'r-seen',
      'r-summarized',
    ]);
  });
});
