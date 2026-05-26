import { z } from 'zod';

const MAX_STRING = 500;
const MIN_YEAR = -3000;
const MAX_YEAR = new Date().getUTCFullYear() + 5;

const trimmedString = (max = MAX_STRING) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max);

const isbnInput = z
  .string()
  .transform((v, ctx) => {
    const stripped = v.replace(/[\s-]/g, '');
    if (stripped.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'isbn must not be blank' });
      return z.NEVER;
    }
    if (!/^[0-9Xx]{10}$|^[0-9]{13}$/.test(stripped)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'isbn must be a valid ISBN-10 or ISBN-13',
      });
      return z.NEVER;
    }
    return stripped.toUpperCase();
  });

export const BookCreateSchema = z
  .object({
    title: trimmedString(),
    author: trimmedString(),
    isbn: isbnInput.optional(),
    publishedYear: z.number().int().min(MIN_YEAR).max(MAX_YEAR).optional(),
    genre: trimmedString().optional(),
    available: z.boolean().default(true),
  })
  .strict();

export const BookReplaceSchema = BookCreateSchema;

export const BookPatchSchema = z
  .object({
    title: trimmedString().optional(),
    author: trimmedString().optional(),
    isbn: isbnInput.optional(),
    publishedYear: z.number().int().min(MIN_YEAR).max(MAX_YEAR).optional(),
    genre: trimmedString().optional(),
    available: z.boolean().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'Patch body must contain at least one field',
  });

export const BookSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  author: z.string(),
  isbn: z.string().optional(),
  publishedYear: z.number().int().optional(),
  genre: z.string().optional(),
  available: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const BookListQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  author: z.string().min(1).optional(),
  genre: z.string().min(1).optional(),
  available: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const BookListResponseSchema = z.object({
  total: z.number().int().min(0),
  offset: z.number().int().min(0),
  limit: z.number().int().min(1),
  items: z.array(BookSchema),
});

export const BookIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const ErrorResponseSchema = z.object({
  error: z.object({
    status: z.number().int(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type Book = z.infer<typeof BookSchema>;
export type BookCreate = z.infer<typeof BookCreateSchema>;
export type BookReplace = z.infer<typeof BookReplaceSchema>;
export type BookPatch = z.infer<typeof BookPatchSchema>;
export type BookListQuery = z.infer<typeof BookListQuerySchema>;
export type BookListResponse = z.infer<typeof BookListResponseSchema>;
