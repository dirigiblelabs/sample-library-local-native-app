import { z } from 'zod';

export const LibrarySchema = z
  .object({
    address: z.string(),
    phoneNumber: z.string(),
  })
  .strict();

export type Library = z.infer<typeof LibrarySchema>;
