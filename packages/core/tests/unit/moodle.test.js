import { describe, it, expect } from 'vitest';
import moodle from '../../src/integrations/moodle.js';

const { IMPORTABLE_MODNAMES, isModuleImportable, isSectionVisible, mapModuleToItem } = moodle;

// Representative real module shapes (trimmed), based on
// spikes/moodle-poc/output/course-1998-contents.json and course-10-contents.json.
const resourceModule = () => ({
  id: 87317,
  modname: 'resource',
  name: '1. Vorlesung: Einführung',
  url: 'https://moodle.informatik.tu-darmstadt.de/mod/resource/view.php?id=87317',
  visible: 1,
  uservisible: true,
});

const urlModule = () => ({
  id: 87318,
  modname: 'url',
  name: '1. Vorlesung: Aufzeichnung (2021)',
  url: 'https://moodle.informatik.tu-darmstadt.de/mod/url/view.php?id=87318',
  visible: 1,
  uservisible: true,
});

const folderModule = () => ({
  id: 294,
  modname: 'folder',
  name: 'Bisherige Zwischenklausuren zum Selberrechnen',
  url: 'https://moodle.informatik.tu-darmstadt.de/mod/folder/view.php?id=294',
  visible: 1,
  uservisible: true,
});

describe('IMPORTABLE_MODNAMES', () => {
  it('is exactly resource/url/folder', () => {
    expect([...IMPORTABLE_MODNAMES].sort()).toEqual(['folder', 'resource', 'url']);
  });
});

describe('isModuleImportable', () => {
  it('accepts resource, url, and folder modules that are visible', () => {
    expect(isModuleImportable(resourceModule())).toBe(true);
    expect(isModuleImportable(urlModule())).toBe(true);
    expect(isModuleImportable(folderModule())).toBe(true);
  });

  it('rejects modname types that are never import candidates', () => {
    expect(isModuleImportable({ id: 1, modname: 'label', visible: 1, uservisible: true })).toBe(false);
    expect(isModuleImportable({ id: 2, modname: 'forum', visible: 1, uservisible: true })).toBe(false);
    expect(isModuleImportable({ id: 3, modname: 'choice', visible: 1, uservisible: true })).toBe(false);
    expect(isModuleImportable({ id: 4, modname: 'page', visible: 1, uservisible: true })).toBe(false);
    expect(isModuleImportable({ id: 5, modname: 'quiz', visible: 1, uservisible: true })).toBe(false);
    expect(isModuleImportable({ id: 6, modname: 'assign', visible: 1, uservisible: true })).toBe(false);
  });

  it('rejects a module hidden via the editor visible flag', () => {
    expect(isModuleImportable({ ...resourceModule(), visible: 0 })).toBe(false);
  });

  it('rejects a module Moodle computed as not user-visible (access restrictions)', () => {
    expect(isModuleImportable({ ...resourceModule(), uservisible: false })).toBe(false);
  });

  it('rejects null/undefined input', () => {
    expect(isModuleImportable(null)).toBe(false);
    expect(isModuleImportable(undefined)).toBe(false);
  });
});

describe('isSectionVisible', () => {
  it('accepts a normal visible section', () => {
    expect(isSectionVisible({ visible: 1, uservisible: true })).toBe(true);
  });

  it('rejects a section hidden via the editor visible flag', () => {
    // Real shape: course 1998's trailing "DMML Klausur" section.
    expect(isSectionVisible({ name: 'DMML Klausur', visible: 0, uservisible: false })).toBe(false);
  });

  it('rejects a section Moodle computed as not user-visible even if visible:1', () => {
    expect(isSectionVisible({ visible: 1, uservisible: false })).toBe(false);
  });

  it('rejects null/undefined input', () => {
    expect(isSectionVisible(null)).toBe(false);
    expect(isSectionVisible(undefined)).toBe(false);
  });
});

describe('mapModuleToItem', () => {
  it('shapes a module into {name, url, moodleModuleId}, dropping everything else', () => {
    const item = mapModuleToItem(resourceModule());
    expect(item).toEqual({
      name: '1. Vorlesung: Einführung',
      url: 'https://moodle.informatik.tu-darmstadt.de/mod/resource/view.php?id=87317',
      moodleModuleId: 87317,
    });
  });

  it('always uses module.url, never a fileurl field, even if present on the input', () => {
    const withFileurl = {
      ...resourceModule(),
      contents: [{ fileurl: 'https://moodle.informatik.tu-darmstadt.de/pluginfile.php/1/mod_resource/content/0/x.pdf?token=abc' }],
    };
    const item = mapModuleToItem(withFileurl);
    expect(item.url).toBe(withFileurl.url);
    expect(item.url).not.toContain('pluginfile.php');
    expect(item.url).not.toContain('token=');
  });
});
