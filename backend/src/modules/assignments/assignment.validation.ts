import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");
const attachment = z.object({
  name: z.string().trim().min(1).max(300),
  url: z.string().trim().max(2000).optional(),
  mimeType: z.string().trim().max(120).optional(),
  sizeBytes: z.number().min(0).optional(),
});

export const assignmentCreateSchema = z.object({
  classId: objectId,
  sectionId: objectId,
  subjectId: objectId,
  sessionId: objectId,
  teacherId: objectId.optional(), // Admin only: which teacher owns it. Teachers always own their own.
  title: z.string().trim().min(2).max(200),
  instructions: z.string().trim().max(5000).optional(),
  deadline: z.coerce.date(),
  maxMarks: z.number().min(1).max(1000).optional(),
  attachments: z.array(attachment).max(10).optional(),
});

export const assignmentUpdateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  instructions: z.string().trim().max(5000).optional(),
  deadline: z.coerce.date().optional(),
  maxMarks: z.number().min(1).max(1000).optional(),
  attachments: z.array(attachment).max(10).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const submissionCreateSchema = z.object({
  content: z.string().trim().max(20000).optional(),
  attachments: z.array(attachment).max(10).optional(),
}).refine((v) => (v.content && v.content.length > 0) || (v.attachments && v.attachments.length > 0), { message: "Provide submission content or at least one attachment" });

export const gradeSchema = z.object({
  marks: z.number().min(0).max(1000).optional(),
  feedback: z.string().trim().max(5000).optional(),
  feedbackPublished: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const materialCreateSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  classId: objectId,
  sectionId: objectId.optional(),
  subjectId: objectId,
  sessionId: objectId,
  fileName: z.string().trim().max(300).optional(),
  fileUrl: z.string().trim().max(2000).optional(),
  mimeType: z.string().trim().max(120).optional(),
  sizeBytes: z.number().min(0).optional(),
});
