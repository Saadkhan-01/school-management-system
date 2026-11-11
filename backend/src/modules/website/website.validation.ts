import { z } from "zod";
import { CONTENT_AUDIENCES, CONTENT_ITEM_STATUSES, CONTENT_ITEM_TYPES } from "./contentItem.model";
import { ENQUIRY_STATUSES } from "./enquiry.model";

const optUrl = z.string().trim().max(1000).url("Must be a valid URL").optional().or(z.literal(""));
const link = z.object({ label: z.string().trim().min(1).max(120), url: z.string().trim().min(1).max(500) });

/** Full CMS content update. Every top-level field is optional: the service merges
 *  provided fields into the singleton document, so the admin form may save one
 *  section at a time. Arrays, when provided, replace the stored array wholesale. */
export const websiteContentSchema = z.object({
  schoolName: z.string().trim().min(2).max(160).optional(),
  tagline: z.string().trim().max(240).optional(),
  logoUrl: optUrl,
  hero: z.object({
    title: z.string().trim().min(2).max(240),
    subtitle: z.string().trim().min(2).max(1000),
    imageUrl: optUrl,
    primaryCtaLabel: z.string().trim().max(80).optional(),
    primaryCtaLink: z.string().trim().max(300).optional(),
    secondaryCtaLabel: z.string().trim().max(80).optional(),
    secondaryCtaLink: z.string().trim().max(300).optional(),
  }).optional(),
  aboutText: z.string().trim().min(2).max(8000).optional(),
  aboutImageUrl: optUrl,
  principal: z.object({
    name: z.string().trim().min(2).max(120),
    title: z.string().trim().min(2).max(120),
    message: z.string().trim().min(2).max(8000),
    photoUrl: optUrl,
  }).optional(),
  stats: z.array(z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(40) })).max(24).optional(),
  programs: z.array(z.object({ title: z.string().trim().min(1).max(160), description: z.string().trim().min(1).max(2000), imageUrl: optUrl })).max(60).optional(),
  facultyHighlights: z.array(z.object({ name: z.string().trim().min(1).max(120), role: z.string().trim().min(1).max(120), subject: z.string().trim().max(120).optional(), photoUrl: optUrl, bio: z.string().trim().max(1000).optional() })).max(100).optional(),
  facilities: z.array(z.object({ name: z.string().trim().min(1).max(160), description: z.string().trim().min(1).max(2000), icon: z.string().trim().max(60).optional(), imageUrl: optUrl })).max(60).optional(),
  testimonials: z.array(z.object({ name: z.string().trim().min(1).max(120), role: z.string().trim().min(1).max(120), quote: z.string().trim().min(1).max(2000) })).max(60).optional(),
  contact: z.object({
    email: z.string().trim().email().max(160),
    phone: z.string().trim().min(5).max(40),
    alternatePhone: z.string().trim().max(40).optional(),
    address: z.string().trim().min(5).max(500),
    city: z.string().trim().max(120).optional(),
    mapEmbedUrl: z.string().trim().max(1500).optional(),
    mapLink: z.string().trim().max(1000).optional(),
    officeHours: z.string().trim().max(200).optional(),
  }).optional(),
  footer: z.object({
    aboutText: z.string().trim().max(1000).optional(),
    quickLinks: z.array(link).max(30).optional(),
    socialLinks: z.array(link).max(20).optional(),
  }).optional(),
  admissionOpen: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

/** School settings subset (identity + contact + footer) — same underlying document. */
export const schoolSettingsSchema = websiteContentSchema.pick({
  schoolName: true, tagline: true, logoUrl: true, contact: true, footer: true, admissionOpen: true,
});

export const contentItemSchema = z.object({
  type: z.enum(CONTENT_ITEM_TYPES),
  title: z.string().trim().min(2).max(240),
  description: z.string().trim().max(2000).optional(),
  body: z.string().trim().max(12000).optional(),
  imageUrl: optUrl,
  category: z.string().trim().max(120).optional(),
  eventStart: z.coerce.date().optional(),
  eventEnd: z.coerce.date().optional(),
  location: z.string().trim().max(240).optional(),
  audience: z.enum(CONTENT_AUDIENCES).optional(),
  status: z.enum(CONTENT_ITEM_STATUSES).optional(),
  publishAt: z.coerce.date().optional(),
  isFeatured: z.boolean().optional(),
  attachments: z.array(z.object({ name: z.string().trim().min(1).max(200), url: z.string().trim().min(1).max(1000) })).max(10).optional(),
});

export const contentItemUpdateSchema = contentItemSchema.partial().refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const enquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(7).max(40).optional().or(z.literal("")),
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(10).max(5000),
});

export const enquiryStatusSchema = z.object({
  status: z.enum(ENQUIRY_STATUSES),
  internalNotes: z.string().trim().max(2000).optional(),
  note: z.string().trim().max(1000).optional(),
});
