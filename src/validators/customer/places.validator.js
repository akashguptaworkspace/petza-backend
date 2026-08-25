import { z } from 'zod';

/** Mirrors the app's own guard (LocationSheet doesn't fire a search below 2 characters) so a stray 1-character request never reaches Google. */
export const searchPlacesQuerySchema = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters').max(80),
});
