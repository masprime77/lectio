# Moodle Web Services PoC (Phase 13 spike)

A **throwaway** validation script — not shipped product code. It hits a real
Moodle Web Services REST endpoint with a personal token to confirm the
integration model (option **(a)** in
[`../../docs/planning/MOODLE_INTEGRATION_SPIKE.md`](../../docs/planning/MOODLE_INTEGRATION_SPIKE.md))
works against a real institution's Moodle before Phase 14 builds the actual
`@lectio/core/integrations/moodle` mapper.

It has no `package.json` and no dependencies: Node 22 has a global `fetch`, and
env vars load with Node's built-in `--env-file` flag.

## Run it

From inside this folder (`spikes/moodle-poc/`):

```bash
cp .env.example .env
# edit .env and fill in MOODLE_BASE_URL and MOODLE_TOKEN
node --env-file=.env poc.js
```

It calls three functions in order — `core_webservice_get_site_info` (verify the
token, get your user id), `core_enrol_get_users_courses` (list your courses),
`core_course_get_contents` (sections + resources for the first course) — plus an
optional `mod_assign_get_assignments`, and writes each raw response into
`output/` for inspection.

Pass a course id as an argument to target a specific course instead of the
first one returned, e.g. `node --env-file=.env poc.js 1998`.

## Testing more than one Moodle account

Module ids are only unique *within* one Moodle instance, so it's worth running
against a second account. One `.env` can hold several named accounts instead of
needing a file each — set `MOODLE_ACCOUNTS` plus a
`MOODLE_<ID>_BASE_URL`/`MOODLE_<ID>_TOKEN` pair per account (see
[`.env.example`](.env.example) for the exact shape), then pick one per run:

```bash
node --env-file=.env poc.js --account=tu_main 43541
```

Output filenames gain the account id in this mode
(`course-<accountId>-<id>-contents.json`), so two accounts' dumps sit side by
side. Leaving `MOODLE_ACCOUNTS` unset keeps the original single-account
behaviour and the original filenames exactly as they were.


## Inspecting what the mapper makes of a course

`inspect-course.js` runs an already-downloaded course through the real
`@lectio/core` mapper and prints a per-section report — every section's name,
whether it's hidden, how many of its modules are importable, and what the
German date-range parser made of the name. It never touches the network; it
only reads what `poc.js` already saved, so you can iterate on the mapper
without re-fetching:

```bash
node inspect-course.js 1998
node inspect-course.js 43541 --account=tu_main
```

Pass `--account=<id>` to read an account-scoped file; the account id is also
used as the mapper's `source`, so the items come back tagged with
`moodleSource`. Override that with `--source=<value>`. The full mapped result
is written to a git-ignored `inspect-result.json` for deeper inspection.

## Getting a token

Moodle's "Mobile app" web service can issue a token via `login/token.php`. From
a terminal (over HTTPS):

```bash
curl "https://moodle.tu-darmstadt.de/login/token.php?username=YOUR_USERNAME&password=YOUR_PASSWORD&service=moodle_mobile_app"
```

Cautions:

- This puts your **password in the querystring**. Only run it once, locally,
  over HTTPS. Never share the resulting token, and prefer an **app-specific
  password** if your institution's SSO offers one.
- It can fail with an explicit error if the site has **web services disabled**,
  or the **mobile service isn't enabled** for your user/institution. That
  failure is itself a useful Phase-13 finding (it tells us option (a) isn't
  available there and we'd fall back to the iCal path) — it's **not a bug** in
  this script.

Alternatively, some Moodle sites let you create a token by hand under
_Preferences → Security keys_ in your profile.

## Security

- `.env` and `output/` are **git-ignored**. Never commit a real token or real
  course data.
- The token is only ever sent to your own Moodle instance — nowhere else.
