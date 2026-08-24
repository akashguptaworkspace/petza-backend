import { petCatalogService } from '../../services/partner/petCatalog.service.js';
import { sendSuccess } from '../../shared/response/sendResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const getFormSchema = asyncHandler(async (req, res) => {
  const data = await petCatalogService.getFormSchema(req.query.petType);
  sendSuccess(res, { message: 'Pet form schema fetched successfully', data });
});
