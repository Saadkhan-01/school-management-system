import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * Real-database test harness (§36, Phase 10).
 *
 * Starts a REAL mongod (in-memory, via mongodb-memory-server) and connects
 * Mongoose's DEFAULT connection to it — the exact connection the app's
 * models, services and requireDb middleware use, so the real Express app
 * behaves identically to production.
 *
 * Binary resolution:
 *   1. MONGOMS_SYSTEM_BINARY env var (explicit override), else
 *   2. well-known local locations (this workspace keeps a pre-downloaded
 *      mongod 7.0.24 binary at ~/workspace/.mongo-test-bin because the
 *      library's own downloader timed out in this sandbox), else
 *   3. the library's own download.
 *
 * NOTE: a standalone mongod has NO transaction support — the admission
 * conversion's documented sequential fallback is what runs in these tests
 * (see tests/integration/admissions.test.ts).
 */
let server: MongoMemoryServer | null = null;

export function findLocalMongod(): string | undefined {
  if (process.env.MONGOMS_SYSTEM_BINARY && fs.existsSync(process.env.MONGOMS_SYSTEM_BINARY)) {
    return process.env.MONGOMS_SYSTEM_BINARY;
  }
  const candidates = [
    path.join(os.homedir(), "workspace/.mongo-test-bin/mongodb-linux-x86_64-ubuntu2204-7.0.24/bin/mongod"),
    path.join(os.homedir(), ".cache/mongodb-binaries/mongod"),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

export async function startTestDb(): Promise<{ uri: string; binary: string }> {
  const binary = findLocalMongod();
  if (binary) process.env.MONGOMS_SYSTEM_BINARY = binary;
  server = await MongoMemoryServer.create(binary ? { binary: { systemBinary: binary } } : undefined);
  const uri = server.getUri("school-erp-test");
  await mongoose.connect(uri);
  return { uri, binary: binary ?? "library-download" };
}

/** Remove every document from every collection (indexes are kept). */
export async function clearTestDb(): Promise<void> {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect().catch(() => undefined);
  if (server) { await server.stop().catch(() => undefined); server = null; }
}
