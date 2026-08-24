import { partnerStoreService } from '../../services/partner/store.service.js';
import { sendSuccess } from '../../shared/response/sendResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const updateCapabilities = asyncHandler(async (req, res) => {
  const data = await partnerStoreService.updateCapabilities({
    userId: req.user.id,
    capabilities: req.body.capabilities,
  });
  sendSuccess(res, { message: 'Capabilities updated successfully', data });
});
