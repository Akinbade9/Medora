import { z } from 'zod';

export const normalizeText = (value: string) =>
  value.trim().replace(/\s+/g, ' ');
const label = (max: number) =>
  z
    .string()
    .transform(normalizeText)
    .pipe(
      z
        .string()
        .min(1)
        .max(max)
        .regex(/^[^\p{Cc}]+$/u),
    );
export const objectId = z.string().regex(/^[a-f\d]{24}$/i);
export const statuses = ['ACTIVE', 'INACTIVE'] as const;
export const medicineInput = z
  .object({
    genericName: label(160),
    activeIngredient: label(200),
    strength: z.number().positive().finite().max(1_000_000),
    strengthUnit: label(30),
    dosageForm: label(80),
    category: label(100),
    status: z.enum(statuses).optional(),
  })
  .strict();
export const productInput = z
  .object({
    medicineId: objectId,
    brandName: label(160),
    manufacturer: label(160),
    packSize: label(80),
    productCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{1,79}$/),
    status: z.enum(statuses).optional(),
  })
  .strict();
export const medicinePatch = medicineInput
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const productPatch = productInput
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const pagination = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export const searchInput = pagination.extend({ q: label(100) });
