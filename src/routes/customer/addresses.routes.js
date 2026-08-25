import { Router } from 'express';

import { createAddress, deleteAddress, listAddresses, updateAddress } from '../../controllers/customer/address.controller.js';
import { validate } from '../../middleware/validate.js';
import { createAddressSchema, updateAddressSchema } from '../../validators/customer/address.validator.js';

export const customerAddressesRouter = Router();

customerAddressesRouter.get('/', listAddresses);
customerAddressesRouter.post('/', validate(createAddressSchema), createAddress);
customerAddressesRouter.patch('/:addressId', validate(updateAddressSchema), updateAddress);
customerAddressesRouter.delete('/:addressId', deleteAddress);
