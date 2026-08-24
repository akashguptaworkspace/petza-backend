import rateLimit from 'express-rate-limit';

import { ErrorCodes } from '../shared/constants/errorCodes.js';
import { sendError } from '../shared/response/sendResponse.js';

function rateLimitHandler(req, res) {
  sendError(res, { statusCode: 429, message: 'Too many requests. Please try again later.', code: ErrorCodes.BAD_REQUEST });
}

/**
 * Rate limiting is per-IP, and the whole test suite shares one IP — so under
 * `NODE_ENV=test` it would only measure how many assertions a file makes,
 * failing whichever test happened to run twentieth. The limiter is exercised
 * against a running server instead (see README), not against supertest.
 */
const skipInTests = () => process.env.NODE_ENV === 'test';

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

/** Applied globally in app.js. */
export const apiRateLimiter = rateLimit({
  windowMs,
  limit: Number(process.env.RATE_LIMIT_MAX) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipInTests,
});

/**
 * Tighter limit for auth endpoints. These are the routes worth guessing at —
 * passwords, OTP codes — so they get their own budget, tunable without a
 * code change because the right number depends on how many real users sit
 * behind one NAT.
 */
export const authRateLimiter = rateLimit({
  windowMs,
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipInTests,
});
