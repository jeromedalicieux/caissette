import { z } from 'zod'

/** Zod schema for a non-empty trimmed string */
export const nonEmptyString = z.string().trim().min(1)

/** Zod schema for SIRET (14 digits) */
export const siretSchema = z.string().regex(/^\d{14}$/, 'SIRET must be 14 digits')

/** Zod schema for French phone number */
export const frenchPhoneSchema = z
  .string()
  .regex(/^(?:\+33|0)[1-9](?:\d{8})$/, 'Invalid French phone number')

/** Zod schema for email */
export const emailSchema = z.string().email()

/** Zod schema for amount in cents (positive integer) */
export const centsSchema = z.number().int().nonnegative()

/** Zod schema for basis points (positive integer) */
export const bpsSchema = z.number().int().min(0).max(10000)

/** Zod schema for UUID v7 format */
export const uuidSchema = z.string().uuid()
