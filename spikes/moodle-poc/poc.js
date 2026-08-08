#!/usr/bin/env node
'use strict';

// Throwaway Phase-13 spike: hits a real Moodle Web Services REST endpoint
// with a personal token to validate the integration model before Phase 14
// builds the real @lectio/core mapper. Not part of the shipped product —
// no tests, no package.json, run directly with Node's built-in fetch.
//
// Usage:
//   node --env-file=.env spikes/moodle-poc/poc.js [courseId]
//
// With no courseId, targets the first course returned by
// core_enrol_get_users_courses. Pass a courseId (e.g. 1998) to target a
// specific course instead — useful for re-running against a course that
// actually has active assignments.
//
// Required env vars (see .env.example):
//   MOODLE_BASE_URL  e.g. https://moodle.tu-darmstadt.de
//   MOODLE_TOKEN     a Moodle "Mobile app" web service token (see README.md)
//
// Optionally, one .env can hold several named accounts instead, so testing a
// second instance doesn't need a second env file:
//   MOODLE_ACCOUNTS              e.g. tu_informatik,tu_main
//   MOODLE_<ID>_BASE_URL         per account, id uppercased, non-alphanumerics
//   MOODLE_<ID>_TOKEN            become underscores
// Pick one with --account=<id>. Output filenames are then account-scoped so
// two accounts' dumps never overwrite each other.
//
// Examples:
//
//   # Default .env, first enrolled course (whatever core_enrol_get_users_courses
//   # returns first — not guaranteed to be a specific one):
//   node --env-file=spikes/moodle-poc/.env spikes/moodle-poc/poc.js
//
//   # Default .env, a specific course id:
//   node --env-file=spikes/moodle-poc/.env spikes/moodle-poc/poc.js 1998
//
//   # A different Moodle instance/account, using a separate env file
//   # (e.g. to test against a second university's Moodle before this one
//   # shuts down — keeps tokens/base URLs from mixing):
//   node --env-file=spikes/moodle-poc/.env.instance2 spikes/moodle-poc/poc.js
//
//   # Same, targeting a specific course id on that second instance:
//   node --env-file=spikes/moodle-poc/.env.instance2 spikes/moodle-poc/poc.js 43541
//
//   # Running from inside spikes/moodle-poc/ itself (paths in --env-file and
//   # the script path both become relative to that folder instead):
//   cd spikes/moodle-poc
//   node --env-file=.env.instance2 poc.js 43541
//
//   # Multi-account .env (MOODLE_ACCOUNTS=tu_informatik,tu_main defined in .env):
//   node --env-file=spikes/moodle-poc/.env spikes/moodle-poc/poc.js --account=tu_main 43541
//
//   # Only one account listed in MOODLE_ACCOUNTS -- --account can be omitted:
//   node --env-file=spikes/moodle-poc/.env spikes/moodle-poc/poc.js 43541
//
// Output (always written to spikes/moodle-poc/output/, regardless of which
// directory you run the command from):
//   output/site-info.json                    — core_webservice_get_site_info response
//   output/courses.json                       — core_enrol_get_users_courses response
//   output/course-<id>-contents.json          — core_course_get_contents response
//   output/course-<id>-assignments.json       — mod_assign_get_assignments response
//                                                (only if the site has this function
//                                                enabled; skipped otherwise, doesn't
//                                                fail the run)
//
// In multi-account mode every name above gains the account id, so the two
// accounts' dumps sit side by side and nothing is overwritten:
//   output/site-info-<accountId>.json
//   output/courses-<accountId>.json
//   output/course-<accountId>-<id>-contents.json
//   output/course-<accountId>-<id>-assignments.json

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  argv.forEach((arg) => {
    const match = /^--([a-zA-Z0-9_-]+)=(.*)$/.exec(arg);
    if (match) {
      flags[match[1]] = match[2];
    } else {
      positional.push(arg);
    }
  });
  return { flags, positional };
}

const { flags, positional } = parseArgs(process.argv.slice(2));

const REQUESTED_COURSE_ID = positional[0] ? Number(positional[0]) : null;
if (positional[0] && Number.isNaN(REQUESTED_COURSE_ID)) {
  console.error(`Invalid course id argument: "${positional[0]}" is not a number.`);
  process.exit(1);
}

// Resolves which Moodle account's credentials to use. With no MOODLE_ACCOUNTS
// in the env this is the original single-account behaviour, untouched: read
// MOODLE_BASE_URL/MOODLE_TOKEN and leave output filenames unprefixed.
function resolveAccount(accountId) {
  const accountsList = (process.env.MOODLE_ACCOUNTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (accountsList.length === 0) {
    if (accountId) {
      console.error(
        `--account=${accountId} was given, but MOODLE_ACCOUNTS is not set in this .env file.\n` +
          'Either drop --account (single-account mode), or set MOODLE_ACCOUNTS to use multi-account mode.'
      );
      process.exit(1);
    }
    return { id: null, baseUrl: process.env.MOODLE_BASE_URL, token: process.env.MOODLE_TOKEN };
  }

  let id = accountId;
  if (!id) {
    if (accountsList.length === 1) {
      id = accountsList[0];
    } else {
      console.error(
        `MOODLE_ACCOUNTS defines multiple accounts (${accountsList.join(', ')}) — ` +
          'pass --account=<id> to pick one.'
      );
      process.exit(1);
    }
  }
  if (!accountsList.includes(id)) {
    console.error(`Unknown account "${id}". MOODLE_ACCOUNTS defines: ${accountsList.join(', ')}`);
    process.exit(1);
  }
  const prefix = `MOODLE_${id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const baseUrl = process.env[`${prefix}_BASE_URL`];
  const token = process.env[`${prefix}_TOKEN`];
  if (!baseUrl || !token) {
    console.error(`Missing ${prefix}_BASE_URL or ${prefix}_TOKEN for account "${id}".`);
    process.exit(1);
  }
  return { id, baseUrl, token };
}

const account = resolveAccount(flags.account || null);

if (!account.baseUrl || !account.token) {
  console.error(
    'Missing MOODLE_BASE_URL or MOODLE_TOKEN.\n' +
      'Copy spikes/moodle-poc/.env.example to spikes/moodle-poc/.env and fill it in,\n' +
      'then run: node --env-file=spikes/moodle-poc/.env spikes/moodle-poc/poc.js'
  );
  process.exit(1);
}

// Account-scoped output names, so two accounts' dumps never collide. In
// single-account mode this is the identity function and every previously
// saved filename stays exactly as it was.
function outputName(base) {
  return account.id ? `${base}-${account.id}` : base;
}

function courseOutputName(courseId, suffix) {
  return account.id
    ? `course-${account.id}-${courseId}-${suffix}`
    : `course-${courseId}-${suffix}`;
}

const OUTPUT_DIR = path.join(__dirname, 'output');

async function callMoodle(wsfunction, params = {}) {
  const url = new URL(`${account.baseUrl.replace(/\/+$/, '')}/webservice/rest/server.php`);
  url.searchParams.set('wstoken', account.token);
  url.searchParams.set('wsfunction', wsfunction);
  url.searchParams.set('moodlewsrestformat', 'json');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url);
  const data = await res.json();
  if (data && data.exception) {
    throw new Error(`Moodle error in ${wsfunction}: ${data.errorcode} — ${data.message}`);
  }
  return data;
}

function saveOutput(name, data) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

async function main() {
  if (account.id) {
    console.log(`Using account "${account.id}" (${account.baseUrl})\n`);
  }

  console.log('1/3 — core_webservice_get_site_info (verify token, get userid)');
  const siteInfo = await callMoodle('core_webservice_get_site_info');
  saveOutput(outputName('site-info'), siteInfo);
  console.log(`  ok — signed in as ${siteInfo.fullname} (userid ${siteInfo.userid})`);

  console.log('2/3 — core_enrol_get_users_courses (list enrolled courses)');
  const courses = await callMoodle('core_enrol_get_users_courses', { userid: siteInfo.userid });
  saveOutput(outputName('courses'), courses);
  console.log(`  ok — ${courses.length} enrolled course(s):`);
  courses.forEach((c) => console.log(`    - [${c.id}] ${c.fullname}`));

  if (courses.length === 0) {
    console.log('No courses to inspect further — stopping here.');
    return;
  }

  let target;
  if (REQUESTED_COURSE_ID !== null) {
    target = courses.find((c) => c.id === REQUESTED_COURSE_ID);
    if (!target) {
      console.error(
        `Course id ${REQUESTED_COURSE_ID} was not found among your ${courses.length} enrolled course(s).\n` +
          'Enrolled course ids: ' + courses.map((c) => c.id).join(', ')
      );
      process.exit(1);
    }
  } else {
    target = courses[0];
  }
  console.log(`3/3 — core_course_get_contents for "${target.fullname}" (id ${target.id})`);
  const contents = await callMoodle('core_course_get_contents', { courseid: target.id });
  const contentsName = courseOutputName(target.id, 'contents');
  saveOutput(contentsName, contents);
  console.log(`  ok — ${contents.length} section(s), saved to output/${contentsName}.json`);

  console.log('\nBonus — mod_assign_get_assignments for the same course');
  try {
    const assignments = await callMoodle('mod_assign_get_assignments', { 'courseids[0]': target.id });
    const assignmentsName = courseOutputName(target.id, 'assignments');
    saveOutput(assignmentsName, assignments);
    console.log(`  ok — saved to output/${assignmentsName}.json`);
  } catch (err) {
    console.log(`  skipped (${err.message}) — some sites disable this function`);
  }

  console.log(`\nDone. Inspect the JSON files in ${OUTPUT_DIR} and fill in docs/MOODLE_INTEGRATION_SPIKE.md.`);
}

main().catch((err) => {
  console.error('PoC failed:', err.message);
  process.exit(1);
});
