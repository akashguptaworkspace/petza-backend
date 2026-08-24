import { Router } from 'express';

import { getThread, listEnquiries, markRead, sendMessage, startEnquiry } from '../../controllers/customer/enquiry.controller.js';
import { validate } from '../../middleware/validate.js';
import {
  listCustomerEnquiriesQuerySchema,
  sendMessageSchema,
  startEnquirySchema,
} from '../../validators/shared/enquiry.validator.js';

/**
 * A customer's own conversations with sellers. Unlike the rest of the
 * customer surface (`/pets`, `/stores`), messaging is never open to a
 * guest — `authenticate` is applied at the mount point in
 * `routes/customer/index.js`, the same way `/partner` and `/admin` gate
 * themselves once rather than per route file.
 */
export const customerEnquiriesRouter = Router();

/** "Message the seller" from a pet listing — opens or reopens the thread. */
customerEnquiriesRouter.post('/', validate(startEnquirySchema), startEnquiry);
customerEnquiriesRouter.get('/', validate(listCustomerEnquiriesQuerySchema, 'query'), listEnquiries);
customerEnquiriesRouter.get('/:id', getThread);
customerEnquiriesRouter.post('/:id/messages', validate(sendMessageSchema), sendMessage);
customerEnquiriesRouter.patch('/:id/read', markRead);
