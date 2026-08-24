import { ServiceUnavailableError } from '../../shared/errors/AppError.js';
import { logger } from '../../utils/logger.js';

function isConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

export const smsOtpProvider = {
  channel: 'SMS',
  async send({ destination, otp, expiresInMinutes, purpose }) {
    if (!isConfigured()) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableError('SMS OTP provider is not configured');
      }
      // Dev fallback so the flow is testable without real SMS credentials — never used in production.
      logger.warn(`[DEV OTP] ${purpose} code for ${destination}: ${otp} (expires in ${expiresInMinutes}m)`);
      // The code travels back to the caller as well as the log — see requestOtp,
      // which surfaces it only under this same non-production fallback.
      return { success: true, dev: true, otp };
    }

    // No SMS vendor is wired up yet — plug in Twilio (or another provider) here once
    // TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER are actually configured.
    throw new ServiceUnavailableError('SMS OTP provider is not configured');
  },
};
