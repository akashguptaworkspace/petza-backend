import { z } from 'zod';

import { BusinessType } from '../../config/constants.js';

/**
 * Mirrors petza-partner's `SignupRole` union exactly — three business
 * types, no PET_SHOP (a pet shop signs up as a KENNEL; see
 * config/constants.js).
 */
const businessType = z.enum(Object.values(BusinessType));

export const selectBusinessTypeSchema = z.object({
  businessType,
});

/** The app picks documents off the device, so `uri` is a local/remote file URI until the media-upload pipeline lands. */
const kycDocument = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(255),
  uri: z.string().trim().min(1),
});

/** `yearsActive`, `experienceYears` and `travelRadiusKm` arrive as strings (text inputs) and are parsed to integers in the service. */
const numericText = z.string().trim().max(10).regex(/^\d*$/, 'Must be a number').optional();

const kycBase = {
  ownerName: z.string().trim().min(1, 'Owner name is required').max(120),
  city: z.string().trim().min(1, 'City is required').max(120),
  documents: z.array(kycDocument).max(20).default([]),
};

/**
 * One schema per business type, discriminated on `role` — a vet must not
 * be able to submit a kennel's fields, and each type's required fields are
 * genuinely different, so a single merged schema with everything optional
 * would validate nothing.
 */
export const submitKycSchema = z.discriminatedUnion('role', [
  z.object({
    ...kycBase,
    role: z.literal(BusinessType.KENNEL),
    kennelName: z.string().trim().min(1, 'Kennel name is required').max(160),
    yearsActive: numericText,
    registrationNumber: z.string().trim().max(60).optional(),
    pincode: z.string().trim().max(10).optional(),
    breeds: z.array(z.string().trim().min(1)).max(30).default([]),
  }),
  z.object({
    ...kycBase,
    role: z.literal(BusinessType.VET),
    clinicName: z.string().trim().min(1, 'Clinic name is required').max(160),
    councilRegistrationNumber: z.string().trim().max(60).optional(),
    services: z.array(z.string().trim().min(1)).max(30).default([]),
  }),
  z.object({
    ...kycBase,
    role: z.literal(BusinessType.SUPPLIER),
    storeName: z.string().trim().min(1, 'Store name is required').max(160),
    /** A trading business is verified on its GST registration rather than a professional licence. */
    gstNumber: z.string().trim().max(20).optional(),
    warehouseCity: z.string().trim().max(120).optional(),
    brandsStocked: z.array(z.string().trim().min(1)).max(50).default([]),
    categories: z.array(z.string().trim().min(1)).max(20).default([]),
    shipsNationwide: z.boolean().default(false),
  }),
  z.object({
    ...kycBase,
    role: z.literal(BusinessType.GROOMER),
    salonName: z.string().trim().min(1, 'Business name is required').max(160),
    experienceYears: numericText,
    /** A mobile groomer travels to the pet; a salon does not. */
    isMobile: z.boolean().default(false),
    services: z.array(z.string().trim().min(1)).max(30).default([]),
    petTypes: z.array(z.string().trim().min(1)).max(10).default([]),
  }),
  z.object({
    ...kycBase,
    role: z.literal(BusinessType.TRAINER),
    businessName: z.string().trim().min(1, 'Business name is required').max(160),
    experienceYears: numericText,
    certificationBody: z.string().trim().max(60).optional(),
    certificationNumber: z.string().trim().max(60).optional(),
    baseArea: z.string().trim().max(120).optional(),
    travelRadiusKm: numericText,
    trainingOffered: z.array(z.string().trim().min(1)).max(30).default([]),
  }),
]);
