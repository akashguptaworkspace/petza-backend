import { isMailerConfigured, mailTransport } from '../../config/mailer.js';
import { ServiceUnavailableError } from '../../shared/errors/AppError.js';

export const nodemailerProvider = {
  async send({ to, subject, html, text, fromName, attachments }) {
    if (!isMailerConfigured) {
      throw new ServiceUnavailableError('Email provider is not configured');
    }

    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

    return mailTransport.sendMail({
      from: { name: fromName || process.env.SMTP_FROM_NAME || 'Petza', address: fromEmail },
      to,
      subject,
      html,
      text,
      attachments,
    });
  },
};
