import { z } from "zod";
import { APPOINTMENT_STATUSES } from "./appointment.model";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");

export const appointmentCreateSchema = z.object({
  visitorName: z.string().trim().min(3).max(160),
  visitorPhone: z.string().trim().max(40).optional(),
  visitorEmail: z.string().trim().email().max(160).optional(),
  purpose: z.string().trim().min(3).max(500),
  scheduledAt: z.coerce.date(),
  durationMinutes: z.number().int().min(5).max(480),
  staffToMeet: objectId,
  note: z.string().trim().max(1000).optional(),
});
export const appointmentUpdateSchema = appointmentCreateSchema.partial();
export const appointmentStatusSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES),
  note: z.string().trim().max(1000).optional(),
});
