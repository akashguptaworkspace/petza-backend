import { z } from 'zod';

const addressType = z.enum(['HOME', 'WORK', 'OTHER', 'PARENTS_HOME']);

const addressPayload = {
  type: addressType.default('HOME'),
  fullName: z.string().trim().min(2).max(120),
  mobileNumber: z.string().trim().min(7).max(20),
  pincode: z.string().trim().min(4).max(12),
  addressLine: z.string().trim().min(5).max(240),
  landmark: z.string().trim().max(160).optional().nullable(),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(80).default('India'),
  isDefault: z.coerce.boolean().optional().default(false),
};

export const createAddressSchema = z.object(addressPayload);

export const updateAddressSchema = z
  .object({
    type: addressType.optional(),
    fullName: z.string().trim().min(2).max(120).optional(),
    mobileNumber: z.string().trim().min(7).max(20).optional(),
    pincode: z.string().trim().min(4).max(12).optional(),
    addressLine: z.string().trim().min(5).max(240).optional(),
    landmark: z.string().trim().max(160).optional().nullable(),
    city: z.string().trim().min(2).max(120).optional(),
    state: z.string().trim().min(2).max(120).optional(),
    country: z.string().trim().min(2).max(80).optional(),
    isDefault: z.coerce.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
  message: 'At least one address field is required',
  });
