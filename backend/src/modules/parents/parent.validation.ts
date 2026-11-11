import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");
const optStr = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/**
 * Create a parent: either attach a profile to an existing parent-role user
 * (`userId`), or create the login account and profile together
 * (`name` + `email` + `password`). Admin-created accounts are verified (§4:
 * parent accounts are created/linked by the school, never self-registered).
 */
export const parentCreateSchema = z.object({
  userId: objectId.optional(),
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(160).optional(),
  password: z.string().min(8).max(200).optional(),
  phone: optStr(40),
  alternatePhone: optStr(40),
  address: optStr(500),
  city: optStr(120),
  occupation: optStr(120),
  relationNote: optStr(500),
}).refine((v) => Boolean(v.userId) || Boolean(v.name && v.email && v.password), {
  message: "Provide either userId (existing parent account) or name + email + password (new account)",
});

export const parentUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: optStr(40),
  alternatePhone: optStr(40),
  address: optStr(500),
  city: optStr(120),
  occupation: optStr(120),
  relationNote: optStr(500),
}).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const parentLinkSchema = z.object({
  studentId: objectId,
  relationship: z.string().trim().min(2).max(60).optional(),
  isPrimaryContact: z.boolean().optional(),
  /** Admin-created links default to verified; an unverified link grants no access. */
  verified: z.boolean().optional(),
});
