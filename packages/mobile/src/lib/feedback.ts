// In-app feedback client. Posts to the SAME Vercel serverless endpoint the
// desktop uses (packages/desktop/app.js `submitFeedback`), which files a GitHub
// issue on our behalf — so the user needs no GitHub account and the app carries
// no secrets (the token lives only in the Vercel function). Same request body
// shape — { type, title, body, version } — and same { ok, url } response.
import Constants from 'expo-constants';

const FEEDBACK_ENDPOINT = 'https://lectio-opal.vercel.app/api/feedback';

export type FeedbackKind = 'bug' | 'feature';

export interface FeedbackResult {
  ok: true;
  url: string;
}

/** The running app version (expo.version), sent so issues are tagged with a build. */
export const appVersion: string = Constants.expoConfig?.version ?? '?';

/**
 * Submit feedback to the shared endpoint. Throws on network failure, a non-2xx
 * response, or `{ ok: false }` so callers can surface an error without crashing.
 */
export async function submitFeedback(
  kind: FeedbackKind,
  title: string,
  body: string,
  version: string = appVersion,
): Promise<FeedbackResult> {
  const res = await fetch(FEEDBACK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: kind, title, body, version }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.ok) throw new Error(data?.error || 'Unknown error');
  return data as FeedbackResult;
}
