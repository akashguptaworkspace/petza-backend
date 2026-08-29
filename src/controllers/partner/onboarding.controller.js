import { partnerOnboardingService } from '../../services/partner/onboarding.service.js';
import { sendSuccess } from '../../shared/response/sendResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const getOnboarding = asyncHandler(async (req, res) => {
  const data = await partnerOnboardingService.getOnboarding(req.user.id);
  sendSuccess(res, { message: 'Onboarding state fetched successfully', data });
});

export const selectCapabilities = asyncHandler(async (req, res) => {
  const data = await partnerOnboardingService.selectCapabilities({
    userId: req.user.id,
    capabilities: req.body.capabilities,
  });
  sendSuccess(res, { message: 'Saved what you offer on Petza', data });
});

export const submitKyc = asyncHandler(async (req, res) => {
  const data = await partnerOnboardingService.submitKyc(req.user.id, req.body);
  sendSuccess(res, { statusCode: 201, message: 'Business details saved successfully', data });
});

export const getApprovalStatus = asyncHandler(async (req, res) => {
  const data = await partnerOnboardingService.getApprovalStatus(req.user.id);
  sendSuccess(res, { message: 'Approval status fetched successfully', data });
});
