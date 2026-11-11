import mongoose, { Schema, type Document } from "mongoose";

/**
 * PublicContentItem — News, Events, Gallery items and Announcements (§23, §28).
 * One collection, discriminated by `type`. The public API only returns items that are
 * status=published, publishAt <= now, and audience public/all — role-targeted
 * announcements are never leaked to anonymous visitors.
 */
export const CONTENT_ITEM_TYPES = ["news", "event", "gallery", "announcement"] as const;
export type ContentItemType = (typeof CONTENT_ITEM_TYPES)[number];
export const CONTENT_ITEM_STATUSES = ["draft", "published", "archived"] as const;
export type ContentItemStatus = (typeof CONTENT_ITEM_STATUSES)[number];
export const CONTENT_AUDIENCES = ["public", "all", "students", "parents", "teachers", "staff"] as const;
export type ContentAudience = (typeof CONTENT_AUDIENCES)[number];

export interface IContentItem extends Document {
  type: ContentItemType;
  title: string;
  description?: string;
  body?: string;
  imageUrl?: string;
  category?: string;
  eventStart?: Date;
  eventEnd?: Date;
  location?: string;
  audience: ContentAudience;
  status: ContentItemStatus;
  publishAt?: Date;
  isFeatured: boolean;
  attachments: Array<{ name: string; url: string }>;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema({ name: { type: String, required: true, trim: true, maxlength: 200 }, url: { type: String, required: true, trim: true, maxlength: 1000 } }, { _id: false });

const contentItemSchema = new Schema<IContentItem>({
  type: { type: String, enum: CONTENT_ITEM_TYPES, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 240, index: true },
  description: { type: String, trim: true, maxlength: 2000 },
  body: { type: String, trim: true, maxlength: 12000 },
  imageUrl: { type: String, trim: true, maxlength: 1000 },
  category: { type: String, trim: true, maxlength: 120 },
  eventStart: Date,
  eventEnd: Date,
  location: { type: String, trim: true, maxlength: 240 },
  audience: { type: String, enum: CONTENT_AUDIENCES, default: "public", index: true },
  status: { type: String, enum: CONTENT_ITEM_STATUSES, default: "draft", index: true },
  publishAt: Date,
  isFeatured: { type: Boolean, default: false },
  attachments: { type: [attachmentSchema], default: [] },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

contentItemSchema.index({ type: 1, status: 1, publishAt: -1 });

export const PublicContentItem = (mongoose.models.PublicContentItem as mongoose.Model<IContentItem>) || mongoose.model<IContentItem>("PublicContentItem", contentItemSchema);
