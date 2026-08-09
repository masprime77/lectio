import { describe, it, expect } from 'vitest';
import oauthRedirect from '../../src/integrations/oauth-redirect.js';

const { parseOAuthRedirect } = oauthRedirect;

describe('parseOAuthRedirect', () => {
  it('parses a PKCE redirect (?code=...)', () => {
    const result = parseOAuthRedirect('lectio://auth-callback?code=abc123');
    expect(result).toEqual({ type: 'code', code: 'abc123' });
  });

  it('parses an implicit-flow redirect (#access_token=...&refresh_token=...)', () => {
    const result = parseOAuthRedirect('lectio://auth-callback#access_token=A&refresh_token=B');
    expect(result).toEqual({ type: 'tokens', access_token: 'A', refresh_token: 'B' });
  });

  it('parses an error redirect', () => {
    const result = parseOAuthRedirect('lectio://auth-callback?error=access_denied&error_description=User+cancelled');
    expect(result).toEqual({
      type: 'error',
      error: 'access_denied',
      errorDescription: 'User cancelled',
    });
  });

  it('returns null for an unrelated URL', () => {
    expect(parseOAuthRedirect('https://example.com')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(parseOAuthRedirect(null)).toBeNull();
    expect(parseOAuthRedirect(undefined)).toBeNull();
  });

  it('returns null for a malformed auth-callback redirect with no recognized params', () => {
    expect(parseOAuthRedirect('lectio://auth-callback?foo=bar')).toBeNull();
    expect(parseOAuthRedirect('lectio://auth-callback')).toBeNull();
  });
});
