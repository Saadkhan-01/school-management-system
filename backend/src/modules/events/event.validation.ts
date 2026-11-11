import { z } from "zod";
import { EVENT_TYPES, AUDIENCE_VALUES } from "./event.model";

const attachment = z.object({
  name: z.string().trim().min(1).max(200),
  url: z.string().max(1000).optional(),
  mimeType: z.string().max(120).optional(),
  sizeBytes: z.number().int().min(0).optional(),
});

const base = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(3000).optional(),
  type: z.enum(EVENT_TYPES),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  audience: z.array(z.enum(AUDIENCE_VALUES)).min(1).max(9),
  attachments: z.array(attachment).max(10).optional(),
});
export const eventCreateSchema = base.refine((v) => v.endAt.getTime() >= v.startAt.getTime(), { message: "endAt must be on or after startAt" });
export const eventUpdateSchema = base.partial().refine(
  (v) => !(v.startAt && v.endAt) || v.endAt.getTime() >= v.startAt.getTime(),
  { message: "endAt must be on or after startAt" },
);
