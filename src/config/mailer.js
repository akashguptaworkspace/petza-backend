import nodemailer from 'nodemailer';

export const isMailerConfigured = Boolean(process.env.SMTP_HOST);

const smtpPassword = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
const connectionTimeoutMs = Number(process.env.SMTP_CONNECTION_TIMEOUT_MS) || 10000;

/**
 * Single pooled transport for the whole process — created once here, not
 * per-send, so we're not opening a fresh SMTP connection on every OTP.
 * `null` when unconfigured; integrations/mail/nodemailer.provider.js is the
 * one place that checks `isMailerConfigured` before touching this.
 */
export const mailTransport = isMailerConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      connectionTimeout: connectionTimeoutMs,
      greetingTimeout: connectionTimeoutMs,
      socketTimeout: connectionTimeoutMs * 2,
      auth: process.env.SMTP_USER && smtpPassword ? { user: process.env.SMTP_USER, pass: smtpPassword } : undefined,
    })
  : null;
