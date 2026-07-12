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

The mapping:

- **Moodle course → Lectio course.** Each enrolled course becomes one course,
  carrying its name (and we can derive a color).
- **Moodle resources/assignments → Lectio readings/tasks.** Files, pages, and
  URLs an instructor posts map to **readings**; assignments (things that are
  submitted) map to **tasks**.
- **Sections/due dates → weeks.** Items are bucketed into Lectio's week slots by
  their Moodle section when the course uses weekly sections, or by an item's due
  date otherwise. Course structure varies enough (see Open risks) that this is a
  heuristic, not a fixed rule.
- **Assignment due dates → task due dates.** Moodle exposes assignment
  `duedate`s directly, which map straight onto a task's `dueDate`.
- **Submission state → candidate seed for tag status.** Whether the student has
  already submitted/graded an assignment is a plausible signal for seeding a
  task's tag (e.g. "done"), but we're **not committing to that mapping yet** —
  it's noted as a possibility for Phase 14 to evaluate against real data.

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
  sections and the resources/assignments (modules) inside each section — the
  raw material for readings/tasks bucketed into weeks.
- **`mod_assign_get_assignments`** _(optional)_ — returns assignment metadata
  including due dates directly, a cleaner source for task `dueDate`s than
  digging them out of course contents. Some sites disable it, so it's treated as
  a bonus, not a hard dependency.

## Validation status

_To be filled in by hand after running the PoC against a real Moodle instance.
Left unchecked intentionally._

```
- [ ] Ran the PoC against moodle.tu-darmstadt.de with my own token
- [ ] Web services were enabled / token obtained successfully
- [ ] core_course_get_contents returned usable section/resource structure
- [ ] Notes on anything unexpected:
```

## Open risks

1. **Institution dependence.** The whole primary path hinges on the specific
   institution exposing web services for the "Mobile app" service. Where it's
   disabled, (a) is unavailable and we fall back to the iCal-only path (b) — so
   we can't promise full-structure import universally.
2. **Wildly varying course structure.** How instructors organize a course is not
   standardized: some use tidy weekly sections, some use topic-based sections,
   some dump everything into one section with almost no structure. Phase 14's
   mapper therefore needs **heuristics** (infer weeks from sections *or* due
   dates, tolerate missing structure) rather than a clean 1:1 rule, and it needs
   fixtures from several real courses to validate against.
3. **Token handling / security.** The web-service token is a live credential for
   the student's account. It must **never** be committed, and must be sent
   **only** to the student's own Moodle instance — never to Lectio's servers,
   Supabase, or any third party. On the platform side (Phase 15) it belongs in
   Expo SecureStore on mobile and the OS keychain on desktop, not in plain
   AsyncStorage or a JSON file.
