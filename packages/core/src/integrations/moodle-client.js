'use strict';
// A thin, platform-agnostic client for Moodle's Web Services REST API. Wraps
// exactly the three functions validated in the Phase 13 spike
// (docs/planning/MOODLE_INTEGRATION_SPIKE.md, "Web Services functions needed"):
// core_webservice_get_site_info, core_enrol_get_users_courses, and
// core_course_get_contents. `mod_assign_get_assignments` is intentionally not
// wrapped here — the spike found it unusable at TU Darmstadt and nothing in
// the design depends on it; add it later if a future institution needs it.
//
// This module makes real network calls (unlike integrations/moodle.js, which
// is pure), but has no platform-specific dependency — only the `fetch` global,
// present in Node 22, browsers, and React Native/Expo alike — so it's shared
// across desktop and mobile exactly like planner-core.js. Token storage and
// the SSO token-capture flow are platform layers built on top of this in
// separate Phase 15 sub-branches; this module only knows how to make a call
// once it already has a base URL and a token.
//
// No DOM, no Electron, no file system. Dual-mode wrapper so it loads in Node
// (`require`) and the browser (`window.LectioMoodleClient`), mirroring
// planner-core.js and integrations/moodle.js.
(function (global, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.LectioMoodleClient = api;
})(typeof window !== 'undefined' ? window : null, function () {
  // Thrown when Moodle's REST endpoint responds with its own exception
  // envelope (`{ exception, errorcode, message }`) — e.g. an expired/invalid
  // token, or a function disabled for the site's "Mobile app" service.
  // errorcode/wsfunction are exposed as fields (not just baked into the
  // message) so a caller can react programmatically — e.g. treat
  // "invalidtoken" as "please reconnect Moodle" in the settings UI, without
  // string-matching the message.
  class MoodleApiError extends Error {
    constructor(message, { errorcode, wsfunction } = {}) {
      super(message);
      this.name = 'MoodleApiError';
      this.errorcode = errorcode;
      this.wsfunction = wsfunction;
    }
  }

  function buildUrl(baseUrl, token, wsfunction, params) {
    const url = new URL(`${String(baseUrl).replace(/\/+$/, '')}/webservice/rest/server.php`);
    url.searchParams.set('wstoken', token);
    url.searchParams.set('wsfunction', wsfunction);
    url.searchParams.set('moodlewsrestformat', 'json');
    Object.entries(params || {}).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return url;
  }

  // Creates a client bound to one Moodle instance + token. `fetchImpl` is
  // injected (defaulting to the global `fetch`) so tests never make a real
  // network call — mirrors createFsStorage(dirOrResolver)/
  // createSupabaseStorage(client)'s injected-dependency pattern.
  function createMoodleClient({ baseUrl, token, fetchImpl } = {}) {
    if (!baseUrl) throw new Error('createMoodleClient requires a baseUrl.');
    if (!token) throw new Error('createMoodleClient requires a token.');
    const doFetch = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    if (!doFetch) {
      throw new Error(
        'No fetch implementation available. Pass { fetchImpl } explicitly in this environment.'
      );
    }

    async function call(wsfunction, params) {
      const url = buildUrl(baseUrl, token, wsfunction, params);
      const res = await doFetch(url.toString());
      const data = await res.json();
      if (data && data.exception) {
        throw new MoodleApiError(
          `Moodle error in ${wsfunction}: ${data.errorcode} — ${data.message}`,
          { errorcode: data.errorcode, wsfunction }
        );
      }
      return data;
    }

    return {
      // Verifies the token and returns the caller's identity, including the
      // `userid` getEnrolledCourses needs.
      getSiteInfo: () => call('core_webservice_get_site_info', {}),
      // Given a userid (from getSiteInfo), returns the enrolled courses.
      getEnrolledCourses: (userId) => call('core_enrol_get_users_courses', { userid: userId }),
      // Given a course id, returns its sections/modules — the sole input to
      // integrations/moodle.js's mapCourseContents.
      getCourseContents: (courseId) => call('core_course_get_contents', { courseid: courseId }),
    };
  }

  return {
    MoodleApiError,
    createMoodleClient,
  };
});
