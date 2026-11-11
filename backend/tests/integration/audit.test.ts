import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startTestDb, clearTestDb, stopTestDb } from "../helpers/testDb";
import { logActivity } from "../../src/modules/audit/audit.service";
import { ActivityLog } from "../../src/modules/audit/audit.model";

/**
 * §36 — Audit-log metadata stripping: secret-shaped keys (password, token,
 * secret, authorization, cookie, card, cvv — case-insensitive) are removed
 * before persistence even if a call site passes them by mistake.
 */
describe("§36 Audit metadata stripping", () => {
  beforeAll(async () => { await startTestDb(); });
  afterAll(async () => { await stopTestDb(); });
  beforeEach(async () => { await clearTestDb(); });

  it("strips secret-shaped keys and keeps legitimate metadata", async () => {
    await logActivity({
      actor: { id: "507f1f77bcf86cd799439011", role: "admin" },
      action: "test.action", entityKind: "test", summary: "strip test",
      metadata: {
        keepMe: "yes", amount: 4200,
        password: "hunter2", refreshToken: "abc", apiSecret: "s3cr3t",
        Authorization: "Bearer x", cookie: "session=1", cardNumber: "4242", cvv: "123",
      },
    });
    const row = await ActivityLog.findOne({ action: "test.action" }).lean();
    expect(row).toBeTruthy();
    expect(row!.metadata).toEqual({ keepMe: "yes", amount: 4200 });
    const raw = JSON.stringify(row);
    for (const secret of ["hunter2", "s3cr3t", "4242"]) expect(raw).not.toContain(secret);
  });

  it("a metadata object of ONLY secrets is stored as no metadata at all", async () => {
    await logActivity({
      actor: null, action: "test.only-secrets", entityKind: "test", summary: "only secrets",
      metadata: { password: "x", token: "y" },
    });
    const row = await ActivityLog.findOne({ action: "test.only-secrets" }).lean();
    expect(row).toBeTruthy();
    expect(row!.metadata ?? null).toBeNull();
  });
});
