import { z } from 'zod';
import { objectId } from '../catalogue/validation.js';

export const substitutionRules = [
  'GENERIC_ALLOWED',
  'BRAND_SPECIFIC',
  'DO_NOT_SUBSTITUTE',
] as const;
export const prescriptionStatuses = [
  'ISSUED',
  'VIEWED',
  'CANCELLED',
  'EXPIRED',
] as const;
const description = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[^\p{Cc}]+$/u);
const medicationInput = z
  .object({
    medicineId: objectId,
    medicineProductId: objectId.optional(),
    strength: z.number().positive().finite().optional(),
    dosageForm: description(80).optional(),
    quantity: z.number().int().min(1).max(100000),
    dosageInstructions: description(2000),
    frequency: description(200),
    duration: description(200),
    substitutionRule: z.enum(substitutionRules),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.substitutionRule === 'BRAND_SPECIFIC' && !value.medicineProductId)
      ctx.addIssue({
        code: 'custom',
        message: 'Brand-specific medication requires a product',
      });
    if (value.substitutionRule === 'GENERIC_ALLOWED' && value.medicineProductId)
      ctx.addIssue({
        code: 'custom',
        message: 'Generic medication must not lock a product',
      });
  });
export const issueInput = z
  .object({
    patientId: objectId,
    expiresAt: z.iso.datetime({ offset: true }).optional(),
    medications: z.array(medicationInput).min(1).max(50),
  })
  .strict();
export const cancelInput = z
  .object({ cancellationReason: description(1000) })
  .strict();
export type IssueInput = z.infer<typeof issueInput>;
