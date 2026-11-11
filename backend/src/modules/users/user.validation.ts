import { z } from "zod";
import { USER_ROLES } from "./user.model";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");

/** Admin user creation (§7) — any of the 8 roles; there is no public self-registration (§4). */
export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  role: z.enum(USER_ROLES),
  isActive: z.boolean().optional(),
  isVerified: z.boolean().optional(),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(160).optional(),
  role: z.enum(USER_ROLES).optional(),
  isVerified: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const userStatusSchema = z.object({ isActive: z.boolean() });

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export { objectId };
