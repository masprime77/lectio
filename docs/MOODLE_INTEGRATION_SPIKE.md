# Moodle Integration Spike (Phase 13)

## Goal

Most students at TU Darmstadt (and German universities generally) already have
their whole semester laid out inside Moodle: their enrolled courses, the
readings and hand-outs each instructor posts, and the assignments with real due
dates. Lectio today makes them re-type all of that by hand. The goal of Track C
is to let a student point Lectio at their real Moodle account and have a
populated semester come back — the same courses, the same materials bucketed
into weeks, the same deadlines — so the planner starts from their actual
coursework instead of an empty file.

## Options considered

Three ways to get course data out of Moodle, each trading off differently
between how much structure we get, how simple it is to build, and how robust
and defensible it is long-term.

- **(a) Moodle Web Services REST API + a personal user token.** Moodle ships an
  official read API. The student generates a "Mobile app" web-service token from
  their Moodle profile and pastes it into Lectio; we then call documented
  functions (`core_enrol_get_users_courses`, `core_course_get_contents`, …) to
  read exactly what the student is enrolled in, section by section, with real
  ids and due dates. **Upside:** the richest, most structured data, it's the
  supported/official path, and it's read-only. **Downside:** it only works if
  the institution has web services enabled for the mobile-app service (most do,
  because the official Moodle mobile app depends on it, but not all), and the
  student has to obtain a token.

- **(b) iCal deadline export.** Moodle can hand out a private iCal URL of the
  student's calendar. **Upside:** dead simple — one HTTP GET of a standard
  `.ics` feed, no token dance, works even where web services are locked down.
  **Downside:** it's calendar events only. We'd get assignment due dates but
  none of the course structure — no readings, no sections, no per-course
  materials — so it can populate deadlines but can't reconstruct a semester.

- **(c) Scraping the Moodle web UI.** Log in as the user and parse HTML.
  **Upside:** in principle can see anything the student can see. **Downside:**
  brittle (breaks on every theme/markup change), ties us to handling the user's
  actual login credentials, and is on shaky ground against most institutions'
  acceptable-use terms. High maintenance, low trust.

## Decision

**Adopt (a), the Web Services REST API + user token, as the primary
integration.** It's the only option that returns enough structure to rebuild a
full semester, it's the officially supported surface, and being read-only and
token-scoped keeps it low-risk.

**Keep (b), the iCal export, as a lightweight fallback** for the case where an
institution has web services disabled: we can still offer a due-dates-only sync
that fills in task deadlines even when we can't read full course structure.

**Reject (c), scraping,** outright — it's brittle, it forces us to handle raw
credentials, and it's legally and operationally the worst of the three. We will
not build it.

## How this maps to Lectio's data model

The nice property here is that Moodle integration needs **no change to the
storage contract**. Moodle simply becomes another way to produce a `Semester`
object — the exact JSON shape `@lectio/core` already reads and writes (see the
**Data model** section of [`../CLAUDE.md`](../CLAUDE.md) for the canonical
shape). Once we've turned Moodle's responses into a `Semester`, it flows through
the same `list`/`get`/`save`/`delete` adapters as any hand-built semester and
syncs to every device for free.

**The mapper does not decide what is a reading and what is a task.** This is the
biggest change the live runs produced. Moodle's own module types don't line up
with that distinction in practice (see Validation status: at TU Darmstadt the
graded exercises aren't in `mod_assign` at all, so "assignment ⇒ task" would
mostly produce nothing while genuine coursework sat in `resource` modules).
Guessing would be wrong often enough to be worse than not guessing, so the
reading-vs-task choice belongs to the **user**, in the Phase 16 import UI —
which follows the same "pick a mode, then everything you confirm becomes that
type" pattern used elsewhere in the app. The core mapper stays type-agnostic.

**Moodle course → Lectio course.** Each enrolled course becomes one Lectio
course, carrying its name (color derived as usual).

Beyond that, the mapper's entire job is four steps:

1. **Filter by module type.** Keep only modules whose `modname` is `resource`,
   `url`, or `folder` — the ones that are actually course material. Everything
   else (`label` HTML text blocks, `forum`, `choice` surveys) is never offered
   as an import candidate.
2. **Filter by visibility.** Drop any module or section with `visible: 0` or
   `uservisible: false`. Live courses carry hidden trailing sections (exam,
   review) that must not be imported as phantom content.
3. **Group into weeks.** Use the section's name when it parses as a German date
   range (e.g. `"13. April - 19. April"`), and **fall back to raw section
   order** when it doesn't. Topic-named sections ("Thema 00 - Einleitung") have
   no date to parse, and both shapes occur in the wild — so the date parse is an
   opportunistic optimization, never an assumption.
4. **Emit type-agnostic items.** Each surviving module becomes
   `{ name: module.name, url: module.url, moodleModuleId: module.id }`.
   `module.name` is used verbatim as the title — no parsing needed.
   `moodleModuleId` is the stable identity a later re-sync can match on.

**Always `module.url`, never `contents[].fileurl`.** Each `resource`/`url`
module exposes both: `module.url` (`.../mod/resource/view.php?id=…`) opens fine
in the user's normal logged-in browser with no token, whereas `fileurl`
(`.../pluginfile.php/…`) is a direct download that only works with the
`wstoken` appended. Storing `module.url` means **Lectio never persists or
resends a Moodle token inside a saved item's link** — a meaningful security
simplification, and the reason this choice is fixed rather than a preference.

**Due dates are not sourced from Moodle.** The natural source, `mod_assign`'s
`duedate`, proved unreliable here (see Open risks), so imported items arrive
without due dates and the user sets them — the same as any hand-built task.

## Web Services functions needed

The PoC (`spikes/moodle-poc/`) exercises the minimum set of functions Phase 14
will build on:

- **`core_webservice_get_site_info`** — the handshake. Verifies the token is
  valid and returns the caller's identity, including the `userid` the next call
  needs.
- **`core_enrol_get_users_courses`** — given that `userid`, returns the list of
  courses the student is enrolled in (id + names), i.e. the set of Lectio
  courses to create.
- **`core_course_get_contents`** — given a course id, returns that course's
  sections and the modules inside each section. This is the one that matters:
  it carries the `modname`, `visible`/`uservisible`, `name`, `url`, and section
  names the mapper filters and groups on, and is the sole source of importable
  items.
- **`mod_assign_get_assignments`** _(optional)_ — returns assignment metadata
  including due dates. Originally expected to be the clean source for task due
  dates; the live runs showed it isn't usable at TU Darmstadt (see Validation
  status and Open risks), so it stays in the PoC as a probe for institutions
  that *do* use `mod_assign`, and nothing in the design depends on it.

## Validation status

Validated against the real instance (`moodle.informatik.tu-darmstadt.de`) with
two PoC runs on two deliberately different courses.

- [x] Ran the PoC against `moodle.informatik.tu-darmstadt.de` with my own token
- [x] Web services were enabled / token obtained successfully
- [x] `core_course_get_contents` returned usable section/resource structure
- [x] Notes on anything unexpected — see below

**Token: SSO, not native Moodle login.** This instance authenticates through
institutional SSO, so `login/token.php` with a username and password — the flow
the PoC README documents — **does not work here**. The token had to be obtained
via the `admin/tool/mobile/launch.php` + `moodlemobile://token=` redirect
capture flow instead. That is the flow Phase 15's in-app auth will have to
replicate with a WebView; it is not an incidental detail.

**Run 1 — course id 10** ("Funktionale und objektorientierte
Programmierkonzepte", an old cross-semester reference course):

- All four functions succeeded end-to-end —
  `core_webservice_get_site_info`, `core_enrol_get_users_courses` (**31**
  courses returned), `core_course_get_contents`, and
  `mod_assign_get_assignments`. The token and the whole Web Services path work.
- Sections were **topic-based, not date-based**: 27 sections named
  "Allgemeines", "Thema 00 - Einleitung", and so on — **no parseable date
  range** anywhere.
- `mod_assign_get_assignments` returned an **empty list**; this course isn't
  assignment-driven.

**Run 2 — course id 1998** ("Data Mining und Maschinelles Lernen SoSe 2026", a
live, in-progress course):

- Sections **are** named with parseable German date ranges — `"13. April - 19.
  April"`, `"6. Juli - 12. Juli"` — with sequential `section: 1, 2, 3…`. This
  **confirms the date-range heuristic is viable**, while run 1 proves it can't
  be relied on universally: the fallback to raw section order is required, not
  optional.
- Trailing sections were **hidden** ("DMML Klausur", "Einsicht", both
  `visible: 0` / `uservisible: false`). These must be filtered out rather than
  imported as phantom content — which is why visibility filtering is a mapper
  step and not a UI nicety.
- `mod_assign_get_assignments` returned **exactly one** assignment,
  "Evaluation Vorlesung" — a course-evaluation survey, not coursework — with
  `duedate: 0`. So even on a live, current course, the native Moodle assignment
  module is **not** where real exercise due dates live (see Open risks).
- Course content arrived as several `modname` types: `label` (HTML text blocks,
  no file), `forum`, `choice` (surveys), `resource` (real files, e.g. PDFs), and
  `url` (links, e.g. lecture recordings). Only `resource`, `url`, and `folder`
  are meaningful import candidates; the rest would be noise in a picker.
- Each `resource`/`url` module carries **two different links** — `module.url`
  (e.g. `…/mod/resource/view.php?id=87317`, works in the user's browser session
  with no token) and `contents[].fileurl` (e.g. `…/pluginfile.php/…`, needs the
  `wstoken` appended). This is what settled the "store `module.url`, never
  `fileurl`" decision above.

## Open risks

1. **Institution dependence.** The whole primary path hinges on the specific
   institution exposing web services for the "Mobile app" service. Where it's
   disabled, (a) is unavailable and we fall back to the iCal-only path (b) — so
   we can't promise full-structure import universally.
2. **Wildly varying course structure — now confirmed, not just suspected.** How
   instructors organize a course is not standardized, and the two live runs
   demonstrate both ends of it: course 1998 names its sections with clean German
   date ranges, while course 10 uses 27 topic-named sections with no date
   anywhere. The date-range parse therefore **must** be paired with a documented
   fallback to raw section order — treating it as a hard assumption would
   silently mis-bucket every topic-structured course. Phase 14 needs fixtures
   from both shapes (and ideally a third, near-unstructured course) to validate
   against.
3. **Native `mod_assign` due dates are unreliable here.** TU Darmstadt CS
   courses generally don't run graded exercises through Moodle's assignment
   module at all — they use external tools (Praktomat / Artemis) — so
   `mod_assign_get_assignments` doesn't see real coursework. This was confirmed
   on a **live, current** course, not just an old one: course 1998 returned a
   single entry, a course-evaluation survey with `duedate: 0`. Consequences:
   (i) we can't populate task due dates from Moodle, and (ii) any design that
   assumed "assignment ⇒ task" is unworkable, which is precisely why the mapper
   no longer classifies item types. If a future institution *does* use
   `mod_assign` properly, its due dates become an additive bonus rather than
   something the design depends on.
4. **Token handling / security.** The web-service token is a live credential for
   the student's account. It must **never** be committed, and must be sent
   **only** to the student's own Moodle instance — never to Lectio's servers,
   Supabase, or any third party. On the platform side (Phase 15) it belongs in
   Expo SecureStore on mobile and the OS keychain on desktop, not in plain
   AsyncStorage or a JSON file. Storing `module.url` rather than `fileurl`
   (above) keeps the token out of saved item links entirely.
5. **SSO makes token acquisition harder than the README implies.** Because this
   instance uses institutional SSO, the simple `login/token.php` exchange is
   unavailable and Phase 15 must drive the `admin/tool/mobile/launch.php` +
   `moodlemobile://token=` redirect capture in a WebView. That's more moving
   parts than a pasted token, and the exact flow may differ at other
   institutions.
