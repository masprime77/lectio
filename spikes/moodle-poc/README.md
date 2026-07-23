# Moodle Web Services PoC (Phase 13 spike)

A **throwaway** validation script — not shipped product code. It hits a real
Moodle Web Services REST endpoint with a personal token to confirm the
integration model (option **(a)** in
[`../../docs/MOODLE_INTEGRATION_SPIKE.md`](../../docs/MOODLE_INTEGRATION_SPIKE.md))
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
