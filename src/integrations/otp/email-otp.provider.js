import { isMailerConfigured } from '../../config/mailer.js';
import { ServiceUnavailableError } from '../../shared/errors/AppError.js';
import { logger } from '../../utils/logger.js';
import { nodemailerProvider } from '../mail/nodemailer.provider.js';

const BRAND_NAME = 'Petza';

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const renderText = ({ otp, expiresInMinutes }) =>
  [`${BRAND_NAME} verification code`, '', `Your verification code is ${otp}.`, `It expires in ${expiresInMinutes} minutes.`, '', 'If you did not request this code, you can ignore this email.'].join(
    '\n'
  );

const renderHtml = ({ otp, expiresInMinutes }) => {
  const safeOtp = escapeHtml(otp);
  const safeExpires = escapeHtml(expiresInMinutes);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${BRAND_NAME} verification code</title>
  </head>
  <body style="margin:0;background:#fdf4ef;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#2b1a12;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;border-collapse:collapse;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #fce5df;box-shadow:0 18px 48px rgba(199,85,61,0.12);">
            <tr>
              <td style="padding:28px 28px 16px;text-align:center;background:linear-gradient(135deg,#e76f51,#c8553d);">
                <div style="display:inline-block;width:52px;height:52px;border-radius:50%;background:#ffffff;color:#e76f51;line-height:52px;font-size:24px;">🐾</div>
                <h1 style="margin:14px 0 4px;color:#ffffff;font-size:22px;line-height:1.25;font-weight:800;">${BRAND_NAME}</h1>
                <p style="margin:0;color:#fce5df;font-size:13px;line-height:1.5;">Secure verification code</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 8px;">
                <p style="margin:0 0 16px;color:#5a4235;font-size:15px;line-height:1.6;">Use this code to continue. For your security, do not share it with anyone.</p>
                <div style="border:1px solid #fce5df;border-radius:16px;background:#fdf4ef;padding:22px 16px;text-align:center;">
                  <div style="color:#a97b5f;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;">Verification Code</div>
                  <div style="margin-top:10px;color:#c8553d;font-size:40px;line-height:1;font-weight:900;letter-spacing:8px;">${safeOtp}</div>
                  <div style="margin-top:14px;color:#a97b5f;font-size:13px;line-height:1.5;">Expires in ${safeExpires} minutes</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 28px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#fdf4ef;border-radius:12px;border-left:4px solid #e76f51;">
                  <tr>
                    <td style="padding:12px 14px;color:#5a4235;font-size:12px;line-height:1.55;">
                      If you did not request this code, you can safely ignore this email.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 28px;background:#fdf4ef;color:#a97b5f;text-align:center;font-size:11px;line-height:1.5;">
                This message was sent by ${BRAND_NAME}.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

export const emailOtpProvider = {
  channel: 'EMAIL',
  async send({ destination, otp, expiresInMinutes, purpose }) {
    if (!isMailerConfigured) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableError('Email OTP provider is not configured');
      }
      // Dev fallback so the flow is testable without real SMTP credentials — never used in production.
      logger.warn(`[DEV OTP] ${purpose} code for ${destination}: ${otp} (expires in ${expiresInMinutes}m)`);
      // The code travels back to the caller as well as the log — see requestOtp,
      // which surfaces it only under this same non-production fallback.
      return { success: true, dev: true, otp };
    }

    await nodemailerProvider.send({
      to: destination,
      subject: `Your ${BRAND_NAME} verification code`,
      text: renderText({ otp, expiresInMinutes }),
      html: renderHtml({ otp, expiresInMinutes }),
    });

    return { success: true };
  },
};
