import { z } from 'zod';

import { BusinessType, KycDocType, PartnerCapability } from '../../config/constants.js';

/**
 * "What do you want to offer on Petza?" — the signup capability screen
 * (PRODUCT_CONTEXT.md §3). At least one, at most both.
 *
 * There is no way to express turning a capability *off*, here or anywhere
 * else: doing so would orphan live bookings and in-flight orders, so the
 * service refuses it and the schema has no shape for it.
 */
export const selectCapabilitiesSchema = z.object({
  capabilities: z.array(z.enum(Object.values(PartnerCapability))).min(1, 'Choose at least one').max(2),
});

/** The app picks documents off the device, so `uri` is a local/remote file URI until the media-upload pipeline lands. */
const kycDocument = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(255),
  uri: z.string().trim().min(1),
  /** What the upload proves — decides which slot it fills on the KYC screen and what staff check it against. */
  docType: z.enum(Object.values(KycDocType)).default(KycDocType.OTHER),
});

/**
 * One KYC form for every partner.
 *
 * This used to be a discriminated union of five schemas, one per business
 * type, because a vet's required fields genuinely differed from a
 * kennel's. Those differences turned out to be per-*listing* facts — a
 * vet's specialisations, a groomer's coat types — and they now live in
 * each category's `category_attributes` (§4), where admin can add to them
 * without a migration or a release. What is left is the set of things
 * every business has: a name, an owner, an address, and proof of both.
 *
 * `businessType` is still asked, but it now only tells staff what
 * paperwork to expect. It decides nothing about navigation.
 */
export const submitKycSchema = z.object({
  businessName: z.string().trim().min(1, 'Business name is required').max(160),
  businessType: z.enum(Object.values(BusinessType)),
  ownerName: z.string().trim().min(1, 'Owner name is required').max(120),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().min(1, 'City is required').max(120),
  state: z.string().trim().max(120).optional(),
  pincode: z.string().trim().max(12).optional(),
  documents: z.array(kycDocument).max(20).default([]),
});
