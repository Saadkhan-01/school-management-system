import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestDb, stopTestDb } from "../helpers/testDb";
import { api, bearer } from "../helpers/api";
import { buildSchool, loginAs, type SchoolFixture } from "../helpers/seed";

/**
 * §36 — Permissions / RBAC suite (docs/permissions.md) against the real app + DB.
 * Student anti-IDOR, parent verified-link scoping, teacher assignment scoping,
 * and the per-role route restrictions for accountant / librarian / receptionist.
 */
describe("§36 Permissions (RBAC + object scope)", () => {
  let fx: SchoolFixture;
  let tok: Record<string, string> = {};
  beforeAll(async () => {
    await startTestDb();
    fx = await buildSchool();
    for (const [key, u] of Object.entries({
      admin: fx.admin, principal: fx.principal, teacher: fx.teacher, teacher2: fx.teacher2,
      accountant: fx.accountant, librarian: fx.librarian, receptionist: fx.receptionist,
      parent: fx.parent, parent2: fx.parent2,
    })) tok[key] = (await loginAs(u.email, u.password)).token;
    const sanity = await api().get("/api/v1/students").set(bearer(tok.admin)); // sanity: admin sees students
    expect(sanity.status).toBe(200);
  }, 300_000);
  afterAll(async () => { await stopTestDb(); });

  it("setup: student A login works via its linked user account", async () => {
    const { User } = await import("../../src/modules/users/user.model");
    const u = await User.findById(fx.studentAUserId).lean();
    expect(u?.role).toBe("student");
    tok.student = (await loginAs(u!.email)).token;
    expect(tok.student).toBeTruthy();
  });

  it("student can read OWN record but NOT another student's (anti-IDOR → 403)", async () => {
    const own = await api().get(`/api/v1/students/${fx.studentA._id}`).set(bearer(tok.student));
    expect(own.status).toBe(200);
    const other = await api().get(`/api/v1/students/${fx.studentB._id}`).set(bearer(tok.student));
    expect(other.status).toBe(403);
    expect(other.body.error.code).toBe("FORBIDDEN");
  });

  it("parent reads the VERIFIED-linked child, but an unlinked student → 403", async () => {
    const linked = await api().get(`/api/v1/students/${fx.studentA._id}`).set(bearer(tok.parent));
    expect(linked.status).toBe(200);
    const unlinked = await api().get(`/api/v1/students/${fx.studentB._id}`).set(bearer(tok.parent));
    expect(unlinked.status).toBe(403);
  });

  it("parent with only an UNVERIFIED link gets 403 for that same child", async () => {
    const res = await api().get(`/api/v1/students/${fx.studentA._id}`).set(bearer(tok.parent2));
    expect(res.status).toBe(403);
  });

  it("parent portal (/portal/parent/me) lists exactly the verified child; unverified-only parent sees none", async () => {
    const res = await api().get("/api/v1/portal/parent/me").set(bearer(tok.parent));
    expect(res.status).toBe(200);
    const kids = res.body.data.children as Array<{ studentId: string }>;
    expect(kids.map((k) => k.studentId)).toEqual([fx.studentA._id]);
    const res2 = await api().get("/api/v1/portal/parent/me").set(bearer(tok.parent2));
    expect(res2.status).toBe(200);
    expect((res2.body.data.children as unknown[]).length).toBe(0);
    expect(res2.body.data.unverifiedLinks.count).toBe(1);
  });

  it("teacher CAN mark attendance for the assigned class; unassigned teacher → 403", async () => {
    const body = {
      classId: fx.classId, sectionId: fx.sectionId, sessionId: fx.sessionId, date: "2026-03-02",
      records: [{ studentId: fx.studentA._id, status: "present" }, { studentId: fx.studentB._id, status: "present" }],
    };
    const ok = await api().post("/api/v1/attendance/bulk").set(bearer(tok.teacher)).send(body);
    expect(ok.status).toBe(201);
    expect(ok.body.data.count).toBe(2);
    const denied = await api().post("/api/v1/attendance/bulk").set(bearer(tok.teacher2)).send({ ...body, date: "2026-03-03" });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("FORBIDDEN");
    expect(denied.body.error.message).toMatch(/not assigned/i);
  });

  it("role route gates: librarian → payroll-structures 403; receptionist → invoices 403; accountant → students CRUD 403", async () => {
    const libPayroll = await api().get("/api/v1/payroll/structures").set(bearer(tok.librarian));
    expect(libPayroll.status).toBe(403);
    const recFinance = await api().get("/api/v1/invoices").set(bearer(tok.receptionist));
    expect(recFinance.status).toBe(403);
    const recSummary = await api().get("/api/v1/finance/summary").set(bearer(tok.receptionist));
    expect(recSummary.status).toBe(403);
    const accStudents = await api().post("/api/v1/students").set(bearer(tok.accountant)).send({ firstName: "X", lastName: "Y", dateOfBirth: "2015-01-01", gender: "male" });
    expect(accStudents.status).toBe(403);
    const librarianStructures = await api().get("/api/v1/payroll/structures").set(bearer(tok.teacher));
    expect(librarianStructures.status).toBe(403);
    const parentUsers = await api().get("/api/v1/users").set(bearer(tok.parent));
    expect(parentUsers.status).toBe(403);
  });

  it("positive controls: admin and the owning roles CAN use their routes", async () => {
    const adminUsers = await api().get("/api/v1/users").set(bearer(tok.admin));
    expect(adminUsers.status).toBe(200);
    const accInvoices = await api().get("/api/v1/invoices").set(bearer(tok.accountant));
    expect(accInvoices.status).toBe(200);
    const libBooks = await api().get("/api/v1/library/books").set(bearer(tok.librarian));
    expect(libBooks.status).toBe(200);
    const recVisitors = await api().get("/api/v1/visitors").set(bearer(tok.receptionist));
    expect(recVisitors.status).toBe(200);
    const principalStudents = await api().get("/api/v1/students").set(bearer(tok.principal));
    expect(principalStudents.status).toBe(200);
  });

  it("anonymous requests to protected routes → 401", async () => {
    const res = await api().get("/api/v1/students");
    expect(res.status).toBe(401);
    const res2 = await api().get("/api/v1/invoices");
    expect(res2.status).toBe(401);
  });
});
