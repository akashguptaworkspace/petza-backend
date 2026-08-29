import { Router } from 'express';

import {
  getApprovalStatus,
  getOnboarding,
  selectCapabilities,
  submitKyc,
} from '../../controllers/partner/onboarding.controller.js';
import { validate } from '../../middleware/validate.js';
import { selectCapabilitiesSchema, submitKycSchema } from '../../validators/partner/onboarding.validator.js';

/**
 * Everything between "verified my OTP" and "my dashboard opens".
 *
 * Mounted under /partner, which routes/index.js already wraps in
 * `authenticate` + `authorize(Context.PARTNER)` — every route here runs
 * against a real session, so none of them takes a userId or storeId from
 * the client. The pre-session steps (send OTP, verify OTP) are not here:
 * they are the shared /auth/otp/* endpoints with purpose=REGISTER and
 * role=PARTNER, so partner signup and customer signup mint accounts
 * through exactly one code path.
 */
export const partnerOnboardingRouter = Router();

partnerOnboardingRouter.get('/', getOnboarding);
partnerOnboardingRouter.post('/capabilities', validate(selectCapabilitiesSchema), selectCapabilities);
partnerOnboardingRouter.post('/kyc', validate(submitKycSchema), submitKyc);
partnerOnboardingRouter.get('/approval-status', getApprovalStatus);
