
import { z } from "zod";
const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");
export const categoryCreateSchema = z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).optional() });
export const categoryUpdateSchema = categoryCreateSchema.partial().refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
export const supplierCreateSchema = z.object({ name: z.string().trim().min(2).max(160), contactName: z.string().trim().max(120).optional(), phone: z.string().trim().max(30).optional(), email: z.string().trim().email().max(160).optional(), address: z.string().trim().max(300).optional() });
export const supplierUpdateSchema = supplierCreateSchema.partial().refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
export const itemCreateSchema = z.object({ name: z.string().trim().min(2).max(160), categoryId: objectId, unit: z.string().trim().min(1).max(30).optional(), lowStockThreshold: z.number().int().min(0).max(1_000_000).optional() });
export const itemUpdateSchema = z.object({ name: z.string().trim().min(2).max(160).optional(), categoryId: objectId.optional(), unit: z.string().trim().min(1).max(30).optional(), lowStockThreshold: z.number().int().min(0).max(1_000_000).optional() }).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
/** quantity is SIGNED: positive for purchase/received/return-in, negative effect for issued is expressed as type=issued with positive quantity (service negates); adjustment may be either sign but never zero. Negative raw quantities are rejected except for adjustments. */
export const transactionCreateSchema = z.object({ itemId: objectId, type: z.enum(["purchase","received","issued","adjustment","return"]), quantity: z.number().int(), supplierId: objectId.optional(), reference: z.string().trim().max(120).optional(), note: z.string().trim().max(500).optional() })
  .refine((v) => v.quantity !== 0, { message: "Quantity cannot be zero" })
  .refine((v) => v.type === "adjustment" || v.quantity > 0, { message: "Quantity must be positive for purchase/received/issued/return (use adjustment for signed corrections)" });
