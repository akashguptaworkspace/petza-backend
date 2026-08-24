import { Router } from 'express';

import {
  changePassword,
  forgotPassword,
  googleAuth,
  login,
  logout,
  logoutAll,
  me,
  refresh,
  register,
  requestOtp,
  resetPassword,
  verifyOtp,
} from '../../controllers/shared/auth.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  googleAuthSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  requestOtpSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from '../../validators/shared/auth.validator.js';

/** Shared across Customer/Partner/Admin — context isn't known until the token is issued. */
export const authRouter = Router();

authRouter.post('/login', authRateLimiter, validate(loginSchema), login);
authRouter.post('/register', authRateLimiter, validate(registerSchema), register);
authRouter.post('/google', authRateLimiter, validate(googleAuthSchema), googleAuth);
authRouter.post('/otp/send', authRateLimiter, validate(requestOtpSchema), requestOtp);
authRouter.post('/otp/verify', authRateLimiter, validate(verifyOtpSchema), verifyOtp);
authRouter.post('/refresh', authRateLimiter, validate(refreshTokenSchema), refresh);
authRouter.post('/logout', authRateLimiter, validate(refreshTokenSchema), logout);
authRouter.get('/me', authenticate, me);

/**
 * Forgotten password: the OTP proves ownership of the identifier and so
 * stands in for the old password. Rate-limited like every other auth route,
 * and both steps revoke nothing until the code actually checks out.
 */
authRouter.post('/password/forgot', authRateLimiter, validate(forgotPasswordSchema), forgotPassword);
authRouter.post('/password/reset', authRateLimiter, validate(resetPasswordSchema), resetPassword);

/** Setting or changing a password from inside the app — also how an OTP-only or Google account gains one. */
authRouter.patch('/password', authenticate, authRateLimiter, validate(changePasswordSchema), changePassword);

/** "Sign out everywhere" — revokes every refresh token this account has. */
authRouter.post('/logout-all', authenticate, authRateLimiter, logoutAll);
