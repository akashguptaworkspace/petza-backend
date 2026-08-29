import { partnerStoreService } from '../../services/partner/store.service.js';
import { sendSuccess } from '../../shared/response/sendResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const enableCapabilities = asyncHandler(async (req, res) => {
  const data = await partnerStoreService.enableCapabilities({
    userId: req.user.id,
    capabilities: req.body.capabilities,
  });
  sendSuccess(res, { message: 'Your business has been expanded', data });
});
