import 'dotenv/config';

import jwt from 'jsonwebtoken';

import { RoleContext } from '../config/constants.js';

/** Builds the minimal, server-derived JWT payload — never trust role/context values supplied by a client. */
function buildTokenPayload(user) {
  return { sub: user.id, role: user.role, context: RoleContext[user.role] };
}

export function signAccessToken(user) {
  const secret = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me';
  return jwt.sign(buildTokenPayload(user), secret, { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' });
}

/** `jti` is required (not defaulted here) — the caller mints a fresh uuid per token so two refresh tokens issued in the same second never sign to the same string (jwt.sign is otherwise deterministic for identical payload+secret+expiry, which would collide on refresh_tokens.token_hash's unique index). */
export function signRefreshToken(user, jti) {
  const secret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me';
  return jwt.sign({ ...buildTokenPayload(user), jti }, secret, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me');
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me');
}

/** Reads the `exp` claim without verifying the signature — used only to compute refresh_tokens.expires_at right after signing a token this same process just minted. */
export function decodeExpiry(token) {
  const decoded = jwt.decode(token);
  return new Date(decoded.exp * 1000);
}
