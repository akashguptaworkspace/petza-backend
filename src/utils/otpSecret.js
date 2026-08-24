import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

export function generateNumericOtp(digits = 6) {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits;
  return String(randomInt(min, max));
}

export function hashOtp(value) {
  return createHash('sha256').update(value).digest('hex');
}

/** Timing-safe comparison — never use `===` on secrets, it leaks timing information. */
export function compareOtpHash(value, expectedHash) {
  const actual = Buffer.from(hashOtp(value), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
