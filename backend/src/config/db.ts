
import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../utils/logger";
export type DbState = "disconnected" | "connected" | "connecting" | "error";
export let dbState: DbState = "disconnected";
export async function connectDb(): Promise<void> {
  if (!env.mongoUri) { dbState = "disconnected"; logger.warn("MONGODB_URI not set — running without DB (health endpoint still works). Set it from MongoDB Atlas, see backend/.env.example"); return; }
  try {
    dbState = "connecting";
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
    dbState = "connected"; logger.info("MongoDB connected");
  } catch (err) {
    dbState = "error"; logger.error("MongoDB connection failed — server continues; DB-backed routes will return 503", err);
  }
}
mongoose.connection.on("disconnected", () => { if (dbState === "connected") dbState = "disconnected"; });
