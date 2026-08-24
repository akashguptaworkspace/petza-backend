import { createHash } from 'node:crypto';

/** SHA-256 hex digest of a signed JWT string — refresh_tokens stores this, never the raw token, so a leaked DB row can't be replayed by itself. */
export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
