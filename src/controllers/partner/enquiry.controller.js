import { enquiryService } from '../../services/shared/enquiry.service.js';
import { sendSuccess } from '../../shared/response/sendResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const listEnquiries = asyncHandler(async (req, res) => {
  const { items, meta } = await enquiryService.listForStore({ storeId: req.store.id, ...req.query });
  sendSuccess(res, { message: 'Enquiries fetched successfully', data: items, meta });
});

export const getThread = asyncHandler(async (req, res) => {
  const data = await enquiryService.getThreadForStore({ id: req.params.id, storeId: req.store.id });
  sendSuccess(res, { message: 'Conversation fetched successfully', data });
});

export const replyToEnquiry = asyncHandler(async (req, res) => {
  const data = await enquiryService.replyFromPartner({
    enquiryId: req.params.id,
    storeId: req.store.id,
    // The signed-in user, never the body — the same rule `req.store.id` follows.
    senderId: req.user.id,
    text: req.body.text,
  });
  sendSuccess(res, { statusCode: 201, message: 'Message sent', data });
});

export const markEnquiryRead = asyncHandler(async (req, res) => {
  const data = await enquiryService.markReadByPartner({ enquiryId: req.params.id, storeId: req.store.id });
  sendSuccess(res, { message: 'Marked as read', data });
});

export const updateEnquiryStatus = asyncHandler(async (req, res) => {
  const data = await enquiryService.updateStatusForStore({
    enquiryId: req.params.id,
    storeId: req.store.id,
    status: req.body.status,
  });
  sendSuccess(res, { message: 'Status updated', data });
});
