import { describe, it, expect, vi } from 'vitest';
import moodleClient from '../../src/integrations/moodle-client.js';

const { MoodleApiError, createMoodleClient } = moodleClient;

// A fake fetch that records the requested URL and resolves with a canned
// JSON body — no real network call, ever.
function fakeFetch(jsonBody) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    return { json: async () => jsonBody };
  };
  fn.calls = calls;
  return fn;
}

describe('createMoodleClient — construction', () => {
  it('throws synchronously without a baseUrl', () => {
    expect(() => createMoodleClient({ token: 't', fetchImpl: fakeFetch({}) })).toThrow('baseUrl');
  });

  it('throws synchronously without a token', () => {
    expect(() => createMoodleClient({ baseUrl: 'https://moodle.example', fetchImpl: fakeFetch({}) })).toThrow(
      'token'
    );
  });

  it('throws when no fetch implementation is available', () => {
    vi.stubGlobal('fetch', undefined);
    expect(() => createMoodleClient({ baseUrl: 'https://moodle.example', token: 't' })).toThrow(
      'No fetch implementation'
    );
    vi.unstubAllGlobals();
  });
});

describe('createMoodleClient — getSiteInfo', () => {
  it('calls core_webservice_get_site_info with the token and json format', async () => {
    const fetchImpl = fakeFetch({ userid: 42, fullname: 'Mateo Arenas Salas' });
    const client = createMoodleClient({ baseUrl: 'https://moodle.example', token: 'tok123', fetchImpl });

    const result = await client.getSiteInfo();

    expect(result).toEqual({ userid: 42, fullname: 'Mateo Arenas Salas' });
    expect(fetchImpl.calls).toHaveLength(1);
    const url = new URL(fetchImpl.calls[0]);
    expect(url.pathname).toBe('/webservice/rest/server.php');
    expect(url.searchParams.get('wstoken')).toBe('tok123');
    expect(url.searchParams.get('wsfunction')).toBe('core_webservice_get_site_info');
    expect(url.searchParams.get('moodlewsrestformat')).toBe('json');
  });

  it('strips a trailing slash from baseUrl before building the endpoint', async () => {
    const fetchImpl = fakeFetch({ userid: 1 });
    const client = createMoodleClient({ baseUrl: 'https://moodle.example/', token: 't', fetchImpl });
    await client.getSiteInfo();
    expect(fetchImpl.calls[0]).not.toContain('//webservice');
  });
});

describe('createMoodleClient — getEnrolledCourses', () => {
  it('passes userid through as the userid param', async () => {
    const fetchImpl = fakeFetch([{ id: 1998, fullname: 'Data Mining und Maschinelles Lernen' }]);
    const client = createMoodleClient({ baseUrl: 'https://moodle.example', token: 't', fetchImpl });

    const courses = await client.getEnrolledCourses(42);

    expect(courses).toEqual([{ id: 1998, fullname: 'Data Mining und Maschinelles Lernen' }]);
    const url = new URL(fetchImpl.calls[0]);
    expect(url.searchParams.get('wsfunction')).toBe('core_enrol_get_users_courses');
    expect(url.searchParams.get('userid')).toBe('42');
  });
});

describe('createMoodleClient — getCourseContents', () => {
  it('passes courseId through as the courseid param', async () => {
    const fetchImpl = fakeFetch([{ id: 1, name: 'Allgemeines', modules: [] }]);
    const client = createMoodleClient({ baseUrl: 'https://moodle.example', token: 't', fetchImpl });

    const contents = await client.getCourseContents(1998);

    expect(contents).toEqual([{ id: 1, name: 'Allgemeines', modules: [] }]);
    const url = new URL(fetchImpl.calls[0]);
    expect(url.searchParams.get('wsfunction')).toBe('core_course_get_contents');
    expect(url.searchParams.get('courseid')).toBe('1998');
  });
});

describe('createMoodleClient — error handling', () => {
  it('throws a MoodleApiError with errorcode/wsfunction when Moodle returns its exception envelope', async () => {
    const fetchImpl = fakeFetch({
      exception: 'moodle_exception',
      errorcode: 'invalidtoken',
      message: 'Invalid token - token not found',
    });
    const client = createMoodleClient({ baseUrl: 'https://moodle.example', token: 'bad', fetchImpl });

    await expect(client.getSiteInfo()).rejects.toThrow(MoodleApiError);
    try {
      await client.getSiteInfo();
      throw new Error('expected getSiteInfo to reject');
    } catch (err) {
      expect(err.errorcode).toBe('invalidtoken');
      expect(err.wsfunction).toBe('core_webservice_get_site_info');
      expect(err.message).toContain('invalidtoken');
    }
  });

  it('does not throw for a normal, exception-free response', async () => {
    const fetchImpl = fakeFetch({ userid: 1 });
    const client = createMoodleClient({ baseUrl: 'https://moodle.example', token: 't', fetchImpl });
    await expect(client.getSiteInfo()).resolves.toEqual({ userid: 1 });
  });
});
