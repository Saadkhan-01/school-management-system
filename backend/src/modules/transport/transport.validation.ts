
import { z } from "zod";
const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");
export const busCreateSchema = z.object({ name: z.string().trim().min(2).max(120), registrationNumber: z.string().trim().min(2).max(40), capacity: z.number().int().min(1).max(200), driverName: z.string().trim().min(2).max(120), driverPhone: z.string().trim().min(5).max(30), insuranceExpiry: z.coerce.date().optional(), registrationExpiry: z.coerce.date().optional(), fitnessExpiry: z.coerce.date().optional(), isActive: z.boolean().optional() });
export const busUpdateSchema = busCreateSchema.partial().refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
export const routeCreateSchema = z.object({ name: z.string().trim().min(2).max(120), stops: z.array(z.string().trim().min(1).max(120)).min(1).max(60) });
export const routeUpdateSchema = routeCreateSchema.partial().refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
export const allocationCreateSchema = z.object({ studentId: objectId, routeId: objectId, busId: objectId, stop: z.string().trim().min(1).max(120), sessionId: objectId });
export const maintenanceCreateSchema = z.object({ busId: objectId, date: z.coerce.date(), type: z.string().trim().min(2).max(80), cost: z.number().int().min(0).max(1_000_000_000_000), note: z.string().trim().max(500).optional() });
export const expiringQuerySchema = z.object({ days: z.coerce.number().int().min(0).max(365).optional() }).passthrough();
