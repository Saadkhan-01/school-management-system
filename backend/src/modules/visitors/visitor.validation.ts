
import { z } from "zod";
export const visitorCreateSchema = z.object({ name: z.string().trim().min(2).max(120), phone: z.string().trim().min(5).max(30), purpose: z.string().trim().min(2).max(200), visitingWhom: z.string().trim().min(2).max(120), checkInAt: z.coerce.date().optional(), note: z.string().trim().max(300).optional() });
export const checkoutSchema = z.object({ checkOutAt: z.coerce.date().optional() });
