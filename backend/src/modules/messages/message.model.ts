import mongoose, { Schema, type Document } from "mongoose";

/**
 * Conversations + Messages (§24 messaging, §29 conversations/messages) — Phase 9.
 *
 * Privacy rules (enforced in message.service.ts, never just by hiding UI):
 *  - a conversation has 2 participants (+ an optional student context for
 *    parent↔teacher threads about a specific child);
 *  - only participants can list/read/post in a conversation — a third party
 *    who learns a conversation id gets 403, always;
 *  - creation is restricted to allowed pairs (see the service): Parent ↔
 *    Teacher of a verified-linked child, Parent ↔ Admin/Receptionist office,
 *    and staff ↔ staff. Students have no messaging access (§24 scope).
 */
export interface IConversation extends Document {
  participants: mongoose.Types.ObjectId[];
  studentContext?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  createdAt: Date;
  updatedAt: Date;
}
const conversationSchema = new Schema<IConversation>({
  participants: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], required: true, index: true },
  studentContext: { type: Schema.Types.ObjectId, ref: "Student", index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  lastMessageAt: { type: Date, index: true },
  lastMessagePreview: { type: String, trim: true, maxlength: 200 },
}, { timestamps: true });
export const Conversation = (mongoose.models.Conversation as mongoose.Model<IConversation>) || mongoose.model<IConversation>("Conversation", conversationSchema);

export interface IMessage extends Document {
  conversation: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  body: string;
  readBy: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}
const messageSchema = new Schema<IMessage>({
  conversation: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
  sender: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  body: { type: String, required: true, trim: true, maxlength: 5000 },
  readBy: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
}, { timestamps: true });
messageSchema.index({ conversation: 1, createdAt: 1 });
export const Message = (mongoose.models.Message as mongoose.Model<IMessage>) || mongoose.model<IMessage>("Message", messageSchema);
