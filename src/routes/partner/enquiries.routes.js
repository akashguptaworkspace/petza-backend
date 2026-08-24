import { Router } from 'express';

import {
  getThread,
  listEnquiries,
  markEnquiryRead,
  replyToEnquiry,
  updateEnquiryStatus,
} from '../../controllers/partner/enquiry.controller.js';
import { validate } from '../../middleware/validate.js';
import {
  listEnquiriesQuerySchema,
  sendMessageSchema,
  updateEnquiryStatusSchema,
} from '../../validators/shared/enquiry.validator.js';

/**
 * A store's inbox — every customer conversation about its listings.
 *
 * Mounted under `/pets` (see `routes/partner/pets.routes.js`), so this
 * inherits that router's `requireCapability('SELL_PETS')`: only a store
 * that sells pets has an inbox to read, matching petza-partner's own
 * `Endpoints.pets.enquiries` path.
 */
export const partnerEnquiriesRouter = Router();

partnerEnquiriesRouter.get('/', validate(listEnquiriesQuerySchema, 'query'), listEnquiries);
partnerEnquiriesRouter.get('/:id', getThread);
partnerEnquiriesRouter.post('/:id/messages', validate(sendMessageSchema), replyToEnquiry);
partnerEnquiriesRouter.patch('/:id/read', markEnquiryRead);
partnerEnquiriesRouter.patch('/:id/status', validate(updateEnquiryStatusSchema), updateEnquiryStatus);
