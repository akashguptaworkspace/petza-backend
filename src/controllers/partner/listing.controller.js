import { partnerListingService } from '../../services/partner/listing.service.js';
import { sendSuccess } from '../../shared/response/sendResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * The store always comes from the session — `requireCapability` resolved
 * it onto `req.store` — never from the request body. A partner cannot
 * write into someone else's catalogue by sending a storeId.
 */

export const getCategories = asyncHandler(async (req, res) => {
  const data = await partnerListingService.getCategories(req.query.type);
  sendSuccess(res, { message: 'Categories fetched successfully', data });
});

// -------------------------------------------------------------------- products

export const listProducts = asyncHandler(async (req, res) => {
  const data = await partnerListingService.listProducts({ storeId: req.store.id, ...req.query });
  sendSuccess(res, { message: 'Listings fetched successfully', data });
});

export const getProduct = asyncHandler(async (req, res) => {
  const data = await partnerListingService.getProduct({ storeId: req.store.id, id: req.params.id });
  sendSuccess(res, { message: 'Listing fetched successfully', data });
});

export const createProduct = asyncHandler(async (req, res) => {
  const data = await partnerListingService.createProduct({ storeId: req.store.id, payload: req.body });
  sendSuccess(res, { statusCode: 201, message: 'Listing created successfully', data });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const data = await partnerListingService.updateProduct({
    storeId: req.store.id,
    id: req.params.id,
    payload: req.body,
  });
  sendSuccess(res, { message: 'Listing updated successfully', data });
});

export const setProductStatus = asyncHandler(async (req, res) => {
  const data = await partnerListingService.setProductStatus({
    storeId: req.store.id,
    id: req.params.id,
    status: req.body.status,
  });
  sendSuccess(res, { message: 'Listing status updated successfully', data });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const data = await partnerListingService.deleteProduct({ storeId: req.store.id, id: req.params.id });
  sendSuccess(res, { message: 'Listing deleted successfully', data });
});

// -------------------------------------------------------------------- services

export const listServices = asyncHandler(async (req, res) => {
  const data = await partnerListingService.listServices({ storeId: req.store.id, ...req.query });
  sendSuccess(res, { message: 'Services fetched successfully', data });
});

export const getService = asyncHandler(async (req, res) => {
  const data = await partnerListingService.getService({ storeId: req.store.id, id: req.params.id });
  sendSuccess(res, { message: 'Service fetched successfully', data });
});

export const createService = asyncHandler(async (req, res) => {
  const data = await partnerListingService.createService({ storeId: req.store.id, payload: req.body });
  sendSuccess(res, { statusCode: 201, message: 'Service created successfully', data });
});

export const updateService = asyncHandler(async (req, res) => {
  const data = await partnerListingService.updateService({
    storeId: req.store.id,
    id: req.params.id,
    payload: req.body,
  });
  sendSuccess(res, { message: 'Service updated successfully', data });
});

export const setServiceStatus = asyncHandler(async (req, res) => {
  const data = await partnerListingService.setServiceStatus({
    storeId: req.store.id,
    id: req.params.id,
    status: req.body.status,
  });
  sendSuccess(res, { message: 'Service status updated successfully', data });
});

export const deleteService = asyncHandler(async (req, res) => {
  const data = await partnerListingService.deleteService({ storeId: req.store.id, id: req.params.id });
  sendSuccess(res, { message: 'Service deleted successfully', data });
});
