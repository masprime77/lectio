'use strict';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  semesterId: null,   // current semester file id (filename without .json)
  semester: null,     // loaded semester object
  openWeeks: new Set(), // weeks currently expanded
  editingId: null,    // semester id being edited in the modal (null = create mode)
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
const api = {
  list: () => fetch('/api/semesters').then((r) => r.json()),
  load: (id) => fetch(`/api/semesters/${id}`).then((r) => r.json()),
  save: (id, data) =>
    fetch(`/api/semesters/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  remove: (id) => fetch(`/api/semesters/${id}`, { method: 'DELETE' }).then((r) => r.json()),
};

// Persist the current semester, then re-render.
let saveTimer = null;
function persist() {
  if (!state.semester) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => api.save(state.semesterId, state.semester), 250);
}

const uid = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// ---------------------------------------------------------------------------
// Tabler icons (inline SVG — no external dependency, works offline)
// ---------------------------------------------------------------------------
const ICONS = {
  'chevron-right': '<path d="M9 6l6 6l-6 6" />',
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
};

function icon(name) {
  return `<svg class="ti" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
}

// Status cycles
const READING_CYCLE = ['pending', 'seen', 'summarized', 'studied'];
const TASK_CYCLE = ['not done', 'done', 'reviewed'];

function nextStatus(cycle, current) {
  const i = cycle.indexOf(current);
  return cycle[(i + 1) % cycle.length];
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
  const cw = currentWeek(state.semester);
  if (cw) state.openWeeks.add(cw); // auto-expand current week
  document.getElementById('semester-select').value = id;
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

// ---------------------------------------------------------------------------
// Dashboard: per-course progress + current week indicator
// ---------------------------------------------------------------------------
function courseProgress(course) {
  const total = course.readings.length + course.tasks.length;
  if (total === 0) return 0;
  const doneReadings = course.readings.filter((r) => r.status === 'studied').length;
  const doneTasks = course.tasks.filter(
    (t) => t.status === 'done' || t.status === 'reviewed'
  ).length;
  return Math.round(((doneReadings + doneTasks) / total) * 100);
}

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
    bars = '<div class="week-empty">No courses yet. Add one via “New Semester”.</div>';
  } else {
    sem.courses.forEach((course) => {
      const pct = courseProgress(course);
      bars += `
        <div class="progress-row">
          <div class="progress-label">
            <span>${escapeHtml(course.name)}</span>
            <span>${pct}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${pct}%;background:${course.color}"></div>
          </div>
        </div>`;
    });
  }

  root.innerHTML = heading + weekLine + bars;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ---------------------------------------------------------------------------
// Planner: collapsible weeks, one course card per week
// ---------------------------------------------------------------------------
function renderPlanner() {
  const sem = state.semester;
  const root = document.getElementById('planner');
  root.innerHTML = '';
  const cw = currentWeek(sem);

  for (let week = 1; week <= sem.weeks; week++) {
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
      body.innerHTML = '<div class="week-empty">No courses in this semester.</div>';
    } else {
      sem.courses.forEach((course) => {
        body.appendChild(renderCourseCard(course, week));
      });
    }

    weekEl.appendChild(body);
    root.appendChild(weekEl);
  }
}

function toggleWeek(week) {
  if (state.openWeeks.has(week)) state.openWeeks.delete(week);
  else state.openWeeks.add(week);
  renderPlanner();
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

    const badge = document.createElement('button');
    badge.className = 'badge ' + item.status.replace(/\s+/g, '');
    badge.textContent = item.status;
    badge.title = 'Click to change status';
    badge.addEventListener('click', () => {
      const cycle = type === 'reading' ? READING_CYCLE : TASK_CYCLE;
      item.status = nextStatus(cycle, item.status);
      persist();
      render();
    });
    li.appendChild(badge);

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
      course.readings.push({ id: uid('r'), week, title: v, status: 'pending' });
    } else {
      course.tasks.push({
        id: uid('t'),
        week,
        title: v,
        dueDate: due.value || '',
        status: 'not done',
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

  const list = await populateSelector();
  if (list.length) await loadSemester(list[0].id);
  else renderEmptyState();

  document.getElementById('semester-select').addEventListener('change', (e) => {
    loadSemester(e.target.value);
  });
  document.getElementById('edit-semester-btn').addEventListener('click', () => {
    if (state.semesterId) openEditModal(state.semesterId);
  });
  document.getElementById('delete-semester-btn').addEventListener('click', () => {
    if (state.semesterId) deleteSemester(state.semesterId);
  });

  setupModal();
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

init();
