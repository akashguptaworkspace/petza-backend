import { partnerCommerceService } from '../../services/partner/commerce.service.js';
import { partnerWalletService } from '../../services/partner/wallet.service.js';
import { sendSuccess } from '../../shared/response/sendResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/** The store always comes from the session (`req.store`) — never from the request body. */

export const getDashboard = asyncHandler(async (req, res) => {
  const data = await partnerCommerceService.getDashboard(req.store);
  sendSuccess(res, { message: 'Dashboard fetched successfully', data });
});

// ------------------------------------------------------------------- orders

export const listOrders = asyncHandler(async (req, res) => {
  const data = await partnerCommerceService.listOrders({ storeId: req.store.id, ...req.query });
  sendSuccess(res, { message: 'Orders fetched successfully', data });
});

export const getOrder = asyncHandler(async (req, res) => {
  const data = await partnerCommerceService.getOrder({ storeId: req.store.id, id: req.params.id });
  sendSuccess(res, { message: 'Order fetched successfully', data });
});

export const setOrderStatus = asyncHandler(async (req, res) => {
  const data = await partnerCommerceService.setOrderStatus({
    storeId: req.store.id,
    id: req.params.id,
    status: req.body.status,
    reason: req.body.reason,
  });
  sendSuccess(res, { message: 'Order updated successfully', data });
});

// ----------------------------------------------------------------- bookings

export const listBookings = asyncHandler(async (req, res) => {
  const data = await partnerCommerceService.listBookings({ storeId: req.store.id, ...req.query });
  sendSuccess(res, { message: 'Bookings fetched successfully', data });
});

export const getBooking = asyncHandler(async (req, res) => {
  const data = await partnerCommerceService.getBooking({ storeId: req.store.id, id: req.params.id });
  sendSuccess(res, { message: 'Booking fetched successfully', data });
});

export const setBookingStatus = asyncHandler(async (req, res) => {
  const data = await partnerCommerceService.setBookingStatus({
    storeId: req.store.id,
    id: req.params.id,
    status: req.body.status,
    reason: req.body.reason,
  });
  sendSuccess(res, { message: 'Booking updated successfully', data });
});

export const rescheduleBooking = asyncHandler(async (req, res) => {
  const data = await partnerCommerceService.rescheduleBooking({
    storeId: req.store.id,
    id: req.params.id,
    scheduledAt: req.body.scheduledAt,
  });
  sendSuccess(res, { message: 'Booking rescheduled successfully', data });
});

// ------------------------------------------------------------------- wallet

export const getWalletSummary = asyncHandler(async (req, res) => {
  const data = await partnerWalletService.getSummary(req.store.id);
  sendSuccess(res, { message: 'Wallet fetched successfully', data });
});

export const listTransactions = asyncHandler(async (req, res) => {
  const data = await partnerWalletService.listTransactions({ storeId: req.store.id, ...req.query });
  sendSuccess(res, { message: 'Transactions fetched successfully', data });
});

export const listPayoutAccounts = asyncHandler(async (req, res) => {
  const data = await partnerWalletService.listPayoutAccounts(req.store.id);
  sendSuccess(res, { message: 'Payout accounts fetched successfully', data });
});

export const addPayoutAccount = asyncHandler(async (req, res) => {
  const data = await partnerWalletService.addPayoutAccount({ storeId: req.store.id, payload: req.body });
  sendSuccess(res, { statusCode: 201, message: 'Payout account added successfully', data });
});

export const requestWithdrawal = asyncHandler(async (req, res) => {
  const data = await partnerWalletService.requestWithdrawal({
    storeId: req.store.id,
    amountInInr: req.body.amountInInr,
  });
  sendSuccess(res, { statusCode: 201, message: 'Withdrawal requested successfully', data });
});
