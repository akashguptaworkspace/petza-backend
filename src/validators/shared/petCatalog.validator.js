import { z } from 'zod';

import { PetType } from '../../config/constants.js';

/**
 * `petType` is optional: the app asks for the form before the partner has
 * picked one, because the pet-type dropdown is itself part of the common
 * section it gets back.
 */
export const formSchemaQuerySchema = z.object({
  petType: z.enum(Object.values(PetType)).optional(),
});
