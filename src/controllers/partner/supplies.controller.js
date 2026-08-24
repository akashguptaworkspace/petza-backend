import { partnerSuppliesService } from '../../services/partner/supplies.service.js';
import { getPagination } from '../../shared/pagination/paginate.js';
import { sendSuccess } from '../../shared/response/sendResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/** The store always comes from the session (`requireCapability` resolved it) — never from the request body. */
const storeIdOf = (req) => req.store.id;

export const getOverview = asyncHandler(async (req, res) => {
  const data = await partnerSuppliesService.getOverview(storeIdOf(req));
  sendSuccess(res, { message: 'Supplies overview fetched successfully', data });
});

export const listProducts = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { data, meta } = await partnerSuppliesService.listProducts({
    storeId: storeIdOf(req),
    status: req.query.status,
    categorySlug: req.query.category,
    search: req.query.q,
    page,
    limit,
    offset,
  });
  sendSuccess(res, { message: 'Products fetched successfully', data, meta });
});

export const getProduct = asyncHandler(async (req, res) => {
  const data = await partnerSuppliesService.getProduct({ storeId: storeIdOf(req), id: req.params.id });
  sendSuccess(res, { message: 'Product fetched successfully', data });
});

export const createProduct = asyncHandler(async (req, res) => {
  const data = await partnerSuppliesService.createProduct({ storeId: storeIdOf(req), payload: req.body });
  sendSuccess(res, { statusCode: 201, message: 'Product created successfully', data });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const data = await partnerSuppliesService.updateProduct({
    storeId: storeIdOf(req),
    id: req.params.id,
    payload: req.body,
  });
  sendSuccess(res, { message: 'Product updated successfully', data });
});

export const setProductStatus = asyncHandler(async (req, res) => {
  const data = await partnerSuppliesService.setProductStatus({
    storeId: storeIdOf(req),
    id: req.params.id,
    status: req.body.status,
  });
  sendSuccess(res, { message: 'Product status updated successfully', data });
});

export const listStock = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { data, meta } = await partnerSuppliesService.listStock({
    storeId: storeIdOf(req),
    mode: req.query.mode,
    page,
    limit,
    offset,
  });
  sendSuccess(res, { message: 'Inventory fetched successfully', data, meta });
});

export const adjustStock = asyncHandler(async (req, res) => {
  const data = await partnerSuppliesService.adjustStock({
    storeId: storeIdOf(req),
    variantId: req.params.variantId,
    ...req.body,
  });
  sendSuccess(res, { message: 'Stock updated successfully', data });
});
