/**
 * First-admin seed — creates the initial Admin account so the ERP can be bootstrapped.
 *
 * Credentials come ONLY from the environment (never hardcoded, never defaulted):
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, plus MONGODB_URI.
 * Run:  npm run seed:admin        (from backend/, after setting the env vars)
 * The script refuses to run when any required variable is missing, refuses to
 * overwrite an existing account, and never prints the password.
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { User } from "../modules/users/user.model";

async function main(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = (process.env.ADMIN_NAME ?? "").trim();

  const missing: string[] = [];
  if (!email) missing.push("ADMIN_EMAIL");
  if (!password) missing.push("ADMIN_PASSWORD");
  if (!name) missing.push("ADMIN_NAME");
  if (!env.mongoUri) missing.push("MONGODB_URI");
  if (missing.length > 0) {
    console.error(`[seed:admin] Refusing to run — missing required environment variable(s): ${missing.join(", ")}. See backend/.env.example. No account was created.`);
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("[seed:admin] Refusing to run — ADMIN_EMAIL is not a valid email address.");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("[seed:admin] Refusing to run — ADMIN_PASSWORD must be at least 10 characters.");
    process.exit(1);
  }

  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000 });
  try {
    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.role === "admin") {
        console.log(`[seed:admin] An admin account already exists for ${email} — nothing changed (passwords are never overwritten by this script).`);
      } else {
        console.error(`[seed:admin] Refusing to run — ${email} already belongs to a '${existing.role}' account. Use a different ADMIN_EMAIL.`);
        process.exitCode = 1;
      }
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash, role: "admin", isActive: true, isVerified: true });
    console.log(`[seed:admin] Admin account created: ${user.email} (role=admin, id=${String(user._id)}). You can now log in and change the password from the ERP.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("[seed:admin] Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
