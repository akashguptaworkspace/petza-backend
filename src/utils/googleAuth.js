import { OAuth2Client } from 'google-auth-library';

import { ServiceUnavailableError, UnauthorizedError } from '../shared/errors/AppError.js';

const client = new OAuth2Client();

/**
 * Verifies a Google Identity Services credential (ID token) against our
 * configured client IDs. `email_verified` coming back true from Google is
 * itself proof of email ownership — safe to match/link an existing
 * password-registered account by that email without extra confirmation.
 *
 * `GOOGLE_CLIENT_ID` is a COMMA-SEPARATED LIST, not a single value, and it
 * has to be: this one API serves petza-app and petza-partner, which are
 * deliberately separate Google Cloud projects (so either app's sign-in can
 * be configured or revoked without touching the other). An ID token minted
 * by an Android client carries that client's own id in `aud`, so a server
 * pinned to one of them rejects the other app's perfectly valid token with
 * "Invalid or expired Google credential" — which is exactly what happened
 * to petza-app while this held only petza-partner's id.
 *
 * Passing the whole list to `verifyIdToken` is not a loosening of the
 * check: google-auth-library accepts an array and still requires `aud` to
 * match one entry exactly, so an id from any *other* project is rejected
 * as before. Each new client (an iOS or web one, when those are
 * registered) gets appended here rather than replacing what's there.
 *
 * A single value keeps working unchanged — it's just a one-element list.
 */
export async function verifyGoogleIdToken(idToken) {
  const audience = (process.env.GOOGLE_CLIENT_ID || '')
    .split(',')
    .map((clientId) => clientId.trim())
    .filter(Boolean);

  if (audience.length === 0) {
    throw new ServiceUnavailableError('Google login is not configured on this server');
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({ idToken, audience });
  } catch {
    throw new UnauthorizedError('Invalid or expired Google credential');
  }

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload?.email || payload.email_verified !== true) {
    throw new UnauthorizedError('Unable to verify Google account details');
  }

  return { sub: payload.sub, email: payload.email, name: payload.name, picture: payload.picture };
}
