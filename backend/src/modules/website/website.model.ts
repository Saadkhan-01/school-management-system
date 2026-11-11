import mongoose, { Schema, type Document } from "mongoose";

/**
 * WebsiteContent — singleton CMS document for the public school website (§5, §28).
 * One document with key "main". Edited by Admin via /api/v1/website/admin/content;
 * the public only ever receives it when isPublished is true.
 * The same document backs the schoolSettings views (/api/v1/settings):
 * school identity + contact + footer live here so there is a single source of truth.
 */
export interface CmsLink { label: string; url: string }
export interface CmsStat { label: string; value: string }
export interface CmsProgram { title: string; description: string; imageUrl?: string }
export interface CmsFacultyHighlight { name: string; role: string; subject?: string; photoUrl?: string; bio?: string }
export interface CmsFacility { name: string; description: string; icon?: string; imageUrl?: string }
export interface CmsTestimonial { name: string; role: string; quote: string }

export interface IWebsiteContent extends Document {
  key: string;
  schoolName: string;
  tagline?: string;
  logoUrl?: string;
  hero: { title: string; subtitle: string; imageUrl?: string; primaryCtaLabel?: string; primaryCtaLink?: string; secondaryCtaLabel?: string; secondaryCtaLink?: string };
  aboutText: string;
  aboutImageUrl?: string;
  principal: { name: string; title: string; message: string; photoUrl?: string };
  stats: CmsStat[];
  programs: CmsProgram[];
  facultyHighlights: CmsFacultyHighlight[];
  facilities: CmsFacility[];
  testimonials: CmsTestimonial[];
  contact: { email: string; phone: string; alternatePhone?: string; address: string; city?: string; mapEmbedUrl?: string; mapLink?: string; officeHours?: string };
  footer: { aboutText?: string; quickLinks: CmsLink[]; socialLinks: CmsLink[] };
  admissionOpen: boolean;
  isPublished: boolean;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const linkSchema = new Schema<CmsLink>({ label: { type: String, required: true, trim: true, maxlength: 120 }, url: { type: String, required: true, trim: true, maxlength: 500 } }, { _id: false });
const statSchema = new Schema<CmsStat>({ label: { type: String, required: true, trim: true, maxlength: 80 }, value: { type: String, required: true, trim: true, maxlength: 40 } }, { _id: false });
const programSchema = new Schema<CmsProgram>({ title: { type: String, required: true, trim: true, maxlength: 160 }, description: { type: String, required: true, trim: true, maxlength: 2000 }, imageUrl: { type: String, trim: true, maxlength: 1000 } }, { _id: false });
const facultySchema = new Schema<CmsFacultyHighlight>({ name: { type: String, required: true, trim: true, maxlength: 120 }, role: { type: String, required: true, trim: true, maxlength: 120 }, subject: { type: String, trim: true, maxlength: 120 }, photoUrl: { type: String, trim: true, maxlength: 1000 }, bio: { type: String, trim: true, maxlength: 1000 } }, { _id: false });
const facilitySchema = new Schema<CmsFacility>({ name: { type: String, required: true, trim: true, maxlength: 160 }, description: { type: String, required: true, trim: true, maxlength: 2000 }, icon: { type: String, trim: true, maxlength: 60 }, imageUrl: { type: String, trim: true, maxlength: 1000 } }, { _id: false });
const testimonialSchema = new Schema<CmsTestimonial>({ name: { type: String, required: true, trim: true, maxlength: 120 }, role: { type: String, required: true, trim: true, maxlength: 120 }, quote: { type: String, required: true, trim: true, maxlength: 2000 } }, { _id: false });

const websiteContentSchema = new Schema<IWebsiteContent>({
  key: { type: String, required: true, unique: true, default: "main", index: true },
  schoolName: { type: String, required: true, trim: true, maxlength: 160 },
  tagline: { type: String, trim: true, maxlength: 240 },
  logoUrl: { type: String, trim: true, maxlength: 1000 },
  hero: {
    title: { type: String, required: true, trim: true, maxlength: 240 },
    subtitle: { type: String, required: true, trim: true, maxlength: 1000 },
    imageUrl: { type: String, trim: true, maxlength: 1000 },
    primaryCtaLabel: { type: String, trim: true, maxlength: 80 },
    primaryCtaLink: { type: String, trim: true, maxlength: 300 },
    secondaryCtaLabel: { type: String, trim: true, maxlength: 80 },
    secondaryCtaLink: { type: String, trim: true, maxlength: 300 },
  },
  aboutText: { type: String, required: true, trim: true, maxlength: 8000 },
  aboutImageUrl: { type: String, trim: true, maxlength: 1000 },
  principal: {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    title: { type: String, required: true, trim: true, maxlength: 120, default: "Principal" },
    message: { type: String, required: true, trim: true, maxlength: 8000 },
    photoUrl: { type: String, trim: true, maxlength: 1000 },
  },
  stats: { type: [statSchema], default: [] },
  programs: { type: [programSchema], default: [] },
  facultyHighlights: { type: [facultySchema], default: [] },
  facilities: { type: [facilitySchema], default: [] },
  testimonials: { type: [testimonialSchema], default: [] },
  contact: {
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    alternatePhone: { type: String, trim: true, maxlength: 40 },
    address: { type: String, required: true, trim: true, maxlength: 500 },
    city: { type: String, trim: true, maxlength: 120 },
    mapEmbedUrl: { type: String, trim: true, maxlength: 1500 },
    mapLink: { type: String, trim: true, maxlength: 1000 },
    officeHours: { type: String, trim: true, maxlength: 200 },
  },
  footer: {
    aboutText: { type: String, trim: true, maxlength: 1000 },
    quickLinks: { type: [linkSchema], default: [] },
    socialLinks: { type: [linkSchema], default: [] },
  },
  admissionOpen: { type: Boolean, default: true },
  isPublished: { type: Boolean, default: false, index: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

export const WebsiteContent = (mongoose.models.WebsiteContent as mongoose.Model<IWebsiteContent>) || mongoose.model<IWebsiteContent>("WebsiteContent", websiteContentSchema);
