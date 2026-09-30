import { z } from 'zod';
export const roles = [
  'PATIENT',
  'DOCTOR',
  'PHARMACY_ADMIN',
  'PHARMACY_STAFF',
  'PLATFORM_ADMIN',
] as const;
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const registerSchema = z
  .object({
    email: emailSchema,
    displayName: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[^\p{Cc}]+$/u),
    password: z.string().min(12).max(128),
  })
  .strict();
export const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1).max(128) })
  .strict();
export const refreshSchema = z
  .object({
    refreshToken: z
      .string()
      .regex(/^[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$/)
      .optional(),
  })
  .strict();
export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AuthError(
      400,
      'Invalid authentication input. Check the required fields and password length (12–128 characters for registration).',
    );
  return result.data;
}
