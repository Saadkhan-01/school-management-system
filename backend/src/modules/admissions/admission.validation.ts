import { z } from "zod";
import { ADMISSION_STATUSES } from "./admission.model";

/** Public online admission application (§16). Documents are metadata only in Phase 2 —
 *  secure file upload (Cloudinary/S3) is configured per §34 and never faked. */
export const publicApplicationSchema = z.object({
  studentName: z.string().trim().min(2).max(120),
  dateOfBirth: z.coerce.date().refine((d) => d.getTime() < Date.now(), { message: "Date of birth must be in the past" }),
  gender: z.enum(["male", "female", "other"]),
  guardianName: z.string().trim().min(2).max(120),
  guardianRelation: z.string().trim().max(60).optional().or(z.literal("")),
  guardianEmail: z.string().trim().email().max(160),
  guardianPhone: z.string().trim().min(7).max(40),
  previousSchool: z.string().trim().max(200).optional().or(z.literal("")),
  desiredClass: z.string().trim().min(1).max(60),
  address: z.string().trim().min(5).max(500),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  documents: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    type: z.string().trim().max(80).optional(),
    url: z.string().trim().max(1000).optional(),
    note: z.string().trim().max(500).optional(),
  })).max(10).optional(),
});

export const admissionStatusSchema = z.object({
  status: z.enum(ADMISSION_STATUSES),
  note: z.string().trim().max(1000).optional(),
});

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");

/** Phase 4 enrollment conversion (§16 steps 6–12): placement for the new enrollment. */
export const admissionEnrollSchema = z.object({
  sessionId: objectId,
  classId: objectId,
  sectionId: objectId,
  guardianRelation: z.string().trim().max(60).optional().or(z.literal("")),
  parentPassword: z.string().min(8).max(200).optional(),
  note: z.string().trim().max(1000).optional(),
});
