#!/usr/bin/env node
'use strict';

// Throwaway Phase-13 spike: hits a real Moodle Web Services REST endpoint
// with a personal token to validate the integration model before Phase 14
// builds the real @lectio/core mapper. Not part of the shipped product —
// no tests, no package.json, run directly with Node's built-in fetch.
//
// Usage:
//   node --env-file=.env spikes/moodle-poc/poc.js
//
// Required env vars (see .env.example):
//   MOODLE_BASE_URL  e.g. https://moodle.tu-darmstadt.de
//   MOODLE_TOKEN     a Moodle "Mobile app" web service token (see README.md)

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.MOODLE_BASE_URL;
const TOKEN = process.env.MOODLE_TOKEN;

if (!BASE_URL || !TOKEN) {
  console.error(
    'Missing MOODLE_BASE_URL or MOODLE_TOKEN.\n' +
      'Copy spikes/moodle-poc/.env.example to spikes/moodle-poc/.env and fill it in,\n' +
      'then run: node --env-file=spikes/moodle-poc/.env spikes/moodle-poc/poc.js'
  );
  process.exit(1);
}

const OUTPUT_DIR = path.join(__dirname, 'output');

async function callMoodle(wsfunction, params = {}) {
  const url = new URL(`${BASE_URL.replace(/\/+$/, '')}/webservice/rest/server.php`);
  url.searchParams.set('wstoken', TOKEN);
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
  console.log('1/3 — core_webservice_get_site_info (verify token, get userid)');
  const siteInfo = await callMoodle('core_webservice_get_site_info');
  saveOutput('site-info', siteInfo);
  console.log(`  ok — signed in as ${siteInfo.fullname} (userid ${siteInfo.userid})`);

  console.log('2/3 — core_enrol_get_users_courses (list enrolled courses)');
  const courses = await callMoodle('core_enrol_get_users_courses', { userid: siteInfo.userid });
  saveOutput('courses', courses);
  console.log(`  ok — ${courses.length} enrolled course(s):`);
  courses.forEach((c) => console.log(`    - [${c.id}] ${c.fullname}`));

  if (courses.length === 0) {
    console.log('No courses to inspect further — stopping here.');
    return;
  }

  const target = courses[0];
  console.log(`3/3 — core_course_get_contents for "${target.fullname}" (id ${target.id})`);
  const contents = await callMoodle('core_course_get_contents', { courseid: target.id });
  saveOutput(`course-${target.id}-contents`, contents);
  console.log(`  ok — ${contents.length} section(s), saved to output/course-${target.id}-contents.json`);

  console.log('\nBonus — mod_assign_get_assignments for the same course');
  try {
    const assignments = await callMoodle('mod_assign_get_assignments', { 'courseids[0]': target.id });
    saveOutput(`course-${target.id}-assignments`, assignments);
    console.log('  ok — saved to output/');
  } catch (err) {
    console.log(`  skipped (${err.message}) — some sites disable this function`);
  }

  console.log(`\nDone. Inspect the JSON files in ${OUTPUT_DIR} and fill in docs/MOODLE_INTEGRATION_SPIKE.md.`);
}

main().catch((err) => {
  console.error('PoC failed:', err.message);
  process.exit(1);
});
