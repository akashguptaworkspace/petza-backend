import { placesService } from '../../services/customer/places.service.js';
import { sendSuccess } from '../../shared/response/sendResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/** Autocomplete for the location picker — cities and states. `q` is validated (>= 2 chars) before this runs. */
export const searchPlaces = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const data = await placesService.searchPlaces(q);
  sendSuccess(res, { message: 'Cities fetched successfully', data });
});
