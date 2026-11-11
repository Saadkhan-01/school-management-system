import mongoose from "mongoose";
import { AppError } from "./AppError";

/** Keep only keys whose value is not undefined (partial-update helper, same semantics as website.service). */
export function definedOnly<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(input)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}

/** Validate a route :id param as a Mongo ObjectId — a malformed id is a client error (400), never a 500 CastError. */
export function requireObjectId(id: string, label = "Record"): string {
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, "INVALID_ID", `${label} id '${id}' is not a valid identifier`);
  return id;
}

/** Map a Mongoose duplicate-key error to a clean 409 instead of leaking a 500. */
export function throwIfDuplicate(err: unknown, message: string): never {
  const e = err as { code?: number };
  if (e && e.code === 11000) throw new AppError(409, "DUPLICATE_KEY", message);
  throw err;
}
