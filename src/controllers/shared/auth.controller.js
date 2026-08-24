import { authService } from '../../services/shared/auth.service.js';
import { sendSuccess } from '../../shared/response/sendResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, { ip: req.ip });
  sendSuccess(res, { message: 'Login successful', data: result });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.me(req.user.id);
  sendSuccess(res, { message: 'Current user fetched successfully', data: user });
});

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, { ip: req.ip });
  sendSuccess(res, { statusCode: 201, message: 'Registered successfully', data: result });
});

export const googleAuth = asyncHandler(async (req, res) => {
  const result = await authService.googleAuth(req.body, { ip: req.ip });
  sendSuccess(res, { message: 'Google authentication successful', data: result });
});

export const requestOtp = asyncHandler(async (req, res) => {
  const result = await authService.requestOtp(req.body);
  sendSuccess(res, { message: 'OTP sent successfully', data: result });
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyOtp(req.body, { ip: req.ip });
  sendSuccess(res, { message: 'OTP verified successfully', data: result });
});

export const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.body, { ip: req.ip });
  sendSuccess(res, { message: 'Token refreshed successfully', data: result });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.body);
  sendSuccess(res, { message: 'Logged out successfully' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.requestPasswordReset(req.body);
  sendSuccess(res, { message: 'Password reset code sent', data: result });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body, { ip: req.ip });
  sendSuccess(res, { message: 'Password reset successfully', data: result });
});

export const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword({ userId: req.user.id, ...req.body }, { ip: req.ip });
  sendSuccess(res, { message: 'Password updated successfully', data: result });
});

export const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.user.id);
  sendSuccess(res, { message: 'Signed out of all devices' });
});
