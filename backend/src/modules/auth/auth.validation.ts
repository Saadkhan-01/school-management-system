
import { z } from "zod";
import { USER_ROLES } from "../users/user.model";
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const registerSchema = z.object({ name: z.string().min(2).max(120), email: z.string().email(), password: z.string().min(8, "Password must be at least 8 characters"), role: z.enum(USER_ROLES) });
export const forgotSchema = z.object({ email: z.string().email() });
export const resetSchema = z.object({ token: z.string().min(10), newPassword: z.string().min(8) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });
/**
 * Self-service profile update (§6, Phase 6). STRICT on purpose: any attempt to
 * smuggle `role`, `email`, `isActive` or `isVerified` through this endpoint is a
 * 422 — role changes are Admin-only (User Management), email is the login
 * identity and is not self-changeable here, and activation is an Admin action.
 */
export const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(120).optional(),
  phone: z.string().max(40).optional(),
}).strict().refine((o) => o.name !== undefined || o.phone !== undefined, { message: "Provide at least one field to update (name, phone)" });
