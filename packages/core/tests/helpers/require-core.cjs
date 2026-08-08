'use strict';
// Loads planner-core through Node's CommonJS path (module.exports), the same
// way the desktop main process consumes @lectio/core. Lets ESM test files
// exercise the CJS surface of the dual-mode wrapper.
module.exports = require('../../src/planner-core.js');
