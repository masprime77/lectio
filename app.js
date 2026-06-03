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
  view: restoreView(), // 'week' | 'course' — restored from last session
  focusedCourseId: null, // null = normal All Courses layout; course id = focused mode
  sortOrder: restoreSort(), // course sort order — restored from last session
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

// Shared pure logic, loaded from lib/planner-core.js before this script.
const {
  getReadingTags, getTaskTags,
  isProtectedTag, addTag, deleteTag, editTag, reorderTags,
  courseProgress, uid,
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
  document.getElementById('add-item-btn').classList.remove('hidden');
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
    return copy.sort((a, b) => courseProgress(a, state.semester) - courseProgress(b, state.semester));
  if (state.sortOrder === 'progress-desc')
    return copy.sort((a, b) => courseProgress(b, state.semester) - courseProgress(a, state.semester));
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

// ---------------------------------------------------------------------------
// Dashboard: per-course progress + current week indicator
// (courseProgress comes from lib/planner-core.js)
// ---------------------------------------------------------------------------
function renderDashboard() {
  const sem = state.semester;
  const root = document.getElementById('dashboard');
  const cw = currentWeek(sem);

  const heading = `<h2>${sem.name}</h2>`;
  const weekLine = cw
    ? `<div class="current-week">Current week: <strong>Week ${cw}</strong> of ${sem.weeks}</div>`
    : `<div class="current-week">Semester not currently in session (${sem.weeks} weeks total)</div>`;

  let bars = '';
  if (sem.courses.length === 0) {
    bars = '<div class="week-empty">No courses yet.</div>';
  } else {
    sortedCourses(sem.courses).forEach((course) => {
      const pct = courseProgress(course, sem);
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
    header.textContent = course.name;
    header.title = course.name;
    header.style.color = course.color;
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

    if (type === 'task' && item.dueDate) {
      const due = document.createElement('span');
      due.className = 'item-due';
      due.textContent = 'due ' + item.dueDate;
      li.appendChild(due);
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
async function init() {
  // Icon buttons in the header
  document.getElementById('edit-semester-btn').innerHTML = icon('pencil');
  document.getElementById('delete-semester-btn').innerHTML = icon('trash');

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
  setupTheme();
  setupModal();
  setupUpdater();
  setupSave();
  setupSettings();
  setupFeedback();
  setupAddItem();
}

// ---------------------------------------------------------------------------
// Auto-update banner (driven by the window.updater bridge)
// ---------------------------------------------------------------------------
function setupUpdater() {
  const banner = document.getElementById('update-banner');
  const text = document.getElementById('update-banner-text');
  const restartBtn = document.getElementById('update-restart-btn');
  const dismissBtn = document.getElementById('update-dismiss-btn');

  dismissBtn.innerHTML = icon('x');
  dismissBtn.addEventListener('click', () => banner.classList.add('hidden'));

  // The bridge is absent outside Electron (e.g. tests) — fail safe.
  if (!window.updater) return;

  restartBtn.addEventListener('click', () => window.updater.restartAndUpdate());

  window.updater.onUpdateAvailable(() => {
    text.textContent = 'A new version is available, downloading…';
    restartBtn.classList.add('hidden');
    banner.classList.remove('hidden');
  });

  window.updater.onUpdateDownloaded(() => {
    text.textContent = 'Update downloaded and ready.';
    restartBtn.classList.remove('hidden');
    banner.classList.remove('hidden');
  });
}

// ---------------------------------------------------------------------------
// Theme: Light -> Dark -> Auto, persisted in localStorage
// ---------------------------------------------------------------------------
const THEME_MODES = ['light', 'dark', 'auto'];
const THEME_META = {
  light: { icon: 'sun', label: 'Light' },
  dark: { icon: 'moon', label: 'Dark' },
  auto: { icon: 'device-desktop', label: 'Auto' },
};

function applyTheme(mode) {
  // Auto = no attribute, so the prefers-color-scheme media query takes over.
  if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('theme', mode);

  const meta = THEME_META[mode];
  const btn = document.getElementById('theme-toggle');
  btn.querySelector('.theme-icon').innerHTML = icon(meta.icon);
  btn.querySelector('.theme-label').textContent = meta.label;
  btn.title = `Theme: ${meta.label} (click to change)`;
}

function setupTheme() {
  let mode = localStorage.getItem('theme');
  if (!THEME_MODES.includes(mode)) mode = 'auto'; // default on first load
  applyTheme(mode);

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const current = localStorage.getItem('theme') || 'auto';
    const next = THEME_MODES[(THEME_MODES.indexOf(current) + 1) % THEME_MODES.length];
    applyTheme(next);
  });
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

// Shown when there are no semester files left.
function renderEmptyState() {
  state.semesterId = null;
  state.semester = null;
  document.getElementById('dashboard').innerHTML =
    '<h2>No semesters yet</h2><div class="current-week">Create one with the “New Semester” button.</div>';
  document.getElementById('planner').innerHTML = '';
  setSemesterActionsEnabled(false);
  document.getElementById('add-item-btn').classList.add('hidden');
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
// New semester modal
// ---------------------------------------------------------------------------
const DEFAULT_COLORS = ['#4A90D9', '#E2725B', '#7E57C2', '#5CB85C', '#F0AD4E', '#5BC0DE'];

function setupModal() {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('new-semester-btn').addEventListener('click', openCreateModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('ns-add-course').addEventListener('click', () => addCourseField());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.getElementById('new-semester-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitModal();
  });
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// Open the modal in "create" mode (blank form, one empty course row).
function openCreateModal() {
  state.editingId = null;
  document.getElementById('modal-title').textContent = 'Create New Semester';
  document.getElementById('modal-submit').textContent = 'Create';
  const form = document.getElementById('new-semester-form');
  form.reset();
  document.getElementById('ns-weeks').value = 15;
  document.getElementById('ns-courses').innerHTML = '';
  addCourseField();
  document.getElementById('modal-overlay').classList.remove('hidden');
}

// "+ Add course": open the existing semester editor with a fresh, focused
// course row so the user can add one course to the current semester. Reuses the
// same flow as the New Semester modal (existing courses keep their data on save).
async function openAddCourse() {
  if (!state.semesterId) return;
  await openEditModal(state.semesterId);
  // openEditModal leaves at least one (blank) row; only append an extra blank
  // when courses already exist, so we always end on a single fresh, focused row.
  if (state.semester && state.semester.courses.length > 0) addCourseField();
  const rows = document.querySelectorAll('#ns-courses .ns-course-row');
  const last = rows[rows.length - 1];
  if (last) last.querySelector('.ns-course-name').focus();
}

// Open the modal in "edit" mode, pre-filled with the semester's current data.
async function openEditModal(id) {
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
  document.getElementById('modal-overlay').classList.remove('hidden');
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

    const semester = { id: state.editingId, name, startDate, weeks, courses };
    await api.save(state.editingId, semester);
    closeModal();
    await populateSelector();
    await loadSemester(state.editingId);
    return;
  }

  // Creating: build a fresh semester with a unique id derived from the name.
  const courses = [];
  rows.forEach((row) => {
    const cname = row.querySelector('.ns-course-name').value.trim();
    if (!cname) return;
    courses.push({
      id: uid('course'),
      name: cname,
      color: row.querySelector('.ns-course-color').value,
      readings: [],
      tasks: [],
    });
  });

  const existing = await api.list();
  const ids = new Set(existing.map((s) => s.id));
  let id = slugify(name);
  let n = 2;
  while (ids.has(id)) id = `${slugify(name)}-${n++}`;

  const semester = { id, name, startDate, weeks, courses };
  await api.save(id, semester);
  closeModal();
  await populateSelector();
  await loadSemester(id);
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

  let version = '';
  if (window.appInfo) {
    try {
      version = await window.appInfo.getVersion();
    } catch (e) {
      /* leave blank on failure */
    }
  }
  document.getElementById('set-version').textContent = version || '—';

  document.getElementById('settings-overlay').classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// Feedback: the user fills in a title + description inside the app, then we
// open a pre-filled GitHub new-issue page in the default browser via the
// window.externalLinks bridge (main restricts to github.com) — they only need
// to click "Submit new issue" there. The repo's issue templates live in
// .github/ISSUE_TEMPLATE. The current app version is appended to the body.
// ---------------------------------------------------------------------------
const FEEDBACK_TEMPLATES = {
  bug: { template: 'bug_report.md', labels: 'bug' },
  feature: { template: 'feature_request.md', labels: 'enhancement' },
};

let feedbackKind = 'bug';
let feedbackVersion = '';

function openFeedbackLink(kind, title, body) {
  const cfg = FEEDBACK_TEMPLATES[kind];
  if (!cfg || !window.externalLinks) return;
  const fullBody = `${body}\n\n---\n_Lectio v${feedbackVersion}_`;
  const url =
    `https://github.com/masprime77/lectio/issues/new?template=${cfg.template}` +
    `&labels=${cfg.labels}&title=${encodeURIComponent(title)}&body=${encodeURIComponent(fullBody)}`;
  window.externalLinks.openExternal(url);
  closeFeedbackModal();
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

  document.getElementById('feedback-submit').addEventListener('click', () => {
    const title = document.getElementById('feedback-input-title').value.trim();
    const body = document.getElementById('feedback-input-body').value.trim();
    const error = document.getElementById('feedback-error');
    if (!title || !body) {
      error.classList.remove('hidden');
      return;
    }
    error.classList.add('hidden');
    openFeedbackLink(feedbackKind, title, body);
  });
}

function closeFeedbackModal() {
  document.getElementById('feedback-overlay').classList.add('hidden');
  document.getElementById('feedback-input-title').value = '';
  document.getElementById('feedback-input-body').value = '';
  document.getElementById('feedback-error').classList.add('hidden');
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
  // Inject the plus icon into the header button (it ships with only a label).
  const btn = document.getElementById('add-item-btn');
  btn.insertAdjacentHTML('afterbegin', icon('plus'));

  btn.addEventListener('click', openAddItemModal);

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
