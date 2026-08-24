import { enquiryService } from '../../services/shared/enquiry.service.js';
import { sendSuccess } from '../../shared/response/sendResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/** "Message the seller" from a pet listing — opens or reopens the thread and posts the first message in one call. */
export const startEnquiry = asyncHandler(async (req, res) => {
  const data = await enquiryService.startFromCustomer({
    customerId: req.user.id,
    petListingId: req.body.petListingId,
    text: req.body.text,
  });
  sendSuccess(res, { statusCode: 201, message: 'Message sent', data });
});

export const listEnquiries = asyncHandler(async (req, res) => {
  const { items, meta } = await enquiryService.listForCustomer({ customerId: req.user.id, ...req.query });
  sendSuccess(res, { message: 'Conversations fetched successfully', data: items, meta });
});

export const getThread = asyncHandler(async (req, res) => {
  const data = await enquiryService.getThreadForCustomer({ id: req.params.id, customerId: req.user.id });
  sendSuccess(res, { message: 'Conversation fetched successfully', data });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const data = await enquiryService.sendFromCustomer({
    enquiryId: req.params.id,
    customerId: req.user.id,
    text: req.body.text,
  });
  sendSuccess(res, { statusCode: 201, message: 'Message sent', data });
});

export const markRead = asyncHandler(async (req, res) => {
  await enquiryService.markReadByCustomer({ enquiryId: req.params.id, customerId: req.user.id });
  sendSuccess(res, { message: 'Marked as read' });
});
