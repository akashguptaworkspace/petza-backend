import { addressService } from '../../services/customer/address.service.js';
import { sendSuccess } from '../../shared/response/sendResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const listAddresses = asyncHandler(async (req, res) => {
  const data = await addressService.listForUser(req.user.id);
  sendSuccess(res, { message: 'Addresses fetched successfully', data });
});

export const createAddress = asyncHandler(async (req, res) => {
  const data = await addressService.create(req.user.id, req.body);
  sendSuccess(res, { statusCode: 201, message: 'Address saved successfully', data });
});

export const updateAddress = asyncHandler(async (req, res) => {
  const data = await addressService.update(req.user.id, req.params.addressId, req.body);
  sendSuccess(res, { message: 'Address updated successfully', data });
});

export const deleteAddress = asyncHandler(async (req, res) => {
  const data = await addressService.remove(req.user.id, req.params.addressId);
  sendSuccess(res, { message: 'Address removed successfully', data });
});
