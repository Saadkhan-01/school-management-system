import { z } from "zod";
import { CONTENT_ITEM_TYPES } from "../website/contentItem.model";

/** Query for GET /portal/announcements — type defaults to announcements; the
 *  same audience slicing applies if a caller asks for news/events instead. */
export const announcementsQuerySchema = z.object({
  type: z.enum(CONTENT_ITEM_TYPES).optional(),
});
