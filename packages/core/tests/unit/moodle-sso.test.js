import { describe, it, expect } from 'vitest';
import moodleSso from '../../src/integrations/moodle-sso.js';

const { buildLaunchUrl, parseMoodleMobileRedirect } = moodleSso;

function encode(payload) {
  return Buffer.from(payload, 'utf8').toString('base64');
}

describe('buildLaunchUrl', () => {
  it('builds the admin/tool/mobile/launch.php URL with the expected params', () => {
    const url = new URL(buildLaunchUrl('https://moodle.example', { passport: 42 }));
    expect(url.pathname).toBe('/admin/tool/mobile/launch.php');
    expect(url.searchParams.get('service')).toBe('moodle_mobile_app');
    expect(url.searchParams.get('passport')).toBe('42');
    expect(url.searchParams.get('urlscheme')).toBe('moodlemobile');
  });

  it('strips a trailing slash from baseUrl', () => {
    const url = buildLaunchUrl('https://moodle.example/', { passport: 1 });
    expect(url).not.toContain('//admin');
  });

  it('allows overriding urlscheme and service', () => {
    const url = new URL(
      buildLaunchUrl('https://moodle.example', { passport: 1, urlscheme: 'lectio', service: 'custom_service' })
    );
    expect(url.searchParams.get('urlscheme')).toBe('lectio');
    expect(url.searchParams.get('service')).toBe('custom_service');
  });

  it('generates a numeric passport when none is given', () => {
    const url = new URL(buildLaunchUrl('https://moodle.example'));
    expect(url.searchParams.get('passport')).toMatch(/^\d+$/);
  });

  it('throws without a baseUrl', () => {
    expect(() => buildLaunchUrl()).toThrow('baseUrl');
  });
});

describe('parseMoodleMobileRedirect', () => {
  it('parses a real-shaped 2-segment payload (wstoken:::privatetoken)', () => {
    const encoded = encode('fake0token0aaaa1111:::fake0private0bbbb2222');
    const result = parseMoodleMobileRedirect(`moodlemobile://token=${encoded}`);
    expect(result).toEqual({
      wstoken: 'fake0token0aaaa1111',
      privatetoken: 'fake0private0bbbb2222',
    });
  });

  it('parses a 3-segment payload (passport:::wstoken:::privatetoken)', () => {
    const encoded = encode('42:::sometoken:::someprivatetoken');
    const result = parseMoodleMobileRedirect(`moodlemobile://token=${encoded}`);
    expect(result).toEqual({ passport: '42', wstoken: 'sometoken', privatetoken: 'someprivatetoken' });
  });

  it('handles a URI-encoded payload, as a real navigation event would capture it', () => {
    const encoded = encode('a:::b');
    const uriEncoded = encodeURIComponent(encoded);
    const result = parseMoodleMobileRedirect(`moodlemobile://token=${uriEncoded}`);
    expect(result).toEqual({ wstoken: 'a', privatetoken: 'b' });
  });

  it('respects a custom urlscheme (matching a non-default buildLaunchUrl call)', () => {
    const encoded = encode('a:::b');
    const result = parseMoodleMobileRedirect(`lectio://token=${encoded}`);
    expect(result).toEqual({ wstoken: 'a', privatetoken: 'b' });
  });

  it('returns null for a non-token URL', () => {
    expect(parseMoodleMobileRedirect('https://moodle.example/login')).toBeNull();
  });

  it('returns null for malformed base64', () => {
    expect(parseMoodleMobileRedirect('moodlemobile://token=%%%not-base64%%%')).toBeNull();
  });

  it('returns null for an unexpected segment count', () => {
    const encoded = encode('onlyonepart');
    expect(parseMoodleMobileRedirect(`moodlemobile://token=${encoded}`)).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(parseMoodleMobileRedirect(null)).toBeNull();
    expect(parseMoodleMobileRedirect(undefined)).toBeNull();
  });
});
