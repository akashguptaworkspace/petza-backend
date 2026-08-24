import { z } from 'zod';

const selfServeRole = z.enum(['CUSTOMER', 'PARTNER']);

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().trim().min(7).max(20).optional(),
  role: selfServeRole,
});

/** Shared by /auth/refresh and /auth/logout — both take just the raw refresh token in the body. */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20, 'refreshToken is required'),
});

export const googleAuthSchema = z.object({
  idToken: z.string().min(20, 'idToken is required'),
  // Only required when this Google identity has no existing account yet — service enforces that.
  role: selfServeRole.optional(),
});

export const requestOtpSchema = z
  .object({
    identifier: z.string().trim().min(3),
    channel: z.enum(['EMAIL', 'SMS']),
    purpose: z.enum(['LOGIN', 'REGISTER']),
  })
  .superRefine((data, ctx) => {
    if (data.channel === 'EMAIL' && !/^\S+@\S+\.\S+$/.test(data.identifier)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['identifier'], message: 'identifier must be a valid email for the EMAIL channel' });
    }
    if (data.channel === 'SMS' && !/^\+?[0-9\s()-]{7,20}$/.test(data.identifier)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['identifier'], message: 'identifier must be a valid phone number for the SMS channel' });
    }
  });

export const verifyOtpSchema = z
  .object({
    identifier: z.string().trim().min(3),
    channel: z.enum(['EMAIL', 'SMS']),
    purpose: z.enum(['LOGIN', 'REGISTER']),
    otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits'),
    name: z.string().trim().min(1).max(120).optional(),
    // Only required for purpose=REGISTER — service ignores it for LOGIN.
    role: selfServeRole.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.purpose === 'REGISTER' && !data.role) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['role'], message: 'role is required when purpose is REGISTER' });
    }
  });

/** Passwords are only ever length-checked — no composition rules, which push people towards predictable substitutions rather than longer secrets. */
const password = z.string().min(8, 'Password must be at least 8 characters').max(128);

const identifierWithChannel = z
  .object({
    identifier: z.string().trim().min(3),
    channel: z.enum(['EMAIL', 'SMS']),
  })
  .superRefine((data, ctx) => {
    if (data.channel === 'EMAIL' && !/^\S+@\S+\.\S+$/.test(data.identifier)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['identifier'], message: 'identifier must be a valid email for the EMAIL channel' });
    }
    if (data.channel === 'SMS' && !/^\+?[0-9\s()-]{7,20}$/.test(data.identifier)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['identifier'], message: 'identifier must be a valid phone number for the SMS channel' });
    }
  });

/** POST /auth/password/forgot — step 1, sends the code. */
export const forgotPasswordSchema = identifierWithChannel;

/** POST /auth/password/reset — step 2, the code stands in for the old password. */
export const resetPasswordSchema = z.object({
  identifier: z.string().trim().min(3),
  channel: z.enum(['EMAIL', 'SMS']),
  otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  password,
});

/** PATCH /auth/password — `currentPassword` is required only when the account already has one; the service enforces that, since only it knows. */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128).optional(),
  newPassword: password,
});
