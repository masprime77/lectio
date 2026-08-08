#!/usr/bin/env node
'use strict';

// Reads a course-<id>-contents.json (or, in multi-account mode,
// course-<accountId>-<id>-contents.json) file already produced by poc.js and
// runs it through the real @lectio/core Moodle mapper, so a dev can eyeball
// whether the German date-range parser and item filtering behave correctly
// on a given real course -- without re-fetching from Moodle each time.
//
// This script does NOT talk to Moodle and does NOT create course data files.
// That's poc.js's job. This only reads what poc.js already saved.
//
// Usage:
//   node spikes/moodle-poc/inspect-course.js <courseId> [--account=<id>] [--source=<value>]
//
// Examples:
//   node spikes/moodle-poc/inspect-course.js 1998
//   node spikes/moodle-poc/inspect-course.js 43541
//   node spikes/moodle-poc/inspect-course.js 43541 --account=tu_main
//   node spikes/moodle-poc/inspect-course.js 43541 --account=tu_main --source=https://moodle.tu-darmstadt.de
//
// (works whether you run it from the repo root or from inside
// spikes/moodle-poc/ -- paths below are relative to this file via __dirname,
// not to your current working directory)
//
// Output:
//   - a per-section report printed to the terminal: raw section name,
//     hidden/visible, importable item count, and what the date-range parser
//     made of the name (or "fallback to raw order" when it didn't parse)
//   - the full mapCourseContents() result written to
//     spikes/moodle-poc/inspect-result.json for deeper inspection
//     (git-ignored -- it holds real course data)

const fs = require('fs');
const path = require('path');
const moodle = require('../../packages/core/src/integrations/moodle.js');

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
const courseId = positional[0];
const accountId = flags.account || null;
// The account id doubles as the mapper's `source` so the printed/written
// result demonstrates moodleSource end-to-end; --source overrides it.
const source = flags.source !== undefined ? flags.source : accountId || undefined;

if (!courseId) {
  console.error('Missing course id. Usage: node inspect-course.js <courseId> [--account=<id>] [--source=<value>]');
  process.exit(1);
}

const OUTPUT_DIR = path.join(__dirname, 'output');
const filename = accountId ? `course-${accountId}-${courseId}-contents.json` : `course-${courseId}-contents.json`;
const inputPath = path.join(OUTPUT_DIR, filename);

if (!fs.existsSync(inputPath)) {
  console.error(`Could not find ${inputPath}`);
  console.error('This file is created by poc.js, not by this script.');
  console.error(
    `Run it first, e.g.: node --env-file=... poc.js ${accountId ? `--account=${accountId} ` : ''}${courseId}`
  );

  if (fs.existsSync(OUTPUT_DIR)) {
    const available = fs.readdirSync(OUTPUT_DIR).filter((f) => /^course-.*-contents\.json$/.test(f));
    if (available.length > 0) {
      console.error('\nCourse content files that DO exist in output/:');
      available.forEach((f) => console.error(`  - ${f}`));
    } else {
      console.error(`\n${OUTPUT_DIR} exists but has no course-*-contents.json files yet.`);
    }
  } else {
    console.error(`\n${OUTPUT_DIR} does not exist yet -- poc.js hasn't been run at all.`);
  }
  process.exit(1);
}

const contents = require(inputPath);
const result = moodle.mapCourseContents(contents, source !== undefined ? { source } : undefined);

const resultPath = path.join(__dirname, 'inspect-result.json');
fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
console.log(`Mapped result written to ${resultPath}${source !== undefined ? ` (tagged with source: ${source})` : ''}`);

console.log('\n--- Parser check (every raw section, including hidden/empty ones) ---\n');

contents.forEach((section) => {
  const dateRange = moodle.parseGermanDateRangeSectionName(section.name);
  const hidden = section.visible === 0 || section.uservisible === false;
  const moduleCount = (section.modules || []).length;
  const importableCount = (section.modules || []).filter(moodle.isModuleImportable).length;
  const rangeLabel = dateRange
    ? `${dateRange.startDay}.${dateRange.startMonth} → ${dateRange.endDay}.${dateRange.endMonth}`
    : 'null (fallback to raw order)';

  console.log(
    `section ${String(section.section).padEnd(3)} | ${hidden ? 'HIDDEN ' : 'visible'} | ` +
      `${importableCount}/${moduleCount} importable | dateRange: ${rangeLabel} | "${section.name}"`
  );
});

const totalItems = result.weeks.reduce((n, w) => n + w.items.length, 0);
const parsed = result.weeks.filter((w) => w.dateRange).length;
console.log(
  `\nMapped: ${result.weeks.length} week(s) kept from ${contents.length} raw section(s), ` +
    `${parsed} with a parsed date range, ${totalItems} importable item(s) total.`
);
