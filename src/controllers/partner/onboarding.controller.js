import { partnerOnboardingService } from '../../services/partner/onboarding.service.js';
import { sendSuccess } from '../../shared/response/sendResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const getOnboarding = asyncHandler(async (req, res) => {
  const data = await partnerOnboardingService.getOnboarding(req.user.id);
  sendSuccess(res, { message: 'Onboarding state fetched successfully', data });
});

export const selectBusinessType = asyncHandler(async (req, res) => {
  const data = await partnerOnboardingService.selectBusinessType({
    userId: req.user.id,
    businessType: req.body.businessType,
  });
  sendSuccess(res, { message: 'Business type saved successfully', data });
});

export const submitKyc = asyncHandler(async (req, res) => {
  const data = await partnerOnboardingService.submitKyc(req.user.id, req.body);
  sendSuccess(res, { statusCode: 201, message: 'Details submitted for review', data });
});

export const getApprovalStatus = asyncHandler(async (req, res) => {
  const data = await partnerOnboardingService.getApprovalStatus(req.user.id);
  sendSuccess(res, { message: 'Approval status fetched successfully', data });
});
