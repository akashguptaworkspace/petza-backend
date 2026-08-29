import { randomUUID } from 'node:crypto';

import { Context, Role, RoleContext, StoreStatusApproval } from '../../config/constants.js';
import { emailOtpProvider } from '../../integrations/otp/email-otp.provider.js';
import { smsOtpProvider } from '../../integrations/otp/sms-otp.provider.js';
import { sequelize } from '../../models/index.js';
import { otpRepository } from '../../repositories/shared/otp.repository.js';
import { refreshTokenRepository } from '../../repositories/shared/refreshToken.repository.js';
import { storeRepository } from '../../repositories/shared/store.repository.js';
import { userRepository } from '../../repositories/shared/user.repository.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from '../../shared/errors/AppError.js';
import { verifyGoogleIdToken } from '../../utils/googleAuth.js';
import { decodeExpiry, signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { maskEmail, maskPhone } from '../../utils/maskIdentifier.js';
import { hashToken } from '../../utils/tokenHash.js';
import { compareOtpHash, generateNumericOtp, hashOtp } from '../../utils/otpSecret.js';
import { comparePassword, hashPassword } from '../../utils/password.js';

const otpProviders = { EMAIL: emailOtpProvider, SMS: smsOtpProvider };

/** The only roles a client can self-select via public register/OTP/Google flows — ADMIN is never client-selectable. */
const SELF_SERVE_ROLES = { CUSTOMER: Role.CUSTOMER, PARTNER: Role.PARTNER };

/**
 * Maps the User model to the AuthUser shape petza-partner/petza-app expect
 * — never return the model (or password_hash) directly. `role` here is the
 * collapsed context (CUSTOMER/PARTNER/ADMIN), matching the frontends'
 * `UserRole` type; the granular Role only lives in the JWT/DB for
 * server-side permission checks. `phone`/`avatarImage` are always present
 * (never omitted) since petza-app's `AuthUser` type declares them
 * non-optional — there's no avatar upload yet, so it's always `''`, same
 * placeholder petza-app's own mocks/user.mock.ts uses for ProfileAvatar's
 * initials fallback.
 */
function toAuthUser(user, store) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarImage: '',
    role: RoleContext[user.role],
    ...(user.partnerStoreId ? { partnerStoreId: user.partnerStoreId } : {}),
    // Admin-only, and the finer of the two: `role` says which shell of the
    // partner app opens, `adminRole` says what that shell may touch.
    ...(user.adminRole ? { adminRole: user.adminRole } : {}),
    // Partner-only, and absent until the partner has said what they offer —
    // which is exactly the state the signup flow treats as "not done yet".
    //
    // The two flags are what the whole partner app conditions on (§3): one
    // dashboard for everyone, and these decide what appears inside it and
    // whether the Products|Services segmented controls show at all.
    ...(store
      ? {
          businessType: store.businessType,
          offersProducts: store.offersProducts,
          offersServices: store.offersServices,
          approvalStatus: StoreStatusApproval[store.status],
        }
      : {}),
  };
}

/**
 * `toAuthUser` plus the one store lookup a partner needs. Every path that
 * hands a user back to a client goes through here, so a partner's business
 * type and approval status can never go stale between login, refresh and
 * /auth/me.
 */
async function buildAuthUser(user) {
  if (RoleContext[user.role] !== Context.PARTNER) return toAuthUser(user);
  const store = await storeRepository.findByOwnerUserId(user.id);
  return toAuthUser(user, store);
}

/** Persists a hash of the freshly-signed refresh token so /auth/refresh and /auth/logout can look it up, revoke it, and detect reuse — see refreshToken.repository.js. */
async function persistRefreshToken({ userId, refreshToken, ip }) {
  await refreshTokenRepository.create({
    userId,
    tokenHash: hashToken(refreshToken),
    expiresAt: decodeExpiry(refreshToken),
    createdByIp: ip ?? null,
  });
}

async function issueAuthResult(user, meta = {}) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, randomUUID());
  await persistRefreshToken({ userId: user.id, refreshToken, ip: meta.ip });

  return {
    user: await buildAuthUser(user),
    accessToken,
    refreshToken,
  };
}

function assertUserActive(user) {
  if (user.status !== 'ACTIVE') throw new ForbiddenError('This account is not active');
}

/** role here is the client-facing context string ('CUSTOMER' | 'PARTNER') — never the granular DB Role. */
function resolveSelfServeRole(role) {
  const resolved = SELF_SERVE_ROLES[role];
  if (!resolved) throw new BadRequestError('role must be CUSTOMER or PARTNER');
  return resolved;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone) {
  const cleaned = String(phone).replace(/[\s()-]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  const defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE || '+91';
  return `${defaultCountryCode}${cleaned.replace(/\D/g, '')}`;
}

function normalizeIdentifier(identifier, channel) {
  return channel === 'EMAIL' ? normalizeEmail(identifier) : normalizePhone(identifier);
}

function configuredPlayReviewIdentifiers() {
  return new Set(
    String(process.env.PLAY_REVIEW_IDENTIFIERS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => (value.includes('@') ? normalizeEmail(value) : normalizePhone(value)))
  );
}

function playReviewOtpFor({ destination, purpose }) {
  const otp = String(process.env.PLAY_REVIEW_OTP ?? '').trim();
  if (purpose !== 'LOGIN' || !/^\d{6}$/.test(otp)) return null;
  return configuredPlayReviewIdentifiers().has(destination) ? otp : null;
}

function findByChannel(destination, channel) {
  return channel === 'EMAIL' ? userRepository.findByEmail(destination) : userRepository.findByPhone(destination);
}

function otpSubject(destination, purpose) {
  return `${destination}:${purpose}`;
}

const labelFor = (channel) => (channel === 'EMAIL' ? 'email' : 'phone number');

/**
 * Validates and burns a one-time code. Every flow that accepts an OTP goes
 * through here, so the expiry rule, the attempt cap and the single-use
 * guarantee are defined once — a new purpose can never accidentally ship
 * with a weaker check than login has.
 */
async function consumeOtp({ destination, channel, purpose, otp }) {
  const challenge = await otpRepository.findLatestActive({ destination, channel, purpose });
  if (!challenge) throw new BadRequestError('OTP not found. Please request a new one.');
  if (challenge.expiresAt < new Date()) throw new BadRequestError('OTP has expired. Please request a new one.');

  const maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS) || 5;
  if (challenge.attempts >= maxAttempts) {
    throw new TooManyRequestsError('Too many incorrect attempts. Please request a new OTP.');
  }

  const isValid = compareOtpHash(`${otpSubject(destination, purpose)}:${otp}`, challenge.codeHash);
  if (!isValid) {
    await otpRepository.incrementAttempts(challenge);
    throw new BadRequestError('Invalid OTP');
  }

  await otpRepository.markConsumed(challenge);
  return challenge;
}

export const authService = {
  async login({ email, password }, meta = {}) {
    const user = await userRepository.findByEmailWithPassword(email);
    if (!user || !user.passwordHash) throw new UnauthorizedError('Invalid email or password');

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) throw new UnauthorizedError('Invalid email or password');

    assertUserActive(user);

    return issueAuthResult(user, meta);
  },

  async me(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw new UnauthorizedError('Account no longer exists');
    return buildAuthUser(user);
  },

  /** Normal (email + password) self-registration — CUSTOMER or PARTNER only, ADMIN is never self-registerable. */
  async register({ name, email, password, phone, role }, meta = {}) {
    const resolvedRole = resolveSelfServeRole(role);
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = phone ? normalizePhone(phone) : null;

    const existing = await userRepository.findByEmailOrPhone({ email: normalizedEmail, phone: normalizedPhone });
    if (existing) throw new ConflictError('An account with this email or phone already exists');

    const passwordHash = await hashPassword(password);
    const user = await userRepository.create({
      name,
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      role: resolvedRole,
      status: 'ACTIVE',
    });

    return issueAuthResult(user, meta);
  },

  /**
   * Single Google endpoint covers both login and registration, same as a
   * real "Sign in with Google" button: an existing account by that email
   * logs in; no match registers a new one. `role` is only required (and
   * only used) on the registration path — an existing account's own role
   * always wins, a client can't use this to escalate/switch context.
   */
  async googleAuth({ idToken, role }, meta = {}) {
    const payload = await verifyGoogleIdToken(idToken);
    const email = payload.email.toLowerCase();

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      assertUserActive(existingUser);
      return issueAuthResult(existingUser, meta);
    }

    const resolvedRole = resolveSelfServeRole(role);
    const user = await userRepository.create({
      name: payload.name || email.split('@')[0],
      email,
      passwordHash: null,
      role: resolvedRole,
      status: 'ACTIVE',
    });

    return issueAuthResult(user, meta);
  },

  /** Sends (or resends, past a cooldown) an OTP for either LOGIN against an existing account or REGISTER of a brand-new one. */
  async requestOtp({ identifier, channel, purpose }) {
    const destination = normalizeIdentifier(identifier, channel);
    const existingUser = await findByChannel(destination, channel);

    if (purpose === 'REGISTER') {
      if (existingUser) throw new ConflictError(`An account already exists with this ${labelFor(channel)}`);
    } else {
      // LOGIN and RESET_PASSWORD both act on an account that must already
      // exist. This does tell a caller whether an identifier is registered —
      // an unavoidable property of "send my code" flows, and one the LOGIN
      // path has always had, so reset does not pretend otherwise.
      if (!existingUser) throw new NotFoundError(`No account found with this ${labelFor(channel)}`);
      assertUserActive(existingUser);
    }

    const cooldownSeconds = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 60;
    const recent = await otpRepository.findLatestActive({ destination, channel, purpose });
    if (recent) {
      const elapsedSeconds = (Date.now() - recent.createdAt.getTime()) / 1000;
      if (elapsedSeconds < cooldownSeconds) {
        const retryAfterSeconds = Math.ceil(cooldownSeconds - elapsedSeconds);
        throw new TooManyRequestsError(`Please wait ${retryAfterSeconds}s before requesting another OTP`, { retryAfterSeconds });
      }
    }

    const ttlSeconds = Number(process.env.OTP_TTL_SECONDS) || 300;
    const expiresInMinutes = Math.ceil(ttlSeconds / 60);
    const otp = playReviewOtpFor({ destination, purpose }) ?? generateNumericOtp(6);

    // Send first — never persist (or count against the resend cooldown) an OTP the user never actually received.
    const delivery = await otpProviders[channel].send({ destination, otp, expiresInMinutes, purpose });

    await sequelize.transaction(async (transaction) => {
      await otpRepository.invalidateActive({ destination, channel, purpose, transaction });
      await otpRepository.create(
        {
          userId: existingUser?.id ?? null,
          purpose,
          channel,
          destination,
          codeHash: hashOtp(`${otpSubject(destination, purpose)}:${otp}`),
          expiresAt: new Date(Date.now() + ttlSeconds * 1000),
        },
        { transaction }
      );
    });

    return {
      destination: channel === 'EMAIL' ? maskEmail(destination) : maskPhone(destination),
      channel,
      purpose,
      expiresInSeconds: ttlSeconds,
      /**
       * The code itself, and only when the provider fell back to logging it
       * instead of delivering it — which it does exclusively outside
       * production, with no SMTP/Twilio credentials configured. Without this
       * the only copy is in the server's own terminal, so signing in on a
       * device meant reading the backend log.
       *
       * `delivery.dev` is set by the provider, not inferred here: production
       * always delivers for real, so the flag is never true there and the
       * field is simply absent.
       */
      ...(delivery?.dev && delivery.otp ? { devOtp: delivery.otp } : {}),
    };
  },

  /** Verifies the OTP from requestOtp and completes the same LOGIN/REGISTER purpose it was issued for. */
  async verifyOtp({ identifier, channel, purpose, otp, name, role }, meta = {}) {
    const destination = normalizeIdentifier(identifier, channel);

    await consumeOtp({ destination, channel, purpose, otp });

    if (purpose === 'LOGIN') {
      const user = await findByChannel(destination, channel);
      if (!user) throw new NotFoundError('Account no longer exists');
      assertUserActive(user);
      return issueAuthResult(user, meta);
    }

    // purpose === 'REGISTER' — re-check for a race where the identifier was claimed between send and verify.
    const existing = await findByChannel(destination, channel);
    if (existing) throw new ConflictError(`An account already exists with this ${labelFor(channel)}`);

    const resolvedRole = resolveSelfServeRole(role);
    const user = await userRepository.create({
      name: name || (channel === 'EMAIL' ? destination.split('@')[0] : 'Petza User'),
      email: channel === 'EMAIL' ? destination : null,
      phone: channel === 'SMS' ? destination : null,
      passwordHash: null,
      role: resolvedRole,
      status: 'ACTIVE',
    });

    return issueAuthResult(user, meta);
  },

  /**
   * Rotates a refresh token: the presented one is revoked and a new
   * access+refresh pair is issued, so a stolen refresh token only has one
   * use before it stops working for the legitimate owner too — which is
   * also the tell. If the presented token is already revoked (rotate has
   * already consumed it once), that's a replay of a token that's no longer
   * live; the whole chain for that user is killed rather than trusting it.
   */
  async refresh({ refreshToken }, meta = {}) {
    try {
      verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const stored = await refreshTokenRepository.findActiveByHash(hashToken(refreshToken));
    if (!stored) throw new UnauthorizedError('Invalid or expired refresh token');

    if (stored.revokedAt) {
      await refreshTokenRepository.revokeAllForUser(stored.userId);
      throw new UnauthorizedError('Session expired. Please log in again.');
    }

    if (stored.expiresAt < new Date()) throw new UnauthorizedError('Invalid or expired refresh token');

    const user = await userRepository.findById(stored.userId);
    if (!user) throw new UnauthorizedError('Account no longer exists');
    assertUserActive(user);

    const accessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user, randomUUID());

    await refreshTokenRepository.rotate({
      id: stored.id,
      replacedByHash: hashToken(newRefreshToken),
      newRow: {
        userId: user.id,
        tokenHash: hashToken(newRefreshToken),
        expiresAt: decodeExpiry(newRefreshToken),
        createdByIp: meta.ip ?? null,
      },
    });

    return { accessToken, refreshToken: newRefreshToken };
  },

  /** Idempotent by design — a client logging out with an already-expired or unknown token still ends up signed out locally, so this never errors. */
  async logout({ refreshToken }) {
    await refreshTokenRepository.revokeByHash(hashToken(refreshToken));
  },

  /** Signs every device out at once — the "I lost my phone" action. */
  async logoutAll(userId) {
    await refreshTokenRepository.revokeAllForUser(userId);
  },

  /**
   * Step 1 of "forgot password": sends a RESET_PASSWORD code. It is the same
   * OTP machinery as login — `requestOtp` handles hashing, TTL, the attempt
   * cap and the resend cooldown — so this only names the purpose.
   */
  async requestPasswordReset({ identifier, channel }) {
    return this.requestOtp({ identifier, channel, purpose: 'RESET_PASSWORD' });
  },

  /**
   * Step 2: the code proves ownership of the identifier, so it stands in for
   * the old password.
   *
   * Every existing session is revoked. A password reset is what someone does
   * when they think their account is compromised, so leaving whoever else is
   * signed in still signed in would defeat the point — the fresh pair
   * returned here is the only live session afterwards.
   */
  async resetPassword({ identifier, channel, otp, password }, meta = {}) {
    const destination = normalizeIdentifier(identifier, channel);

    await consumeOtp({ destination, channel, purpose: 'RESET_PASSWORD', otp });

    const user = await findByChannel(destination, channel);
    if (!user) throw new NotFoundError('Account no longer exists');
    assertUserActive(user);

    await userRepository.update(user, { passwordHash: await hashPassword(password) });
    await refreshTokenRepository.revokeAllForUser(user.id);

    return issueAuthResult(user, meta);
  },

  /**
   * Sets a password from inside the app. Doubles as "add a password" for an
   * OTP-only or Google account, which has none to confirm — hence the
   * conditional check rather than an unconditional one.
   *
   * Other sessions are revoked for the same reason a reset revokes them; the
   * caller gets a fresh pair so their own session survives the change.
   */
  async changePassword({ userId, currentPassword, newPassword }, meta = {}) {
    const user = await userRepository.findByIdWithPassword(userId);
    if (!user) throw new UnauthorizedError('Account no longer exists');
    assertUserActive(user);

    if (user.passwordHash) {
      if (!currentPassword) throw new BadRequestError('Your current password is required');
      const isMatch = await comparePassword(currentPassword, user.passwordHash);
      if (!isMatch) throw new UnauthorizedError('Current password is incorrect');
    }

    await userRepository.update(user, { passwordHash: await hashPassword(newPassword) });
    await refreshTokenRepository.revokeAllForUser(user.id);

    return issueAuthResult(user, meta);
  },
};
