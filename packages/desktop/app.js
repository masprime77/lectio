'use strict';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  semesterId: null,   // current semester file id (filename without .json)
  semester: null,     // loaded semester object
  openWeeks: new Set(), // weeks currently expanded
  openCourseWeeks: {}, // "courseId-week" -> true when that course-view week is expanded
  editingId: null,    // semester id being edited in the modal (null = create mode)
  editingSemester: null, // semester object the modal's Tags tab edits (live or draft)
  view: restoreView(), // 'week' | 'course' — restored from last session
  focusedCourseId: null, // null = normal All Courses layout; course id = focused mode
  sortOrder: restoreSort(), // course sort order — restored from last session
  studyMode: restoreStudyMode(), // Study Mode overlay — restored from last session
  breakdownOpen: false, // progress breakdown panel visibility
  tutorialStep: 0,   // current step index (0-based)
  tutorialActive: false, // whether the overlay is visible
};

// ---------------------------------------------------------------------------
// Persisted "last active" state (semester + view), restored on launch.
// Reads/writes are guarded so a corrupted/unavailable store never throws.
// ---------------------------------------------------------------------------
function readPref(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function writePref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    /* storage unavailable — ignore, not user-facing */
  }
}

// Restore the saved view, defaulting to "week" for missing/invalid values.
function restoreView() {
  const v = readPref('lastActiveView');
  return v === 'week' || v === 'course' ? v : 'week';
}

// Restore the saved course sort order, defaulting to "progress-desc".
function restoreSort() {
  const v = readPref('lastSortOrder');
  const valid = [
    'progress-desc', 'progress-asc',
    'alpha-asc', 'alpha-desc',
    'week-asc', 'week-desc',
  ];
  return valid.includes(v) ? v : 'progress-desc';
}

// Restore the saved Study Mode toggle, defaulting to off.
function restoreStudyMode() {
  return readPref('studyMode') === 'true';
}

// Whether the user has already seen (finished/skipped) the tutorial.
function hasTutorialBeenSeen() {
  return readPref('tutorialSeen') === 'true';
}

// ---------------------------------------------------------------------------
// API helpers — backed by the Electron preload bridge (window.planner),
// which forwards to the main process over IPC. No HTTP server involved.
// ---------------------------------------------------------------------------
const api = {
  list: () => window.planner.listSemesters(),
  load: (id) => window.planner.getSemester(id),
  save: (id, data) => window.planner.saveSemester(id, data),
  remove: (id) => window.planner.deleteSemester(id),
};

// ---------------------------------------------------------------------------
// Save system: debounced autosave with a header "Saving…/Saved" indicator.
// ---------------------------------------------------------------------------
const SAVE_DEBOUNCE_MS = 500;
const save = { timer: null, fadeTimer: null, saving: false, queued: false };

// Tell the main process whether there are unsaved changes (for the close prompt).
function markDirty(dirty) {
  if (window.saver && window.saver.setDirty) window.saver.setDirty(dirty);
}

function saveIndicator(kind) {
  const el = document.getElementById('save-status');
  if (!el) return;
  clearTimeout(save.fadeTimer);
  if (kind === 'unsaved') {
    el.className = 'save-status unsaved visible';
    el.innerHTML = '<span class="unsaved-dot"></span> Unsaved changes';
  } else if (kind === 'saving') {
    el.className = 'save-status saving visible';
    el.innerHTML = '<span class="save-spinner"></span> Saving…';
  } else if (kind === 'saved') {
    el.className = 'save-status saved visible';
    el.innerHTML = `${icon('check')} Saved`;
    save.fadeTimer = setTimeout(() => el.classList.remove('visible'), 2000);
  } else {
    el.className = 'save-status';
    el.innerHTML = '';
  }
}

// Show a transient confirmation message in the header save-status area (used for
// one-off actions like export/import that aren't part of the autosave cycle).
function showSaveStatus(message, ms = 2000) {
  const el = document.getElementById('save-status');
  if (!el) return;
  clearTimeout(save.fadeTimer);
  el.className = 'save-status saved visible';
  el.innerHTML = `${icon('check')} ${message}`;
  save.fadeTimer = setTimeout(() => el.classList.remove('visible'), ms);
}

// Manual save: write immediately (Cmd/Ctrl+S or File → Save). Cancels any
// pending debounce and flushes now.
async function saveNow() {
  clearTimeout(save.timer);
  save.timer = null;
  await flushSave();
}

// Wire the manual-save shortcut (Cmd/Ctrl+S) and the File → Save menu item.
function setupSave() {
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveNow();
    }
    // Esc exits focused single-course mode (when not in a modal/input).
    if (e.key === 'Escape' && state.focusedCourseId && !isTypingTarget(e.target)) {
      clearCourseFocus();
    }
  });
  if (window.saver) {
    window.saver.onMenuSave(() => saveNow());
    // On "Save and Close" from the quit dialog: flush, then let main quit.
    if (window.saver.onFlushSaveAndQuit) {
      window.saver.onFlushSaveAndQuit(async () => {
        await saveNow();
        window.saver.saveAndQuitDone();
      });
    }
  }
}

// Schedule a debounced save after an in-memory change (rapid changes coalesce).
// Autosave is on unless explicitly disabled in Settings (localStorage).
function isAutosaveEnabled() {
  return readPref('autosave') !== 'false';
}

function persist() {
  if (!state.semester) return;
  // Still track the unsaved state (indicator + quit prompt) even with autosave
  // off — only the debounced write is skipped. Manual save (⌘S) still works.
  markDirty(true);
  saveIndicator('unsaved');
  if (!isAutosaveEnabled()) return;
  clearTimeout(save.timer);
  save.timer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
}

// Write the current semester to disk, updating the indicator. Re-runs once more
// if another change came in mid-write, so nothing is lost.
async function flushSave() {
  clearTimeout(save.timer);
  save.timer = null;
  if (!state.semester) return;
  if (save.saving) {
    save.queued = true;
    return;
  }
  save.saving = true;
  saveIndicator('saving');
  try {
    await api.save(state.semesterId, state.semester);
  } catch (err) {
    console.error('Save failed:', err);
  } finally {
    save.saving = false;
    if (save.queued) {
      save.queued = false;
      return flushSave();
    }
    markDirty(false);
    saveIndicator('saved');
  }
}

// Shared pure logic, loaded from @lectio/core (planner-core) before this script.
const {
  getReadingTags, getTaskTags,
  isProtectedTag, addTag, deleteTag, editTag, reorderTags,
  courseProgress, uid, deleteCourse,
} = window.PlannerCore;

// ---------------------------------------------------------------------------
// Tabler icons (inline SVG — no external dependency, works offline)
// ---------------------------------------------------------------------------
const ICONS = {
  'chevron-right': '<path d="M9 6l6 6l-6 6" />',
  'chevrons-down': '<path d="M7 7l5 5l5 -5" /><path d="M7 13l5 5l5 -5" />',
  'chevrons-up': '<path d="M7 11l5 -5l5 5" /><path d="M7 17l5 -5l5 5" />',
  x: '<path d="M18 6l-12 12" /><path d="M6 6l12 12" />',
  pencil:
    '<path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" />',
  trash:
    '<path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />',
  plus: '<path d="M12 5l0 14" /><path d="M5 12l14 0" />',
  calendar:
    '<path d="M4 5m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /><path d="M16 3l0 4" /><path d="M8 3l0 4" /><path d="M4 11l16 0" />',
  columns:
    '<path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /><path d="M12 4l0 16" />',
  sun:
    '<path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" />',
  moon:
    '<path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" />',
  'device-desktop':
    '<path d="M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10z" /><path d="M7 20h10" /><path d="M9 16v4" /><path d="M15 16v4" />',
  check: '<path d="M5 12l5 5l10 -10" />',
  settings:
    '<path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />',
  help:
    '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 17l0 .01" /><path d="M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4" />',
  bug:
    '<path d="M9 9v-1a3 3 0 0 1 6 0v1" /><path d="M8 9h8a6 6 0 0 1 1 3v3a5 5 0 0 1 -10 0v-3a6 6 0 0 1 1 -3" /><path d="M3 13l4 0" /><path d="M17 13l4 0" /><path d="M12 20l0 -6" /><path d="M4 19l3.35 -2" /><path d="M20 19l-3.35 -2" /><path d="M4 7l3.75 2.4" /><path d="M20 7l-3.75 2.4" />',
  bulb:
    '<path d="M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7" /><path d="M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3" /><path d="M9.7 17l4.6 0" />',
  school:
    '<path d="M22 9l-10 -4l-10 4l10 4l10 -4v6" /><path d="M6 10.6v5.4a6 6 0 0 0 12 0v-5.4" />',
  'file-export':
    '<path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M11.5 21h-4.5a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v5m-5 6h7m-3 -3l3 3l-3 3" />',
  'file-import':
    '<path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 13v-8a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2h-5.5m-9.5 -2h7m-3 -3l-3 3l3 3" />',
};

function icon(name) {
  return `<svg class="ti" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
}

// ---------------------------------------------------------------------------
// Week / date helpers
// ---------------------------------------------------------------------------
function weekStart(startDate, week) {
  const d = new Date(startDate + 'T00:00:00');
  d.setDate(d.getDate() + (week - 1) * 7);
  return d;
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Which week of the semester is "today"? Returns 0 if outside the semester.
function currentWeek(sem) {
  const start = new Date(sem.startDate + 'T00:00:00');
  const now = new Date();
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  const wk = Math.floor(diffDays / 7) + 1;
  if (wk < 1 || wk > sem.weeks) return 0;
  return wk;
}

// ---------------------------------------------------------------------------
// Loading & selector
// ---------------------------------------------------------------------------
async function populateSelector() {
  const list = await api.list();
  const select = document.getElementById('semester-select');
  select.innerHTML = '';
  list.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    select.appendChild(opt);
  });
  return list;
}

async function loadSemester(id) {
  state.semesterId = id;
  state.semester = await api.load(id);
  state.openWeeks = new Set();
  state.focusedCourseId = null; // focus never persists across semester switches
  const cw = currentWeek(state.semester);
  if (cw) state.openWeeks.add(cw); // auto-expand current week
  document.getElementById('semester-select').value = id;
  writePref('lastActiveSemesterId', id); // remember for next launch
  setSemesterActionsEnabled(true);
  render();
}

// ---------------------------------------------------------------------------
// Render (filled in by later feature sections)
// ---------------------------------------------------------------------------
function render() {
  renderDashboard();
  renderPlanner();
}

// Return a sorted copy of `courses` per state.sortOrder. Pure: never mutates
// the input array (callers pass sem.courses, which must stay in its on-disk
// order). Progress sorts use courseProgress. Week sorts do NOT reorder courses
// — they only reorder the weeks themselves (handled in the render functions),
// so the course/column order falls back to alphabetical (A → Z) for them.
function sortedCourses(courses) {
  const copy = [...courses];
  if (state.sortOrder === 'progress-asc')
    return copy.sort(
      (a, b) =>
        courseProgress(a, state.semester, state.studyMode) -
        courseProgress(b, state.semester, state.studyMode)
    );
  if (state.sortOrder === 'progress-desc')
    return copy.sort(
      (a, b) =>
        courseProgress(b, state.semester, state.studyMode) -
        courseProgress(a, state.semester, state.studyMode)
    );
  if (state.sortOrder === 'alpha-desc')
    return copy.sort((a, b) => b.name.localeCompare(a.name));
  // alpha-asc, week-asc and week-desc all use alphabetical (A → Z) order.
  return copy.sort((a, b) => a.name.localeCompare(b.name));
}

// Course order for the Weekly view. Only week-based sorts reorder courses
// here; progress and alpha sorts apply to the dashboard/columns only, so the
// Weekly view keeps the original on-disk course order for them.
function sortedCoursesForWeekView(courses) {
  if (state.sortOrder === 'week-asc' || state.sortOrder === 'week-desc') {
    return sortedCourses(courses);
  }
  return [...courses]; // preserve original order
}

// Returns { readings: {done, total}, tasks: {done, total} } for one course.
// Mirrors the logic of courseProgress() but split by type.
function courseBreakdown(course, sem, studyMode) {
  const readings = (course && course.readings) || [];
  const tasks    = (course && course.tasks)    || [];

  let doneR, doneT;
  if (studyMode) {
    doneR = readings.filter((r) => r.status === 'r-studied').length;
    doneT = tasks.filter((t)   => t.status === 't-studied').length;
  } else {
    const rTags    = getReadingTags(sem || {});
    const tTags    = getTaskTags(sem    || {});
    const rDoneIds = new Set(rTags.filter((t) => t.section === 'done').map((t) => t.id));
    const tDoneIds = new Set(tTags.filter((t) => t.section === 'done').map((t) => t.id));
    doneR = readings.filter(
      (r) => rDoneIds.has(r.status) || (r.status === '__deleted__' && r._ghostSection === 'done')
    ).length;
    doneT = tasks.filter(
      (t) => tDoneIds.has(t.status) || (t.status === '__deleted__' && t._ghostSection === 'done')
    ).length;
  }

  return {
    readings: { done: doneR, total: readings.length },
    tasks:    { done: doneT, total: tasks.length    },
  };
}

// ---------------------------------------------------------------------------
// Dashboard: per-course progress + current week indicator
// (courseProgress comes from @lectio/core planner-core)
// ---------------------------------------------------------------------------
function renderDashboard() {
  const sem = state.semester;
  const root = document.getElementById('dashboard');
  const cw = currentWeek(sem);

  const breakdownBtnLabel = state.breakdownOpen ? 'Hide Breakdown' : 'Breakdown';
  const breakdownBtnActive = state.breakdownOpen ? ' breakdown-toggle--active' : '';
  const heading = `
    <div class="dashboard-header">
      <h2>${escapeHtml(sem.name)}</h2>
      <button class="breakdown-toggle${breakdownBtnActive}" id="breakdown-btn"
              title="Show readings vs tasks progress" aria-expanded="${state.breakdownOpen}">
        ${breakdownBtnLabel}
      </button>
    </div>`;
  const weekLine = cw
    ? `<div class="current-week">Current week: <strong>Week ${cw}</strong> of ${sem.weeks}</div>`
    : `<div class="current-week">Semester not currently in session (${sem.weeks} weeks total)</div>`;

  let bars = '';
  if (sem.courses.length === 0) {
    bars = '<div class="week-empty">No courses yet.</div>';
  } else {
    sortedCourses(sem.courses).forEach((course) => {
      const pct = courseProgress(course, sem, state.studyMode);
      let rowClass = 'progress-row';
      if (state.focusedCourseId) {
        rowClass += state.focusedCourseId === course.id
          ? ' progress-row--active'
          : ' progress-row--dimmed';
      }
      bars += `
        <div class="${rowClass}" data-course-id="${escapeHtml(course.id)}">
          <div class="progress-label">
            <span class="progress-course-name">${escapeHtml(course.name)}</span>
            <span>${pct}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${pct}%;background:${course.color}"></div>
          </div>
        </div>`;
    });
  }

  root.innerHTML = heading + weekLine + bars;

  // Render the breakdown panel if open.
  if (state.breakdownOpen && sem.courses.length > 0) {
    const panel = document.createElement('div');
    panel.className = 'breakdown-panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Progress breakdown');

    // Build table rows
    let totalRDone = 0, totalRAll = 0, totalTDone = 0, totalTAll = 0;
    let rows = '';
    sortedCourses(sem.courses).forEach((course) => {
      const bd = courseBreakdown(course, sem, state.studyMode);
      totalRDone += bd.readings.done;
      totalRAll  += bd.readings.total;
      totalTDone += bd.tasks.done;
      totalTAll  += bd.tasks.total;

      const rPct = bd.readings.total > 0
        ? Math.round((bd.readings.done / bd.readings.total) * 100) : 0;
      const tPct = bd.tasks.total > 0
        ? Math.round((bd.tasks.done   / bd.tasks.total)   * 100) : 0;

      rows += `
        <tr>
          <td class="bd-name" style="color:${escapeHtml(course.color)}">${escapeHtml(course.name)}</td>
          <td class="bd-cell">
            <div class="bd-cell-inner">
              <div class="bd-mini-bar-wrap">
                <div class="bd-mini-bar" style="width:${rPct}%;background:${escapeHtml(course.color)}"></div>
              </div>
              <span class="bd-pct">${bd.readings.done}/${bd.readings.total}</span>
            </div>
          </td>
          <td class="bd-cell">
            <div class="bd-cell-inner">
              <div class="bd-mini-bar-wrap">
                <div class="bd-mini-bar" style="width:${tPct}%;background:${escapeHtml(course.color)}"></div>
              </div>
              <span class="bd-pct">${bd.tasks.done}/${bd.tasks.total}</span>
            </div>
          </td>
        </tr>`;
    });

    // Summary row
    const srPct = totalRAll > 0 ? Math.round((totalRDone / totalRAll) * 100) : 0;
    const stPct = totalTAll > 0 ? Math.round((totalTDone / totalTAll) * 100) : 0;
    const summaryRow = `
      <tr class="bd-summary">
        <td class="bd-name">Total</td>
        <td class="bd-cell">
          <div class="bd-cell-inner">
            <div class="bd-mini-bar-wrap">
              <div class="bd-mini-bar bd-mini-bar--summary" style="width:${srPct}%"></div>
            </div>
            <span class="bd-pct">${totalRDone}/${totalRAll} (${srPct}%)</span>
          </div>
        </td>
        <td class="bd-cell">
          <div class="bd-cell-inner">
            <div class="bd-mini-bar-wrap">
              <div class="bd-mini-bar bd-mini-bar--summary" style="width:${stPct}%"></div>
            </div>
            <span class="bd-pct">${totalTDone}/${totalTAll} (${stPct}%)</span>
          </div>
        </td>
      </tr>`;

    panel.innerHTML = `
      <table class="breakdown-table" aria-label="Readings and tasks breakdown">
        <thead>
          <tr>
            <th class="bd-th-course">Course</th>
            <th class="bd-th-type">Readings</th>
            <th class="bd-th-type">Tasks</th>
          </tr>
        </thead>
        <tbody>${rows}${summaryRow}</tbody>
      </table>`;

    root.appendChild(panel);
  }

  // Wire up the breakdown toggle button.
  const breakdownBtn = root.querySelector('#breakdown-btn');
  if (breakdownBtn) {
    breakdownBtn.addEventListener('click', () => {
      state.breakdownOpen = !state.breakdownOpen;
      renderDashboard();
    });
  }

  // Wire up clickable course names: toggle focused single-course mode.
  root.querySelectorAll('.progress-row').forEach((row) => {
    const nameEl = row.querySelector('.progress-course-name');
    if (!nameEl) return;
    nameEl.addEventListener('click', () => {
      const id = row.getAttribute('data-course-id');
      state.focusedCourseId = state.focusedCourseId === id ? null : id;
      renderDashboard();
      renderPlanner();
    });
  });

  // Always offer a persistent way to add a course, empty or not.
  root.appendChild(addCourseButton('dashboard-add-course'));
}

// True when the event target is a field the user is typing into, so global
// shortcuts (e.g. Esc to exit focus) don't hijack in-progress edits.
function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// A "+ Add course" button that opens the existing course creation flow
// (the semester editor) for the current semester.
function addCourseButton(extraClass = '') {
  const btn = document.createElement('button');
  btn.className = ('btn btn-small btn-icon-text add-course-btn ' + extraClass).trim();
  btn.innerHTML = `${icon('plus')}<span>Add course</span>`;
  btn.addEventListener('click', openAddCourse);
  return btn;
}

// ---------------------------------------------------------------------------
// Planner: dispatches to the selected layout
// ---------------------------------------------------------------------------
function renderPlanner() {
  const root = document.getElementById('planner');
  root.className = 'planner view-' + state.view;
  if (state.view === 'course') renderCourseView();
  else renderWeekView();
}

// ---------------------------------------------------------------------------
// Week view: collapsible weeks, one course card per week
// ---------------------------------------------------------------------------
function renderWeekView() {
  const sem = state.semester;
  const root = document.getElementById('planner');
  root.innerHTML = '';
  const cw = currentWeek(sem);

  // Week display order: ascending by default, descending for week-desc.
  let weekNumbers = Array.from({ length: sem.weeks }, (_, i) => i + 1);
  if (state.sortOrder === 'week-desc') weekNumbers = weekNumbers.reverse();

  weekNumbers.forEach((week) => {
    const isOpen = state.openWeeks.has(week);
    const start = weekStart(sem.startDate, week);
    const end = weekStart(sem.startDate, week);
    end.setDate(end.getDate() + 6);

    const weekEl = document.createElement('div');
    weekEl.className = 'week' + (isOpen ? ' open' : '');

    const header = document.createElement('div');
    header.className = 'week-header';
    header.innerHTML = `
      <span class="chevron">${icon('chevron-right')}</span>
      <span class="week-title">Week ${week}</span>
      <span class="week-dates">${formatDate(start)} – ${formatDate(end)}</span>
      ${week === cw ? '<span class="week-badge">Current</span>' : ''}
    `;
    header.addEventListener('click', () => toggleWeek(week));
    weekEl.appendChild(header);

    const body = document.createElement('div');
    body.className = 'week-body';

    if (sem.courses.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'week-empty';
      empty.textContent = 'No courses yet.';
      body.appendChild(empty);
      body.appendChild(addCourseButton());
    } else {
      sortedCoursesForWeekView(sem.courses).forEach((course) => {
        body.appendChild(renderCourseCard(course, week));
      });
    }

    weekEl.appendChild(body);
    root.appendChild(weekEl);
  });
}

function toggleWeek(week) {
  if (state.openWeeks.has(week)) state.openWeeks.delete(week);
  else state.openWeeks.add(week);
  renderPlanner();
}

// ---------------------------------------------------------------------------
// Bulk expand/collapse for the active view's week sections.
// Operates on state.openWeeks (Weekly view) or state.openCourseWeeks
// (All Courses view) depending on which layout is showing.
// ---------------------------------------------------------------------------
function setAllWeeksOpen(mode) {
  const sem = state.semester;
  if (!sem) return;
  const cw = currentWeek(sem);

  if (state.view === 'course') {
    sem.courses.forEach((course) => {
      for (let w = 1; w <= sem.weeks; w++) {
        const open = mode === 'all' || (mode === 'current' && w === cw);
        state.openCourseWeeks[course.id + '-' + w] = open;
      }
    });
  } else {
    state.openWeeks = new Set();
    if (mode === 'all') {
      for (let w = 1; w <= sem.weeks; w++) state.openWeeks.add(w);
    } else if (mode === 'current' && cw) {
      state.openWeeks.add(cw);
    }
  }
  renderPlanner();
}

// Exit focused single-course mode and return to the full All Courses layout.
function clearCourseFocus() {
  if (!state.focusedCourseId) return;
  state.focusedCourseId = null;
  renderDashboard();
  renderPlanner();
}

// ---------------------------------------------------------------------------
// Course view: one column per course, entries grouped by week dividers
// ---------------------------------------------------------------------------
function renderCourseView() {
  const sem = state.semester;
  const root = document.getElementById('planner');
  root.innerHTML = '';

  const board = document.createElement('div');
  board.className = 'course-board';

  // Focused mode: isolate the selected course in a single centred column.
  const focused = state.focusedCourseId
    ? sem.courses.some((c) => c.id === state.focusedCourseId)
    : false;
  const sorted = sortedCourses(sem.courses);
  const courses = focused
    ? sorted.filter((c) => c.id === state.focusedCourseId)
    : sorted;
  if (focused) {
    board.style.justifyContent = 'center';
    board.classList.add('course-board--focused');
    // Clicking the empty space around the column exits focused mode.
    board.addEventListener('click', (e) => {
      if (e.target === board) clearCourseFocus();
    });
  }

  courses.forEach((course) => {
    const col = document.createElement('div');
    col.className = focused ? 'course-column--focused' : 'course-column';
    col.style.borderTopColor = course.color;

    const header = document.createElement('div');
    header.className = 'course-column-header';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'course-column-header-name';
    nameSpan.textContent = course.name;
    nameSpan.title = course.name;
    nameSpan.style.color = course.color;
    header.appendChild(nameSpan);

    // Edit (opens the semester editor, the existing way to rename/recolor a course)
    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.innerHTML = icon('pencil');
    editBtn.title = 'Edit semester (to rename/recolor this course)';
    editBtn.addEventListener('click', () => openEditModal(state.semesterId, 'courses'));
    header.appendChild(editBtn);

    // Export
    const exportBtn = document.createElement('button');
    exportBtn.className = 'icon-btn';
    exportBtn.innerHTML = icon('file-export');
    exportBtn.title = 'Export course';
    exportBtn.addEventListener('click', () => exportCourse(course));
    header.appendChild(exportBtn);

    // Import (imports a course into this semester, not "replace this course")
    const importCourseBtn = document.createElement('button');
    importCourseBtn.className = 'icon-btn';
    importCourseBtn.innerHTML = icon('file-import');
    importCourseBtn.title = 'Import a course into this semester';
    importCourseBtn.addEventListener('click', async () => {
      const { canceled, filePath } = await window.planner.showOpenDialog({ title: 'Import Course' });
      if (canceled) return;
      try {
        const payload = await window.planner.importFile({ filePath });
        await importCourse(payload);
      } catch (err) {
        alert('Could not read file: ' + (err.message || err));
      }
    });
    header.appendChild(importCourseBtn);

    // Delete
    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn btn-danger';
    delBtn.innerHTML = icon('trash');
    delBtn.title = 'Delete course';
    delBtn.addEventListener('click', () => {
      if (!confirm(`Delete course "${course.name}"? All its readings and tasks will be lost.`)) return;
      deleteCourse(state.semester, course.id);
      persist();
      render();
    });
    header.appendChild(delBtn);

    col.appendChild(header);

    const body = document.createElement('div');
    body.className = 'course-column-body';

    // Week display order: ascending by default, descending for week-desc.
    let weekNumbers = Array.from({ length: sem.weeks }, (_, i) => i + 1);
    if (state.sortOrder === 'week-desc') weekNumbers = weekNumbers.reverse();

    // Weeks (in display order) that have any reading or task for this course.
    const weeks = [];
    weekNumbers.forEach((w) => {
      const readings = course.readings.filter((r) => r.week === w);
      const tasks = course.tasks.filter((t) => t.week === w);
      if (readings.length || tasks.length) weeks.push({ w, readings, tasks });
    });

    if (weeks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'week-empty';
      empty.textContent = 'No readings or tasks yet.';
      body.appendChild(empty);
      body.appendChild(addControls(course, currentWeek(sem) || 1));
    } else {
      weeks.forEach(({ w, readings, tasks }) => {
        const key = course.id + '-' + w;
        const isOpen = key in state.openCourseWeeks
          ? state.openCourseWeeks[key]
          : w === currentWeek(sem);
        state.openCourseWeeks[key] = isOpen;

        const start = weekStart(sem.startDate, w);
        const end = weekStart(sem.startDate, w);
        end.setDate(end.getDate() + 6);
        const weekHeader = document.createElement('div');
        weekHeader.className = 'course-week-header' + (isOpen ? ' open' : '');
        weekHeader.innerHTML = `<span class="course-week-chevron">${icon('chevron-right')}</span>
          <span class="week-divider-label">Week ${w}</span>
          <span class="week-divider-dates">${formatDate(start)} – ${formatDate(end)}</span>`;
        weekHeader.addEventListener('click', () => {
          state.openCourseWeeks[key] = !state.openCourseWeeks[key];
          renderCourseView();
        });

        const weekBody = document.createElement('div');
        weekBody.className = 'course-week-body' + (isOpen ? ' open' : '');
        weekBody.appendChild(sectionTitle('Readings'));
        weekBody.appendChild(renderItemList(readings, 'reading', course, w));
        weekBody.appendChild(sectionTitle('Tasks'));
        weekBody.appendChild(renderItemList(tasks, 'task', course, w));
        weekBody.appendChild(addControls(course, w));

        body.appendChild(weekHeader);
        body.appendChild(weekBody);
      });
    }

    col.appendChild(body);
    board.appendChild(col);
  });

  // Persistent "+ Add course" column at the end of the row (not in focused mode).
  if (!focused) board.appendChild(addCourseColumn());

  root.appendChild(board);
}

// A dashed "add course" column placed at the end of the course board.
function addCourseColumn() {
  const col = document.createElement('div');
  col.className = 'course-add-column';
  col.appendChild(addCourseButton('course-add-btn'));
  return col;
}

// Horizontal divider with the week label and date range.
function weekDivider(sem, week) {
  const start = weekStart(sem.startDate, week);
  const end = weekStart(sem.startDate, week);
  end.setDate(end.getDate() + 6);
  const el = document.createElement('div');
  el.className = 'week-divider' + (week === currentWeek(sem) ? ' current' : '');
  el.innerHTML = `<span class="week-divider-label">Week ${week}</span>
    <span class="week-divider-dates">${formatDate(start)} – ${formatDate(end)}</span>`;
  return el;
}

function renderCourseCard(course, week) {
  const card = document.createElement('div');
  card.className = 'course-card';
  card.style.borderLeftColor = course.color;

  const title = document.createElement('h4');
  title.textContent = course.name;
  title.style.color = course.color;
  card.appendChild(title);

  const readings = course.readings.filter((r) => r.week === week);
  const tasks = course.tasks.filter((t) => t.week === week);

  card.appendChild(sectionTitle('Readings'));
  card.appendChild(renderItemList(readings, 'reading', course, week));
  card.appendChild(addRow('reading', course, week));

  card.appendChild(sectionTitle('Tasks'));
  card.appendChild(renderItemList(tasks, 'task', course, week));
  card.appendChild(addRow('task', course, week));

  return card;
}

function sectionTitle(text) {
  const el = document.createElement('p');
  el.className = 'card-section-title';
  el.textContent = text;
  return el;
}

function renderItemList(items, type, course, week) {
  const ul = document.createElement('ul');
  ul.className = 'item-list';
  if (items.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'week-empty';
    empty.textContent = type === 'reading' ? 'No readings.' : 'No tasks.';
    ul.appendChild(empty);
    return ul;
  }
  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'item';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'item-title';
    titleSpan.textContent = item.title;
    // Inline edit: click the title to rename
    titleSpan.title = 'Click to rename';
    titleSpan.style.cursor = 'text';
    titleSpan.addEventListener('click', () => editItemTitle(titleSpan, item));
    li.appendChild(titleSpan);

    if (type === 'task') {
      if (item.dueDate) {
        // Existing due date — clickable to edit.
        const due = document.createElement('span');
        due.className = 'item-due';
        due.textContent = 'due ' + item.dueDate;
        due.title = 'Click to edit due date';
        due.style.cursor = 'pointer';
        due.addEventListener('click', () => editItemDueDate(due, item));
        li.appendChild(due);
      } else {
        // No due date — show a hover affordance to add one.
        const addDue = document.createElement('span');
        addDue.className = 'item-add-due';
        addDue.textContent = '＋ date';
        addDue.title = 'Add due date';
        addDue.addEventListener('click', () => editItemDueDate(addDue, item));
        li.appendChild(addDue);
      }
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'tag-dropdown-wrapper';

    // The trigger button shows the current tag's name and color.
    const trigger = document.createElement('button');
    trigger.className = 'badge tag-trigger';
    const tags = type === 'reading'
      ? getReadingTags(state.semester)
      : getTaskTags(state.semester);
    const currentTag = tags.find((t) => t.id === item.status)
      || { name: '-', color: '#999', section: 'pending' }; // ghost fallback
    trigger.textContent = currentTag.name;
    trigger.style.setProperty('--tag-color', currentTag.color);
    trigger.title = 'Click to change status';

    // The dropdown menu (hidden by default).
    const menu = document.createElement('div');
    menu.className = 'tag-menu hidden';

    // Build two sections: Pending and Done.
    ['pending', 'done'].forEach((section) => {
      const sectionTags = tags.filter((t) => t.section === section);
      if (sectionTags.length === 0) return;
      const label = document.createElement('div');
      label.className = 'tag-menu-section-label';
      label.textContent = section === 'pending' ? 'Pending' : 'Done';
      menu.appendChild(label);
      sectionTags.forEach((tag) => {
        const opt = document.createElement('button');
        opt.className = 'tag-menu-option' + (tag.id === item.status ? ' active' : '');
        opt.textContent = tag.name;
        opt.style.setProperty('--tag-color', tag.color);
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          item.status = tag.id;
          persist();
          render();
        });
        menu.appendChild(opt);
      });
    });

    // In Study Mode, add a distinct "Studied" shortcut below Done. The studied
    // tag still appears in the Done section above — this is an extra entry.
    if (state.studyMode) {
      const studiedId = type === 'reading' ? 'r-studied' : 't-studied';
      const studiedTag = tags.find((t) => t.id === studiedId);
      if (studiedTag) {
        const sep = document.createElement('div');
        sep.className = 'tag-menu-section-label tag-menu-studied-label';
        sep.textContent = 'Studied';
        menu.appendChild(sep);

        const opt = document.createElement('button');
        opt.className = 'tag-menu-option' + (item.status === studiedId ? ' active' : '');
        opt.textContent = studiedTag.name;
        opt.style.setProperty('--tag-color', studiedTag.color);
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          item.status = studiedId;
          persist();
          render();
        });
        menu.appendChild(opt);
      }
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !menu.classList.contains('hidden');
      // Close all other open menus first.
      document.querySelectorAll('.tag-menu').forEach((m) => m.classList.add('hidden'));
      if (!isOpen) menu.classList.remove('hidden');
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    li.appendChild(wrapper);

    const del = document.createElement('button');
    del.className = 'icon-btn';
    del.innerHTML = icon('x');
    del.title = 'Delete';
    del.addEventListener('click', () => {
      const arr = type === 'reading' ? course.readings : course.tasks;
      const idx = arr.indexOf(item);
      if (idx > -1) arr.splice(idx, 1);
      persist();
      render();
    });
    li.appendChild(del);

    ul.appendChild(li);
  });
  return ul;
}

// Replace a title span with an input for inline renaming.
function editItemTitle(span, item) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = item.title;
  input.className = 'item-title';
  const commit = () => {
    const v = input.value.trim();
    if (v) item.title = v;
    persist();
    render();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') render();
  });
  span.replaceWith(input);
  input.focus();
  input.select();
}

// Replace the due-date span (or add-due affordance) with an inline
// date input. originalSpan is the element to swap back on Escape.
function editItemDueDate(originalSpan, item) {
  const input = document.createElement('input');
  input.type = 'date';
  input.value = item.dueDate || '';
  input.className = 'item-due item-due-input';

  const commit = () => {
    const v = input.value.trim();
    item.dueDate = v || '';
    persist();
    render();
  };
  const cancel = () => {
    input.replaceWith(originalSpan);
  };

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') {
      // Remove the blur listener so it does not fire after replaceWith.
      input.removeEventListener('blur', commit);
      cancel();
    }
  });

  originalSpan.replaceWith(input);
  input.focus();
}

// Low-weight "+ Reading" / "+ Task" buttons (Course view). Clicking one reveals
// the existing add-input for that type, focused — so the add UI stays out of the
// way until needed but nothing is redesigned. Used at the bottom of each week
// section and in a course column's empty state.
function addControls(course, week) {
  const row = document.createElement('div');
  row.className = 'add-controls';
  const mk = (type, label) => {
    const btn = document.createElement('button');
    btn.className = 'add-mini';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      const input = addRow(type, course, week);
      row.replaceWith(input);
      const field = input.querySelector('input[type="text"]');
      if (field) field.focus();
    });
    return btn;
  };
  row.appendChild(mk('reading', '+ Reading'));
  row.appendChild(mk('task', '+ Task'));
  return row;
}

// A row of inputs to add a new reading or task to a course/week.
function addRow(type, course, week) {
  const row = document.createElement('div');
  row.className = 'add-row';

  const title = document.createElement('input');
  title.type = 'text';
  title.placeholder = type === 'reading' ? 'New reading…' : 'New task…';

  let due;
  if (type === 'task') {
    due = document.createElement('input');
    due.type = 'date';
    due.title = 'Due date (optional)';
  }

  const btn = document.createElement('button');
  btn.className = 'btn btn-small';
  btn.textContent = 'Add';

  const add = () => {
    const v = title.value.trim();
    if (!v) return;
    if (type === 'reading') {
      course.readings.push({ id: uid('r'), week, title: v, status: 'r-pending' });
    } else {
      course.tasks.push({
        id: uid('t'),
        week,
        title: v,
        dueDate: due.value || '',
        status: 't-pending',
      });
    }
    persist();
    render();
  };

  btn.addEventListener('click', add);
  title.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') add();
  });

  row.appendChild(title);
  if (due) row.appendChild(due);
  row.appendChild(btn);
  return row;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Tutorial steps
// To add a step for a new feature: append an object to this array.
// Fields: id (string), title (string), description (string),
//         targetSelector (CSS selector | null), setup (async fn | null).
// Steps run in order; setup() is awaited before the overlay is shown.
// ---------------------------------------------------------------------------
const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Lectio',
    description:
      'Lectio helps you plan your university semester: courses, weekly readings, and tasks — all in one place. This quick tour will show you around. Click Next to begin.',
    targetSelector: null,
    setup: null,
  },
  {
    id: 'example-semester',
    title: 'Your semester',
    description:
      'This is the semester selector. Lectio comes with an example semester so you can explore right away. You can create your own with the "New" button.',
    targetSelector: '#semester-select',
    setup: async () => {
      // Ensure the example semester (id "ss2025") is loaded, if it exists.
      // If the user already has a different semester active, do nothing.
      const list = await api.list();
      const example = list.find((s) => s.id === 'ss2025');
      if (example && state.semesterId !== 'ss2025') {
        await loadSemester('ss2025');
      }
    },
  },
  {
    id: 'dashboard',
    title: 'Progress dashboard',
    description:
      'The dashboard shows each course with a progress bar. The percentage reflects how many readings and tasks are marked done. Click a course name to focus on it.',
    targetSelector: '#dashboard',
    setup: null,
  },
  {
    id: 'views',
    title: 'Two views',
    description:
      'Switch between Weekly view (readings and tasks grouped by week) and All Courses view (a column per course). Use the buttons in the header.',
    targetSelector: '.view-toggle',
    setup: null,
  },
  {
    id: 'item-status',
    title: 'Reading and task tags',
    description:
      'Click any reading or task badge to open its tag menu and pick a tag. Default reading tags are Pending, Seen, Summarized, and Studied; tasks use Pending, Done, and Studied. Tags in the "done" group count toward progress, and you can add, rename, recolor, or reorder your own.',
    targetSelector: '#planner',
    setup: null,
  },
  {
    id: 'sort',
    title: 'Sort courses',
    description:
      'Use the sort dropdown to reorder courses by progress, alphabetically, or by the week with the most pending work.',
    targetSelector: '#sort-select',
    setup: null,
  },
  {
    id: 'study-mode',
    title: 'Study Mode',
    description:
      'Study Mode recalculates progress counting only items tagged "Studied" — useful during revision week. Toggle it on and off any time.',
    targetSelector: '#study-mode-btn',
    setup: null,
  },
  {
    id: 'new-semester',
    title: 'Create your own semester',
    description:
      'Ready to start planning? Click "New" to create a semester: give it a name, a start date, a number of weeks, and add your courses. You can always edit it later.',
    targetSelector: '#new-btn',
    setup: null,
  },
  {
    id: 'done',
    title: "You're all set",
    description:
      'That\'s everything you need to know. You can replay this tour any time from Settings → Tutorial. Good luck with your semester!',
    targetSelector: null,
    setup: null,
  },
];

// ---------------------------------------------------------------------------
// Tutorial engine
// ---------------------------------------------------------------------------

function isTutorialElementVisible(selector) {
  if (!selector) return true;
  const el = document.querySelector(selector);
  return !!el;
}

// Position the tooltip relative to the spotlight target.
// Returns { top, left } in px, clamped to viewport with 12px margin.
function tutorialTooltipPosition(targetEl) {
  const PAD = 12; // gap between spotlight edge and tooltip
  const MARGIN = 12; // minimum distance from viewport edge
  const tooltip = document.getElementById('tutorial-tooltip');
  if (!tooltip || !targetEl) {
    // Centered
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }
  const tRect = targetEl.getBoundingClientRect();
  const tipRect = tooltip.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Prefer placing below; fall back to above; then right; then centered.
  let top, left;
  if (tRect.bottom + PAD + tipRect.height + MARGIN < vh) {
    top = tRect.bottom + PAD;
    left = tRect.left;
  } else if (tRect.top - PAD - tipRect.height - MARGIN > 0) {
    top = tRect.top - PAD - tipRect.height;
    left = tRect.left;
  } else if (tRect.right + PAD + tipRect.width + MARGIN < vw) {
    top = tRect.top;
    left = tRect.right + PAD;
  } else {
    top = vh / 2 - tipRect.height / 2;
    left = vw / 2 - tipRect.width / 2;
  }

  // Clamp to viewport
  left = Math.max(MARGIN, Math.min(left, vw - tipRect.width - MARGIN));
  top  = Math.max(MARGIN, Math.min(top,  vh - tipRect.height - MARGIN));

  return { top: top + 'px', left: left + 'px', transform: 'none' };
}

// Update the spotlight cutout on the overlay SVG.
// Uses a <clipPath> approach: the overlay is a full-screen div with a hole.
function updateSpotlight(targetEl) {
  const overlay = document.getElementById('tutorial-overlay');
  const spotlight = document.getElementById('tutorial-spotlight');
  if (!spotlight) return;

  if (!targetEl) {
    spotlight.style.display = 'none';
    return;
  }

  const rect = targetEl.getBoundingClientRect();
  const RADIUS = 6; // px, rounded corners on spotlight
  const PAD = 6;    // extra padding around target
  const x = rect.left - PAD;
  const y = rect.top  - PAD;
  const w = rect.width  + PAD * 2;
  const h = rect.height + PAD * 2;

  spotlight.style.display = 'block';
  spotlight.style.left   = x + 'px';
  spotlight.style.top    = y + 'px';
  spotlight.style.width  = w + 'px';
  spotlight.style.height = h + 'px';
  spotlight.style.borderRadius = RADIUS + 'px';
}

async function showTutorialStep(index) {
  const step = TUTORIAL_STEPS[index];
  if (!step) return;

  // Run setup before showing UI.
  if (step.setup) await step.setup();

  const overlay   = document.getElementById('tutorial-overlay');
  const tooltip   = document.getElementById('tutorial-tooltip');
  const titleEl   = document.getElementById('tutorial-title');
  const descEl    = document.getElementById('tutorial-desc');
  const prevBtn   = document.getElementById('tutorial-prev');
  const nextBtn   = document.getElementById('tutorial-next');
  const skipBtn   = document.getElementById('tutorial-skip');
  const counter   = document.getElementById('tutorial-counter');

  titleEl.textContent = step.title;
  descEl.textContent  = step.description;

  const total = TUTORIAL_STEPS.length;
  counter.textContent = `${index + 1} / ${total}`;

  prevBtn.disabled = (index === 0);
  const isLast = (index === total - 1);
  nextBtn.textContent = isLast ? 'Finish' : 'Next';

  // Spotlight
  const targetEl = step.targetSelector
    ? document.querySelector(step.targetSelector)
    : null;
  updateSpotlight(targetEl);

  // Show overlay (must happen before we measure tooltip for positioning).
  overlay.classList.remove('hidden');
  tooltip.style.transform = 'none';

  // Position tooltip after a frame so the browser has laid it out.
  requestAnimationFrame(() => {
    const pos = tutorialTooltipPosition(targetEl);
    tooltip.style.top       = pos.top;
    tooltip.style.left      = pos.left;
    tooltip.style.transform = pos.transform;
  });
}

function closeTutorial(markSeen = true) {
  document.getElementById('tutorial-overlay').classList.add('hidden');
  state.tutorialActive = false;
  if (markSeen) writePref('tutorialSeen', 'true');
}

async function startTutorial() {
  state.tutorialActive = true;
  state.tutorialStep   = 0;
  await showTutorialStep(0);
}

function setupTutorial() {
  const overlay = document.getElementById('tutorial-overlay');
  const prevBtn = document.getElementById('tutorial-prev');
  const nextBtn = document.getElementById('tutorial-next');
  const skipBtn = document.getElementById('tutorial-skip');

  prevBtn.addEventListener('click', async () => {
    if (state.tutorialStep > 0) {
      state.tutorialStep--;
      await showTutorialStep(state.tutorialStep);
    }
  });

  nextBtn.addEventListener('click', async () => {
    const isLast = state.tutorialStep === TUTORIAL_STEPS.length - 1;
    if (isLast) {
      closeTutorial(true);
    } else {
      state.tutorialStep++;
      await showTutorialStep(state.tutorialStep);
    }
  });

  skipBtn.addEventListener('click', () => closeTutorial(true));

  // Keyboard navigation: Right/Enter = next, Left = prev, Escape = skip.
  document.addEventListener('keydown', (e) => {
    if (!state.tutorialActive) return;
    if (e.key === 'Escape') { closeTutorial(true); return; }
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      // Prevent Enter from also triggering a focused button.
      if (e.key === 'Enter' && document.activeElement &&
          document.activeElement !== document.body) return;
      nextBtn.click();
    }
    if (e.key === 'ArrowLeft') prevBtn.click();
  });
}

async function init() {
  document.body.classList.add('electron-app');

  // Icon buttons in the header
  document.getElementById('edit-semester-btn').innerHTML = icon('pencil') + '<span style="font-size:0.75rem;margin-left:0.25rem;">Edit</span>';
  document.getElementById('delete-semester-btn').innerHTML = icon('trash') + '<span style="font-size:0.75rem;margin-left:0.25rem;">Delete</span>';

  // Import/Export buttons inside the semester modal footer
  document.getElementById('modal-import-btn').innerHTML =
    icon('file-import') + '<span>Import</span>';
  document.getElementById('modal-export-btn').innerHTML =
    icon('file-export') + '<span>Export</span>';

  // Bulk expand/collapse controls (apply to whichever view is active)
  const expandAllBtn = document.getElementById('expand-all-btn');
  const collapseAllBtn = document.getElementById('collapse-all-btn');
  const expandCurrentBtn = document.getElementById('expand-current-btn');
  expandAllBtn.innerHTML = icon('chevrons-down');
  collapseAllBtn.innerHTML = icon('chevrons-up');
  expandCurrentBtn.innerHTML = icon('calendar');
  expandAllBtn.addEventListener('click', () => setAllWeeksOpen('all'));
  collapseAllBtn.addEventListener('click', () => setAllWeeksOpen('none'));
  expandCurrentBtn.addEventListener('click', () => setAllWeeksOpen('current'));

  const list = await populateSelector();
  if (list.length) {
    // Restore the last active semester if it still exists, else fall back to
    // the first one (which loadSemester then records as the new last active).
    const savedId = readPref('lastActiveSemesterId');
    const idToLoad = list.some((s) => s.id === savedId) ? savedId : list[0].id;
    await loadSemester(idToLoad);
  } else {
    renderEmptyState();
  }

  document.getElementById('semester-select').addEventListener('change', (e) => {
    loadSemester(e.target.value);
  });
  document.getElementById('edit-semester-btn').addEventListener('click', () => {
    if (state.semesterId) openEditModal(state.semesterId);
  });
  document.getElementById('delete-semester-btn').addEventListener('click', () => {
    if (state.semesterId) deleteSemester(state.semesterId);
  });

  // Close any open status dropdown when clicking outside of it.
  document.addEventListener('click', () => {
    document.querySelectorAll('.tag-menu').forEach((m) => m.classList.add('hidden'));
  });

  setupViewToggle();
  setupSort();
  setupStudyMode();
  setupTheme();
  setupModal();
  setupNewBtn();
  setupUpdater();
  setupSave();
  setupSettings();
  setupFeedback();
  setupAddItem();
  setupTutorial();
  setupDragAndDrop();

  // Auto-launch on first run (no tutorial seen and at least one semester exists).
  if (!hasTutorialBeenSeen()) {
    // Small delay so the UI is fully rendered before the overlay appears.
    setTimeout(() => startTutorial(), 300);
  }
}

// ---------------------------------------------------------------------------
// Auto-update banner (driven by the window.updater bridge)
// ---------------------------------------------------------------------------
function setupUpdater() {
  const overlay    = document.getElementById('update-overlay');
  const versionEl  = document.getElementById('update-dialog-version');
  const notesLoading = document.getElementById('update-notes-loading');
  const notesContent = document.getElementById('update-notes-content');
  const notesError   = document.getElementById('update-notes-error');
  const progressArea = document.getElementById('update-progress-area');
  const progressBar  = document.getElementById('update-progress-bar');
  const progressLabel = document.getElementById('update-progress-label');
  const laterBtn     = document.getElementById('update-later-btn');
  const actionBtn    = document.getElementById('update-action-btn');

  // The bridge is absent outside Electron (e.g. tests / browser preview).
  if (!window.updater) return;

  // ── State ────────────────────────────────────────────────────────────────
  // Tracks whether the download has completed so "Later" knows the update
  // will be applied on next manual restart anyway.
  let downloadComplete = false;

  // ── Helpers ──────────────────────────────────────────────────────────────
  function openUpdateDialog(version) {
    // Reset to initial state.
    downloadComplete = false;
    versionEl.textContent = version ? `v${version}` : '';
    notesLoading.classList.remove('hidden');
    notesContent.classList.add('hidden');
    notesError.classList.add('hidden');
    progressArea.classList.add('hidden');
    progressBar.style.width = '0%';
    progressLabel.textContent = '0%';
    actionBtn.textContent = 'Download & Install';
    actionBtn.disabled = false;
    laterBtn.disabled = false;
    overlay.classList.remove('hidden');

    // Fetch release notes from the GitHub API.
    if (version) {
      fetch(`https://api.github.com/repos/masprime77/lectio/releases/tags/v${version}`)
        .then((r) => {
          if (!r.ok) throw new Error('not ok');
          return r.json();
        })
        .then((data) => {
          const body = (data.body || '').trim();
          notesLoading.classList.add('hidden');
          if (body) {
            notesContent.textContent = body;
            notesContent.classList.remove('hidden');
          } else {
            notesError.textContent = 'No release notes provided.';
            notesError.classList.remove('hidden');
          }
        })
        .catch(() => {
          notesLoading.classList.add('hidden');
          notesError.classList.remove('hidden');
        });
    } else {
      notesLoading.classList.add('hidden');
      notesError.classList.remove('hidden');
    }
  }

  function closeUpdateDialog() {
    overlay.classList.add('hidden');
  }

  function showProgressBar() {
    progressArea.classList.remove('hidden');
    actionBtn.textContent = 'Downloading…';
    actionBtn.disabled = true;
    laterBtn.disabled = true;
  }

  function onDownloadComplete() {
    downloadComplete = true;
    progressBar.style.width = '100%';
    progressLabel.textContent = '100%';
    actionBtn.textContent = 'Install & Relaunch';
    actionBtn.disabled = false;
    laterBtn.disabled = false;
  }

  // ── Event listeners ──────────────────────────────────────────────────────
  laterBtn.addEventListener('click', closeUpdateDialog);

  // Close on backdrop click (same pattern as all other modals in this app).
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeUpdateDialog();
  });

  actionBtn.addEventListener('click', async () => {
    if (downloadComplete) {
      // Download already finished — install and relaunch.
      actionBtn.disabled = true;
      laterBtn.disabled = true;
      actionBtn.textContent = 'Restarting…';
      // Flush pending edits first: restart-and-update bypasses the
      // unsaved-changes prompt so the app can quit and swap cleanly.
      await saveNow();
      window.updater.restartAndUpdate();
    } else {
      // Start download manually (only reached when autoDownload is false).
      showProgressBar();
      window.updater.startDownload();
    }
  });

  // ── Bridge listeners ─────────────────────────────────────────────────────

  // update-available fires for both auto-download ON and OFF paths.
  // version is the new version string passed from main.js.
  window.updater.onUpdateAvailable((version) => {
    openUpdateDialog(version);
    // When autoDownload is ON, the download is already running in the
    // background at this point — show the progress bar immediately so the
    // user sees that something is happening.
    // When autoDownload is OFF, the progress bar stays hidden until the user
    // clicks "Download & Install".
    // We cannot know from the renderer which mode is active, so we rely on
    // the settings value already loaded by setupSettings(). Read it from the
    // toggle directly.
    const autoUpdateEnabled = document.getElementById('set-autoupdate')
      ? document.getElementById('set-autoupdate').checked
      : true; // safe default if settings haven't loaded yet
    if (autoUpdateEnabled) {
      showProgressBar();
    }
  });

  window.updater.onDownloadProgress((percent) => {
    // Ensure the progress area is visible (could arrive before onUpdateAvailable
    // finishes rendering in rare edge cases).
    if (progressArea.classList.contains('hidden')) showProgressBar();
    progressBar.style.width = `${percent}%`;
    progressLabel.textContent = `${percent}%`;
  });

  window.updater.onUpdateDownloaded(() => {
    onDownloadComplete();
  });

  window.updater.onError((message) => {
    // A failed download/install/relaunch must not look like a dead button:
    // show the reason and re-enable the controls so the user can retry or close.
    progressArea.classList.remove('hidden');
    progressLabel.textContent = `Update failed: ${message}`;
    actionBtn.textContent = downloadComplete ? 'Install & Relaunch' : 'Download & Install';
    actionBtn.disabled = false;
    laterBtn.disabled = false;
  });
}

// ---------------------------------------------------------------------------
// Theme: Light -> Dark -> Auto, persisted in localStorage
// ---------------------------------------------------------------------------
const THEME_MODES = ['light', 'dark', 'auto'];

function applyTheme(mode) {
  // Auto = no attribute, so the prefers-color-scheme media query takes over.
  if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('theme', mode);
  // Sync the segmented control if it exists (modal may not be open yet).
  document.querySelectorAll('.theme-seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.themeVal === mode);
  });
}

function setupTheme() {
  // Theme selection is handled inside setupSettings() / openSettingsModal().
  let mode = localStorage.getItem('theme');
  if (!THEME_MODES.includes(mode)) mode = 'auto';
  applyTheme(mode);
  // Note: the click listener is on the segmented control in the Settings modal.
}

// View toggle (Week / Course), persisted to localStorage.
function setupViewToggle() {
  document.querySelectorAll('.view-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.view = btn.dataset.view;
      writePref('lastActiveView', state.view);
      updateViewToggle();
      if (state.semester) renderPlanner();
    });
  });
  updateViewToggle();
}

function updateViewToggle() {
  document.querySelectorAll('.view-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === state.view);
  });
  document.getElementById('sort-select').value = state.sortOrder;
}

// Course sort control (Progress / Alpha / Week), persisted to localStorage.
function setupSort() {
  const sel = document.getElementById('sort-select');
  sel.value = state.sortOrder;
  sel.addEventListener('change', () => {
    state.sortOrder = sel.value;
    writePref('lastSortOrder', state.sortOrder);
    if (state.semester) {
      renderDashboard();
      renderPlanner();
    }
  });
}

// Study Mode toggle: a pure display/calculation overlay (no data changes),
// persisted to localStorage so it survives restarts.
function setupStudyMode() {
  const btn = document.getElementById('study-mode-btn');

  function updateBtn() {
    btn.textContent = 'Study Mode: ' + (state.studyMode ? 'On' : 'Off');
    btn.classList.toggle('study-mode-on', state.studyMode);
  }

  updateBtn();

  btn.addEventListener('click', () => {
    state.studyMode = !state.studyMode;
    writePref('studyMode', String(state.studyMode));
    updateBtn();
    if (state.semester) {
      renderDashboard();
      renderPlanner();
    }
  });
}

// Shown when there are no semester files left.
function renderEmptyState() {
  state.semesterId = null;
  state.semester = null;
  document.getElementById('dashboard').innerHTML =
    '<h2>No semesters yet</h2><div class="current-week">Create one with the “New Semester” button.</div>';
  document.getElementById('planner').innerHTML = '';
  setSemesterActionsEnabled(false);
}

function setSemesterActionsEnabled(enabled) {
  document.getElementById('edit-semester-btn').disabled = !enabled;
  document.getElementById('delete-semester-btn').disabled = !enabled;
}

async function deleteSemester(id) {
  const select = document.getElementById('semester-select');
  const opt = [...select.options].find((o) => o.value === id);
  const name = opt ? opt.textContent : id;
  if (!confirm(`Delete "${name}"? This permanently removes the file from /semesters/.`)) return;

  await api.remove(id);
  const list = await populateSelector();
  if (list.length) await loadSemester(list[0].id);
  else renderEmptyState();
}

// ---------------------------------------------------------------------------
// Semester export / import
// ---------------------------------------------------------------------------
async function exportSemester() {
  if (!state.semester) return;
  const sem = state.semester;
  const defaultName = (sem.name || sem.id).replace(/[^a-z0-9_-]/gi, '_') + '.lectio.json';
  const { canceled, filePath } = await window.planner.showSaveDialog({
    defaultName,
    title: 'Export Semester',
  });
  if (canceled) return;
  try {
    await window.planner.exportSemester({ filePath, semester: sem });
    showSaveStatus('Semester exported', 2000);
  } catch (err) {
    alert('Export failed: ' + (err.message || err));
  }
}

// parsedPayload is the already-parsed object returned by window.planner.importFile().
async function importSemester(parsedPayload) {
  if (!parsedPayload || parsedPayload._lectioType !== 'semester') {
    alert('This file is not a Lectio semester export.');
    return;
  }
  const sem = parsedPayload.semester;
  if (!sem || !sem.id || !Array.isArray(sem.courses)) {
    alert('The semester file appears corrupt or invalid.');
    return;
  }

  // Check for id conflict
  const existingList = await api.list();
  const hasConflict = existingList.some((s) => s.id === sem.id);

  // Show the import confirmation modal
  const overlay = document.getElementById('import-sem-overlay');
  document.getElementById('import-sem-info').textContent =
    `"${sem.name}" — ${sem.courses.length} course(s), ${sem.weeks} week(s)`;
  const conflictSection = document.getElementById('import-sem-conflict-section');
  conflictSection.classList.toggle('hidden', !hasConflict);

  overlay.classList.remove('hidden');

  // Wait for user confirmation or cancel
  await new Promise((resolve) => {
    document.getElementById('import-sem-cancel').onclick = () => {
      overlay.classList.add('hidden');
      resolve(false);
    };
    document.getElementById('import-sem-confirm').onclick = async () => {
      overlay.classList.add('hidden');

      const keepStatus = document.querySelector('input[name="import-sem-status"]:checked').value === 'keep';
      const conflictChoice = hasConflict
        ? document.querySelector('input[name="import-sem-conflict"]:checked').value
        : 'replace';

      // Deep clone to avoid mutating the parsed payload
      let toSave = JSON.parse(JSON.stringify(sem));

      // Reset statuses if requested (default status ids in the tag model).
      if (!keepStatus) {
        toSave.courses.forEach((c) => {
          (c.readings || []).forEach((r) => { r.status = 'r-pending'; });
          (c.tasks || []).forEach((t) => { t.status = 't-pending'; });
        });
      }

      // Resolve id conflict
      let targetId = toSave.id;
      if (hasConflict && conflictChoice === 'new') {
        const ids = new Set(existingList.map((s) => s.id));
        let base = slugify(toSave.name);
        let n = 2;
        targetId = base;
        while (ids.has(targetId)) targetId = `${base}-${n++}`;
        toSave.id = targetId;
      }

      try {
        await api.save(targetId, toSave);
        await populateSelector();
        await loadSemester(targetId);
        showSaveStatus('Semester imported', 2000);
      } catch (err) {
        alert('Import failed: ' + (err.message || err));
      }
      resolve(true);
    };
  });
}

// ---------------------------------------------------------------------------
// Course export / import
// ---------------------------------------------------------------------------
async function exportCourse(course) {
  const defaultName = (course.name || course.id).replace(/[^a-z0-9_-]/gi, '_') + '.lectio.json';
  const { canceled, filePath } = await window.planner.showSaveDialog({
    defaultName,
    title: 'Export Course',
  });
  if (canceled) return;

  // Export only the fields that belong to the course schema (no tags).
  const clean = {
    id: course.id,
    name: course.name,
    color: course.color,
    readings: course.readings.map(({ id, week, title, status }) => ({ id, week, title, status })),
    tasks: course.tasks.map(({ id, week, title, dueDate, status }) => ({ id, week, title, dueDate, status })),
  };

  try {
    await window.planner.exportCourse({ filePath, course: clean });
    showSaveStatus('Course exported', 2000);
  } catch (err) {
    alert('Export failed: ' + (err.message || err));
  }
}

// parsedPayload is the already-parsed object returned by window.planner.importFile().
async function importCourse(parsedPayload) {
  if (!parsedPayload || parsedPayload._lectioType !== 'course') {
    alert('This file is not a Lectio course export.');
    return;
  }
  if (!state.semester) {
    alert('No semester is currently open. Open or create a semester first.');
    return;
  }

  const incoming = parsedPayload.course;
  if (!incoming || !incoming.name) {
    alert('The course file appears corrupt or invalid.');
    return;
  }

  // Always assign a fresh id to avoid collisions within the current semester.
  const newCourse = {
    id: uid('course'),
    name: incoming.name,
    color: incoming.color || '#4A90D9',
    readings: (incoming.readings || []).map((r) => ({ ...r, id: uid('r') })),
    tasks: (incoming.tasks || []).map((t) => ({ ...t, id: uid('t') })),
  };

  state.semester.courses.push(newCourse);
  persist();
  render();
  showSaveStatus(`Course "${newCourse.name}" imported`, 2000);
}

// Import a course from the New/Edit modal's Courses tab. Works in both modes:
// in edit mode it adds the course to the live semester; in create mode it adds
// a draft course row so the course (with its readings/tasks) is saved on submit.
async function importCourseFromModal() {
  const { canceled, filePath } = await window.planner.showOpenDialog({
    title: 'Import Course',
  });
  if (canceled) return;

  let payload;
  try {
    payload = await window.planner.importFile({ filePath });
  } catch (err) {
    alert('Could not read file: ' + (err.message || err));
    return;
  }

  if (!payload || payload._lectioType !== 'course' || !payload.course || !payload.course.name) {
    alert('This file is not a valid Lectio course export.');
    return;
  }

  const incoming = payload.course;
  // Fresh ids so the course never collides with existing ones.
  const newCourse = {
    id: uid('course'),
    name: incoming.name,
    color: incoming.color || '#4A90D9',
    readings: (incoming.readings || []).map((r) => ({ ...r, id: uid('r') })),
    tasks: (incoming.tasks || []).map((t) => ({ ...t, id: uid('t') })),
  };

  if (state.editingId) {
    // Edit mode: add to the live semester and refresh the modal's course rows.
    state.semester.courses.push(newCourse);
    persist();
    render();
    const courses = document.getElementById('ns-courses');
    courses.innerHTML = '';
    state.semester.courses.forEach((c) => addCourseField(c));
  } else {
    // Create mode: stash the full course in the draft (so submitModal can keep
    // its readings/tasks) and add a matching row to the modal.
    if (!state.editingSemester.courses) state.editingSemester.courses = [];
    state.editingSemester.courses.push(newCourse);
    addCourseField(newCourse);
  }
  showSaveStatus(`Course "${newCourse.name}" imported`, 2000);
}

// Accept .lectio.json files dropped anywhere on the window (semester or course).
function setupDragAndDrop() {
  document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  document.body.addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    // Electron exposes the real fs path on File objects in the renderer.
    const filePath = file.path;
    if (!filePath || !filePath.endsWith('.lectio.json')) {
      alert('Only .lectio.json files can be dropped here.');
      return;
    }
    try {
      const payload = await window.planner.importFile({ filePath });
      if (payload._lectioType === 'semester') {
        await importSemester(payload);
      } else if (payload._lectioType === 'course') {
        await importCourse(payload);
      } else {
        alert('Unrecognised Lectio file type.');
      }
    } catch (err) {
      alert('Could not read file: ' + (err.message || err));
    }
  });
}

// ---------------------------------------------------------------------------
// New semester modal
// ---------------------------------------------------------------------------
const DEFAULT_COLORS = ['#4A90D9', '#E2725B', '#7E57C2', '#5CB85C', '#F0AD4E', '#5BC0DE'];

function setupModal() {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('ns-add-course').addEventListener('click', () => addCourseField());

  // Footer Import is tab-aware: on the Courses tab it imports a course into the
  // semester being built/edited; on the Semester tab it imports a full semester.
  document.getElementById('modal-import-btn').addEventListener('click', async () => {
    const activeTab = document.querySelector('.modal-tab.active');
    if (activeTab && activeTab.dataset.tab === 'courses') {
      await importCourseFromModal();
      return;
    }
    closeModal();
    const { canceled, filePath } = await window.planner.showOpenDialog({
      title: 'Import Semester',
    });
    if (canceled) return;
    try {
      const payload = await window.planner.importFile({ filePath });
      await importSemester(payload);
    } catch (err) {
      alert('Could not read file: ' + (err.message || err));
    }
  });

  document.getElementById('modal-export-btn').addEventListener('click', () => {
    // Export the semester that is currently being edited. We close the modal
    // first so the save dialog isn't layered on top of it.
    closeModal();
    exportSemester();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.getElementById('new-semester-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitModal();
  });

  // Tab switching between Semester / Courses / Tags panels.
  document.querySelectorAll('.modal-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.modal-tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.modal-tab-panel').forEach((p) => p.classList.add('hidden'));
      tab.classList.add('active');
      document
        .querySelector(`.modal-tab-panel[data-panel="${tab.dataset.tab}"]`)
        .classList.remove('hidden');
      if (tab.dataset.tab === 'tags' && state.editingSemester) {
        renderTagsEditor(state.editingSemester);
      }
      updateModalFooter();
    });
  });
}

// Show/hide the footer Import & Export buttons based on the active tab and mode.
// Import shows on the Semester tab (semester import) and Courses tab (course
// import), in both create and edit modes. Export only appears on the Semester
// tab in edit mode. The Tags tab shows neither — tags can't be im/exported yet.
function updateModalFooter() {
  const activeTab = document.querySelector('.modal-tab.active');
  const tab = activeTab ? activeTab.dataset.tab : 'semester';
  const isEdit = !!state.editingId;
  document
    .getElementById('modal-import-btn')
    .classList.toggle('hidden', tab === 'tags');
  document
    .getElementById('modal-export-btn')
    .classList.toggle('hidden', !(tab === 'semester' && isEdit));
}

// The header "＋ New" button opens the semester-creation modal directly.
function setupNewBtn() {
  const btn = document.getElementById('new-btn');
  btn.innerHTML = icon('plus') + '<span>New</span>';
  btn.addEventListener('click', () => openCreateModal());
}

// Reset the modal to its first (Semester) tab — used whenever it opens.
function resetModalToFirstTab() {
  document.querySelectorAll('.modal-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  document.querySelectorAll('.modal-tab-panel').forEach((p, i) => p.classList.toggle('hidden', i !== 0));
}

// Activate a specific tab by its data-tab value ('semester' | 'courses' | 'tags').
// Falls back to the first tab if the value is not found.
function activateModalTab(tabName) {
  const tabs   = document.querySelectorAll('.modal-tab');
  const panels = document.querySelectorAll('.modal-tab-panel');
  let activated = false;
  tabs.forEach((tab, i) => {
    const match = tab.dataset.tab === tabName;
    tab.classList.toggle('active', match);
    panels[i].classList.toggle('hidden', !match);
    if (match) activated = true;
  });
  // Fallback: activate the first tab if tabName was not found.
  if (!activated) {
    tabs[0].classList.add('active');
    panels[0].classList.remove('hidden');
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// Open the modal in "create" mode (blank form, one empty course row).
function openCreateModal() {
  state.editingId = null;
  document.getElementById('modal-title').textContent = 'New';
  document.getElementById('modal-submit').textContent = 'Create';
  const form = document.getElementById('new-semester-form');
  form.reset();
  document.getElementById('ns-weeks').value = 15;
  document.getElementById('ns-courses').innerHTML = '';
  addCourseField();
  // Draft tag sets (independent clones of the defaults) the Tags tab edits;
  // they become the new semester's tags on create.
  state.editingSemester = {
    readingTags: JSON.parse(JSON.stringify(getReadingTags({}))),
    taskTags: JSON.parse(JSON.stringify(getTaskTags({}))),
    courses: [],
  };
  renderTagsEditor(state.editingSemester);
  resetModalToFirstTab();
  document.getElementById('modal-overlay').classList.remove('hidden');
  updateModalFooter();
}

// "+ Add course": open the existing semester editor with a fresh, focused
// course row so the user can add one course to the current semester. Reuses the
// same flow as the New Semester modal (existing courses keep their data on save).
async function openAddCourse() {
  if (!state.semesterId) return;
  await openEditModal(state.semesterId, 'courses');
  // openEditModal leaves at least one (blank) row; only append an extra blank
  // when courses already exist, so we always end on a single fresh, focused row.
  if (state.semester && state.semester.courses.length > 0) addCourseField();
  const rows = document.querySelectorAll('#ns-courses .ns-course-row');
  const last = rows[rows.length - 1];
  if (last) last.querySelector('.ns-course-name').focus();
}

// Open the modal in "edit" mode, pre-filled with the semester's current data.
async function openEditModal(id, startTab = 'semester') {
  const sem =
    id === state.semesterId && state.semester ? state.semester : await api.load(id);
  state.editingId = id;
  document.getElementById('modal-title').textContent = 'Edit Semester';
  document.getElementById('modal-submit').textContent = 'Save';
  document.getElementById('ns-name').value = sem.name;
  document.getElementById('ns-start').value = sem.startDate;
  document.getElementById('ns-weeks').value = sem.weeks;
  const courses = document.getElementById('ns-courses');
  courses.innerHTML = '';
  if (sem.courses.length) sem.courses.forEach((c) => addCourseField(c));
  else addCourseField();
  // The Tags tab edits this semester object live (persisted on each change).
  state.editingSemester = sem;
  renderTagsEditor(sem);
  activateModalTab(startTab);
  document.getElementById('modal-overlay').classList.remove('hidden');
  updateModalFooter();
}

// `course` is optional; when given, the row is pre-filled and remembers its id
// so its readings/tasks can be preserved on save.
function addCourseField(course) {
  const container = document.getElementById('ns-courses');
  const idx = container.children.length;
  const row = document.createElement('div');
  row.className = 'ns-course-row';
  if (course && course.id) row.dataset.courseId = course.id;

  const name = document.createElement('input');
  name.type = 'text';
  name.placeholder = 'Course name';
  name.className = 'ns-course-name';
  if (course) name.value = course.name;

  const color = document.createElement('input');
  color.type = 'color';
  color.value = course ? course.color : DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
  color.className = 'ns-course-color';

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'icon-btn';
  remove.innerHTML = icon('x');
  remove.title = 'Remove course';
  remove.addEventListener('click', () => row.remove());

  row.appendChild(name);
  row.appendChild(color);
  row.appendChild(remove);
  container.appendChild(row);
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'semester';
}

// Handle the modal form for both create and edit.
async function submitModal() {
  const name = document.getElementById('ns-name').value.trim();
  const startDate = document.getElementById('ns-start').value;
  const weeks = parseInt(document.getElementById('ns-weeks').value, 10) || 15;
  const rows = [...document.querySelectorAll('#ns-courses .ns-course-row')];

  if (state.editingId) {
    // Editing: preserve each existing course's readings/tasks.
    const base =
      state.editingId === state.semesterId && state.semester
        ? state.semester
        : await api.load(state.editingId);
    const byId = new Map(base.courses.map((c) => [c.id, c]));

    const courses = [];
    rows.forEach((row) => {
      const cname = row.querySelector('.ns-course-name').value.trim();
      if (!cname) return;
      const color = row.querySelector('.ns-course-color').value;
      const existing = byId.get(row.dataset.courseId);
      if (existing) courses.push({ ...existing, name: cname, color });
      else courses.push({ id: uid('course'), name: cname, color, readings: [], tasks: [] });
    });

    const semester = {
      id: state.editingId,
      name,
      startDate,
      weeks,
      courses,
      readingTags: getReadingTags(base),
      taskTags: getTaskTags(base),
    };
    await api.save(state.editingId, semester);
    closeModal();
    await populateSelector();
    await loadSemester(state.editingId);
    return;
  }

  // Creating: build a fresh semester with a unique id derived from the name.
  // Imported courses live in the draft (state.editingSemester.courses) keyed by
  // their row's courseId, so we can keep their readings/tasks; typed-in rows
  // start empty.
  const draftById = new Map(
    (state.editingSemester && state.editingSemester.courses
      ? state.editingSemester.courses
      : []
    ).map((c) => [c.id, c])
  );
  const courses = [];
  rows.forEach((row) => {
    const cname = row.querySelector('.ns-course-name').value.trim();
    if (!cname) return;
    const color = row.querySelector('.ns-course-color').value;
    const drafted = draftById.get(row.dataset.courseId);
    if (drafted) courses.push({ ...drafted, name: cname, color });
    else courses.push({ id: uid('course'), name: cname, color, readings: [], tasks: [] });
  });

  const existing = await api.list();
  const ids = new Set(existing.map((s) => s.id));
  let id = slugify(name);
  let n = 2;
  while (ids.has(id)) id = `${slugify(name)}-${n++}`;

  const draft = state.editingSemester || {};
  const semester = {
    id,
    name,
    startDate,
    weeks,
    courses,
    readingTags: getReadingTags(draft),
    taskTags: getTaskTags(draft),
  };
  await api.save(id, semester);
  closeModal();
  await populateSelector();
  await loadSemester(id);
}

// ---------------------------------------------------------------------------
// Tags tab: per-semester reading/task tag management (add, rename, recolor,
// delete, reorder). Protected tags (pending/studied) lock their name, deletion
// and position. Edits mutate the semester object and persist immediately.
// ---------------------------------------------------------------------------
function renderTagsEditor(semester) {
  ['reading', 'task'].forEach((type) => {
    const tags = type === 'reading' ? getReadingTags(semester) : getTaskTags(semester);
    ['pending', 'done'].forEach((section) => {
      const listId = type + '-tags-' + section + '-list';
      const list = document.getElementById(listId);
      if (!list) return;
      list.innerHTML = '';
      tags
        .filter((t) => t.section === section)
        .forEach((tag) => list.appendChild(buildTagRow(semester, type, tag)));
      setupTagDragDrop(list, semester, type);
    });
  });
  wireAddTagButtons(semester);
}

function buildTagRow(semester, type, tag) {
  const li = document.createElement('li');
  li.className = 'tag-row';
  li.dataset.tagId = tag.id;

  const isProtected = isProtectedTag(tag.id);

  // Drag handle — disabled (non-draggable) for protected tags.
  const handle = document.createElement('span');
  handle.className = 'tag-drag-handle' + (isProtected ? ' tag-drag-handle--locked' : '');
  handle.innerHTML = '⠿';
  handle.title = isProtected ? 'Protected tag — cannot be reordered' : 'Drag to reorder';

  // Color picker.
  const colorPicker = document.createElement('input');
  colorPicker.type = 'color';
  colorPicker.value = tag.color;
  colorPicker.addEventListener('change', () => {
    editTag(semester, type, tag.id, { color: colorPicker.value });
    persist();
  });

  // Name input — disabled for protected tags.
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = tag.name;
  nameInput.className = 'tag-name-input';
  if (isProtected) {
    nameInput.disabled = true;
    nameInput.title = 'This tag cannot be renamed';
  } else {
    nameInput.addEventListener('blur', () => {
      const v = nameInput.value.trim();
      if (v) editTag(semester, type, tag.id, { name: v });
      persist();
    });
  }

  // Delete button — disabled for protected tags.
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'icon-btn';
  delBtn.innerHTML = icon('x');
  delBtn.title = isProtected ? 'Protected tag — cannot be deleted' : 'Delete tag';
  delBtn.disabled = isProtected;
  if (isProtected) {
    delBtn.style.opacity = '0.3';
  } else {
    delBtn.addEventListener('click', () => {
      deleteTag(semester, type, tag.id);
      persist();
      renderTagsEditor(semester);
    });
  }

  li.appendChild(handle);
  li.appendChild(colorPicker);
  li.appendChild(nameInput);
  li.appendChild(delBtn);
  return li;
}

function setupTagDragDrop(list, semester, type) {
  let dragSrc = null;

  list.addEventListener('dragstart', (e) => {
    const li = e.target.closest('li');
    if (!li || isProtectedTag(li.dataset.tagId)) {
      e.preventDefault();
      return;
    }
    dragSrc = li;
    dragSrc.classList.add('dragging');
  });

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    const target = e.target.closest('li');
    if (!target || target === dragSrc) return;
    // Cannot drop onto or past a protected tag.
    if (isProtectedTag(target.dataset.tagId)) return;
    const rect = target.getBoundingClientRect();
    if (e.clientY < rect.top + rect.height / 2) list.insertBefore(dragSrc, target);
    else list.insertBefore(dragSrc, target.nextSibling);
  });

  list.addEventListener('dragend', () => {
    if (dragSrc) dragSrc.classList.remove('dragging');
    dragSrc = null;
    // Collect ordered ids from ALL lists for this type, then reorder.
    const allLists = document.querySelectorAll('[id^="' + type + '-tags-"][id$="-list"]');
    const orderedIds = [...allLists].flatMap((l) =>
      [...l.querySelectorAll('li')].map((li) => li.dataset.tagId)
    );
    reorderTags(semester, type, orderedIds);
    persist();
  });

  // Only non-protected rows are draggable.
  list.querySelectorAll('li').forEach((li) => {
    li.draggable = !isProtectedTag(li.dataset.tagId);
  });
}

function wireAddTagButtons(semester) {
  [
    { btnId: 'add-reading-pending-tag', type: 'reading', section: 'pending' },
    { btnId: 'add-reading-done-tag', type: 'reading', section: 'done' },
    { btnId: 'add-task-pending-tag', type: 'task', section: 'pending' },
    { btnId: 'add-task-done-tag', type: 'task', section: 'done' },
  ].forEach(({ btnId, type, section }) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    // Clone to drop any previous listener bound to a stale semester object.
    btn.replaceWith(btn.cloneNode(true));
    document.getElementById(btnId).addEventListener('click', () => {
      const name = prompt('Tag name:');
      if (!name || !name.trim()) return;
      const color = section === 'pending' ? '#f97316' : '#3b82f6';
      addTag(semester, type, { name: name.trim(), color, section });
      persist();
      renderTagsEditor(semester);
    });
  });
}

// ---------------------------------------------------------------------------
// Settings modal: autosave (localStorage), auto-update (settings.json), version
// ---------------------------------------------------------------------------
function setupSettings() {
  const btn = document.getElementById('settings-btn');
  btn.innerHTML = icon('settings');
  btn.addEventListener('click', openSettingsModal);

  const overlay = document.getElementById('settings-overlay');
  const close = document.getElementById('settings-close');
  close.innerHTML = icon('x');
  close.addEventListener('click', closeSettingsModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSettingsModal();
  });

  // Autosave preference lives in localStorage.
  document.getElementById('set-autosave').addEventListener('change', (e) => {
    writePref('autosave', e.target.checked ? 'true' : 'false');
  });

  // Theme segmented control (Light / Dark / Auto).
  document.querySelectorAll('.theme-seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.themeVal);
    });
  });

  // Auto-update preference lives in settings.json (read by main on launch).
  document.getElementById('set-autoupdate').addEventListener('change', async (e) => {
    if (!window.settings) return;
    const current = (await window.settings.get()) || {};
    current.autoUpdate = e.target.checked;
    await window.settings.save(current);
  });

  // Open via the menu item / Cmd+, accelerator (forwarded from main)…
  if (window.settings && window.settings.onOpen) {
    window.settings.onOpen(() => openSettingsModal());
  }
  // …and a direct keydown fallback (same pattern as ⌘S).
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      openSettingsModal();
    }
  });
}

function closeSettingsModal() {
  document.getElementById('settings-overlay').classList.add('hidden');
}

async function openSettingsModal() {
  document.getElementById('set-autosave').checked = isAutosaveEnabled();

  let autoUpdate = true;
  if (window.settings) {
    const s = (await window.settings.get()) || {};
    autoUpdate = s.autoUpdate !== false;
  }
  document.getElementById('set-autoupdate').checked = autoUpdate;

  // Sync theme segmented control
  const currentTheme = localStorage.getItem('theme') || 'auto';
  document.querySelectorAll('.theme-seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.themeVal === currentTheme);
  });

  let version = '';
  if (window.appInfo) {
    try {
      version = await window.appInfo.getVersion();
    } catch (e) {
      /* leave blank on failure */
    }
  }
  document.getElementById('set-version').textContent = version || '—';

  // Tutorial button: closes settings and starts the tour.
  const tutorialBtn = document.getElementById('set-tutorial-btn');
  if (tutorialBtn) {
    // Re-attach listener each open to avoid duplicates (remove old first).
    const fresh = tutorialBtn.cloneNode(true);
    tutorialBtn.replaceWith(fresh);
    fresh.addEventListener('click', () => {
      closeSettingsModal();
      startTutorial();
    });
  }

  document.getElementById('settings-overlay').classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// Feedback: the user fills in a title + description inside the app, then we
// POST it directly to a Vercel serverless endpoint (which files a GitHub issue
// on our behalf) — the user never leaves the app and needs no GitHub account.
// The current app version is sent along so issues are tagged with a build.
// ---------------------------------------------------------------------------
const FEEDBACK_ENDPOINT = 'https://lectio-opal.vercel.app/api/feedback';

let feedbackKind = 'bug';
let feedbackVersion = '';

async function submitFeedback(kind, title, body, version) {
  const res = await fetch(FEEDBACK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: kind, title, body, version }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Unknown error');
  return data; // { ok: true, url: '...' }
}

function setFeedbackKind(kind) {
  feedbackKind = kind;
  document.getElementById('feedback-type-bug').classList.toggle('active', kind === 'bug');
  document.getElementById('feedback-type-feature').classList.toggle('active', kind === 'feature');
}

function setupFeedback() {
  const btn = document.getElementById('feedback-btn');
  btn.innerHTML = icon('help');
  btn.addEventListener('click', openFeedbackModal);

  const overlay = document.getElementById('feedback-overlay');
  const close = document.getElementById('feedback-close');
  close.innerHTML = icon('x');
  close.addEventListener('click', closeFeedbackModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeFeedbackModal();
  });

  document
    .getElementById('feedback-type-bug')
    .addEventListener('click', () => setFeedbackKind('bug'));
  document
    .getElementById('feedback-type-feature')
    .addEventListener('click', () => setFeedbackKind('feature'));

  document.getElementById('feedback-cancel').addEventListener('click', closeFeedbackModal);

  document.getElementById('feedback-submit').addEventListener('click', async () => {
    const title = document.getElementById('feedback-input-title').value.trim();
    const body = document.getElementById('feedback-input-body').value.trim();
    const error = document.getElementById('feedback-error');

    if (!title || !body) {
      error.classList.remove('hidden');
      return;
    }
    error.classList.add('hidden');

    const submitBtn = document.getElementById('feedback-submit');
    const cancelBtn = document.getElementById('feedback-cancel');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    cancelBtn.disabled = true;

    try {
      await submitFeedback(feedbackKind, title, body, feedbackVersion);
      // Show success state: hide the form and the action buttons, leaving only
      // the X close button.
      document.getElementById('feedback-form-body').classList.add('hidden');
      document.getElementById('feedback-actions').classList.add('hidden');
      document.getElementById('feedback-success').classList.remove('hidden');
    } catch (err) {
      error.textContent = 'Could not send feedback. Please try again.';
      error.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send';
      cancelBtn.disabled = false;
    }
  });
}

function closeFeedbackModal() {
  document.getElementById('feedback-overlay').classList.add('hidden');
  document.getElementById('feedback-input-title').value = '';
  document.getElementById('feedback-input-body').value = '';
  document.getElementById('feedback-error').classList.add('hidden');
  document.getElementById('feedback-error').textContent = 'Title and description are required.';
  document.getElementById('feedback-form-body').classList.remove('hidden');
  document.getElementById('feedback-actions').classList.remove('hidden');
  document.getElementById('feedback-success').classList.add('hidden');
  const submitBtn = document.getElementById('feedback-submit');
  submitBtn.disabled = false;
  submitBtn.textContent = 'Send';
  document.getElementById('feedback-cancel').disabled = false;
  setFeedbackKind('bug');
}

async function openFeedbackModal() {
  feedbackVersion = '';
  if (window.appInfo) {
    try {
      feedbackVersion = await window.appInfo.getVersion();
    } catch (e) {
      /* leave blank on failure */
    }
  }
  document.getElementById('feedback-version').textContent = feedbackVersion
    ? `v${feedbackVersion}`
    : '—';

  document.getElementById('feedback-overlay').classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// Global "Add reading / task" modal: add an item to any course/week of the
// current semester without going through a specific course column or week card.
// ---------------------------------------------------------------------------
// Selected type in the global add modal; module-scoped so openAddItemModal can
// reset it in lockstep with the toggle buttons' visual state.
let addItemType = 'reading';

function setAddItemType(t) {
  addItemType = t;
  document.getElementById('add-item-type-reading').classList.toggle('active', t === 'reading');
  document.getElementById('add-item-type-task').classList.toggle('active', t === 'task');
  document.getElementById('add-item-due-row').style.display = t === 'task' ? 'block' : 'none';
}

function setupAddItem() {
  document.getElementById('add-item-close').addEventListener('click', closeAddItemModal);
  document.getElementById('add-item-cancel').addEventListener('click', closeAddItemModal);
  document.getElementById('add-item-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('add-item-overlay')) closeAddItemModal();
  });

  // Type toggle (Reading / Task) — Task reveals the due-date field.
  document.getElementById('add-item-type-reading').addEventListener('click', () => setAddItemType('reading'));
  document.getElementById('add-item-type-task').addEventListener('click', () => setAddItemType('task'));

  document.getElementById('add-item-submit').addEventListener('click', () => {
    const titleVal = document.getElementById('add-item-title-input').value.trim();
    const courseId = document.getElementById('add-item-course').value;
    const week = parseInt(document.getElementById('add-item-week').value, 10);
    const errorEl = document.getElementById('add-item-error');

    if (!titleVal || !courseId) {
      errorEl.textContent = 'Title and course are required.';
      errorEl.classList.remove('hidden');
      return;
    }
    errorEl.classList.add('hidden');

    const course = state.semester.courses.find((c) => c.id === courseId);
    if (!course) return;

    if (addItemType === 'reading') {
      course.readings.push({ id: uid('r'), week, title: titleVal, status: 'r-pending' });
    } else {
      course.tasks.push({
        id: uid('t'),
        week,
        title: titleVal,
        dueDate: document.getElementById('add-item-due').value || '',
        status: 't-pending',
      });
    }

    persist();
    closeAddItemModal();
    renderDashboard();
    renderPlanner();
  });
}

function openAddItemModal() {
  const sem = state.semester;
  if (!sem) return;

  // Populate course select.
  const courseSelect = document.getElementById('add-item-course');
  courseSelect.innerHTML = sem.courses
    .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
    .join('');

  // Populate week select, defaulting to the current week.
  const weekSelect = document.getElementById('add-item-week');
  weekSelect.innerHTML = '';
  for (let w = 1; w <= sem.weeks; w++) {
    const opt = document.createElement('option');
    opt.value = w;
    opt.textContent = 'Week ' + w;
    weekSelect.appendChild(opt);
  }
  const cw = currentWeek(sem);
  weekSelect.value = cw || 1;

  // Reset the form back to its default (Reading) state.
  document.getElementById('add-item-title-input').value = '';
  document.getElementById('add-item-due').value = '';
  document.getElementById('add-item-error').classList.add('hidden');
  setAddItemType('reading');

  document.getElementById('add-item-overlay').classList.remove('hidden');
  document.getElementById('add-item-title-input').focus();
}

function closeAddItemModal() {
  document.getElementById('add-item-overlay').classList.add('hidden');
}

init();
