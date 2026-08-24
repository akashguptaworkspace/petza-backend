import { OAuth2Client } from 'google-auth-library';

import { ServiceUnavailableError, UnauthorizedError } from '../shared/errors/AppError.js';

const client = new OAuth2Client();

/**
 * Verifies a Google Identity Services credential (ID token) against our
 * configured client ID. `email_verified` coming back true from Google is
 * itself proof of email ownership — safe to match/link an existing
 * password-registered account by that email without extra confirmation.
 */
export async function verifyGoogleIdToken(idToken) {
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) {
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
