import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestDb, stopTestDb } from "../helpers/testDb";
import { api, bearer } from "../helpers/api";
import { buildSchool, loginAs, seedUser, type SchoolFixture } from "../helpers/seed";
import { BookIssue } from "../../src/modules/library/library.model";

/**
 * §36 — Other modules suite: library (issue/re-issue 409, overdue fine),
 * transport capacity 409, inventory over-issue 409, leave double-decision 409,
 * certificates (fee-clearance blocked by balance → issued after payment →
 * public verify returns minimal fields only).
 * The §36 notification-hook and activity-log assertions live in finance.test.ts.
 */
describe("§36 Library / Transport / Inventory / Leave / Certificates", () => {
  let fx: SchoolFixture;
  let tok: Record<string, string> = {};
  beforeAll(async () => {
    await startTestDb();
    fx = await buildSchool();
    for (const [key, u] of Object.entries({ admin: fx.admin, principal: fx.principal, accountant: fx.accountant, librarian: fx.librarian, parent: fx.parent, teacher: fx.teacher })) {
      tok[key] = (await loginAs(u.email, u.password)).token;
    }
  }, 300_000);
  afterAll(async () => { await stopTestDb(); });

  it("library: issue an available copy → 201; issue the SAME copy again → 409; on-time return → no fine", async () => {
    const cat = await api().post("/api/v1/library/categories").set(bearer(tok.librarian)).send({ name: "Fiction" });
    expect(cat.status).toBe(201);
    const book = await api().post("/api/v1/library/books").set(bearer(tok.librarian)).send({ title: "The Hobbit", author: "J.R.R. Tolkien", categoryId: cat.body.data.category._id });
    expect(book.status).toBe(201);
    const copy = await api().post("/api/v1/library/copies").set(bearer(tok.librarian)).send({ bookId: book.body.data.book._id, copyCode: "HOB-001" });
    expect(copy.status).toBe(201);
    const copyId = copy.body.data.copy._id;

    const issue = await api().post("/api/v1/library/issues").set(bearer(tok.librarian)).send({ copyId, studentId: fx.studentA._id });
    expect(issue.status).toBe(201);
    expect(issue.body.data.issue.returnDate ?? null).toBeNull();
    expect(String(issue.body.data.issue.borrowerStudent._id ?? issue.body.data.issue.borrowerStudent)).toBe(fx.studentA._id);
    const again = await api().post("/api/v1/library/issues").set(bearer(tok.librarian)).send({ copyId, studentId: fx.studentB._id });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("COPY_NOT_AVAILABLE");

    const ret = await api().post(`/api/v1/library/issues/${issue.body.data.issue._id}/return`).set(bearer(tok.librarian)).send({});
    expect(ret.status).toBe(200);
    expect(ret.body.data.issue.returnDate).toBeTruthy();
    expect(ret.body.data.issue.fineAmount).toBe(0);
    expect(ret.body.data.issue.fineStatus).toBe("none");
    // Returning twice → 409 ALREADY_RETURNED
    const retwice = await api().post(`/api/v1/library/issues/${issue.body.data.issue._id}/return`).set(bearer(tok.librarian)).send({});
    expect(retwice.status).toBe(409);
    expect(retwice.body.error.code).toBe("ALREADY_RETURNED");
  });

  it("library: an overdue return computes the fine at 500 minor units per whole day past due", async () => {
    // Seed an issue directly in the DB: issued 20 days ago, due 6 days ago.
    const cat = await api().post("/api/v1/library/categories").set(bearer(tok.librarian)).send({ name: "Science" });
    const book = await api().post("/api/v1/library/books").set(bearer(tok.librarian)).send({ title: "Physics 101", author: "A. Author", categoryId: cat.body.data.category._id });
    const copy = await api().post("/api/v1/library/copies").set(bearer(tok.librarian)).send({ bookId: book.body.data.book._id, copyCode: "PHY-001" });
    const now = Date.now();
    const seeded = await BookIssue.create({
      book: book.body.data.book._id, copy: copy.body.data.copy._id, borrowerStudent: fx.studentB._id,
      issuedBy: fx.librarian.id, issueDate: new Date(now - 20 * 86_400_000),
      dueDate: new Date(now - 6 * 86_400_000),
    });
    const ret = await api().post(`/api/v1/library/issues/${seeded._id}/return`).set(bearer(tok.librarian)).send({});
    expect(ret.status).toBe(200);
    expect(ret.body.data.issue.fineAmount).toBe(3000); // 6 days × 500
    expect(ret.body.data.issue.fineStatus).toBe("unpaid");
  });

  it("transport: allocation beyond vehicle capacity → 409 BUS_CAPACITY_FULL", async () => {
    const third = await api().post("/api/v1/students").set(bearer(tok.admin)).send({
      firstName: "Third", lastName: "Rider", dateOfBirth: "2014-03-03", gender: "female",
      guardianName: "Rider Guardian", guardianPhone: "03003332221",
    });
    const studentC = third.body.data.student._id;
    await api().post("/api/v1/enrollments").set(bearer(tok.admin)).send({ studentId: studentC, sessionId: fx.sessionId, classId: fx.classId, sectionId: fx.sectionId });

    const bus = await api().post("/api/v1/transport/buses").set(bearer(tok.admin)).send({
      name: "Mini Bus", registrationNumber: "TEST-001", capacity: 2, driverName: "Driver One", driverPhone: "03001110000",
    });
    expect(bus.status).toBe(201);
    const route = await api().post("/api/v1/transport/routes").set(bearer(tok.admin)).send({ name: "Route A", stops: ["Gate", "Market"] });
    const alloc = (studentId: string) => api().post("/api/v1/transport/allocations").set(bearer(tok.admin)).send({
      studentId, routeId: route.body.data.route._id, busId: bus.body.data.bus._id, stop: "Gate", sessionId: fx.sessionId,
    });
    expect((await alloc(fx.studentA._id)).status).toBe(201);
    expect((await alloc(fx.studentB._id)).status).toBe(201);
    const over = await alloc(studentC);
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe("BUS_CAPACITY_FULL");
  });

  it("inventory: purchase raises stock; issuing beyond stock → 409 INSUFFICIENT_STOCK", async () => {
    const cat = await api().post("/api/v1/inventory/categories").set(bearer(tok.admin)).send({ name: "Stationery" });
    const item = await api().post("/api/v1/inventory/items").set(bearer(tok.admin)).send({ name: "Notebooks", categoryId: cat.body.data.category._id, unit: "pcs" });
    const itemId = item.body.data.item._id;
    const buy = await api().post("/api/v1/inventory/transactions").set(bearer(tok.admin)).send({ itemId, type: "purchase", quantity: 10 });
    expect(buy.status).toBe(201);
    expect(buy.body.data.transaction.balanceAfter).toBe(10);
    const issueOk = await api().post("/api/v1/inventory/transactions").set(bearer(tok.admin)).send({ itemId, type: "issued", quantity: 4 });
    expect(issueOk.body.data.transaction.balanceAfter).toBe(6);
    const over = await api().post("/api/v1/inventory/transactions").set(bearer(tok.admin)).send({ itemId, type: "issued", quantity: 7 });
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe("INSUFFICIENT_STOCK");
  });

  it("leave: approve once → 200; a second decision → 409 ALREADY_DECIDED", async () => {
    const teacherUser = await seedUser("teacher");
    const apply = await api().post("/api/v1/leave").set(bearer((await loginAs(teacherUser.email)).token)).send({
      leaveType: "sick", fromDate: "2026-06-01", toDate: "2026-06-02", reason: "Fever and rest advised",
    });
    expect(apply.status).toBe(201);
    const leaveId = apply.body.data.leave._id;
    const decide = await api().patch(`/api/v1/leave/${leaveId}/decide`).set(bearer(tok.principal)).send({ status: "approved", decisionNote: "Approved" });
    expect(decide.status).toBe(200);
    const again = await api().patch(`/api/v1/leave/${leaveId}/decide`).set(bearer(tok.principal)).send({ status: "rejected" });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("ALREADY_DECIDED");
  });

  it("certificates: fee-clearance blocked (422) while a balance is outstanding; issues after payment; public verify is minimal", async () => {
    // Give student A an unpaid invoice
    const structure = await api().post("/api/v1/fees/structures").set(bearer(tok.accountant)).send({
      name: "Cert fees structure", sessionId: fx.sessionId, classId: fx.classId, sectionId: fx.sectionId,
      lineItems: [{ label: "Tuition", amount: 100000 }], partialPaymentsAllowed: false, periodLabel: "CertTerm",
    });
    const inv = await api().post("/api/v1/invoices").set(bearer(tok.accountant)).send({
      studentId: fx.studentA._id, feeStructureId: structure.body.data.feeStructure._id, dueDate: "2027-02-28", periodLabel: "CertTerm",
    });
    const invoiceId = inv.body.data.invoice._id;

    const blocked = await api().post("/api/v1/certificates").set(bearer(tok.admin)).send({ studentId: fx.studentA._id, type: "fee-clearance" });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe("OUTSTANDING_BALANCE");

    // Pay in full + verify
    const pay = await api().post("/api/v1/payments").set(bearer(tok.parent)).send({ invoiceId, amount: 100000, method: "cash" });
    expect(pay.status).toBe(201);
    const verify = await api().post(`/api/v1/payments/${pay.body.data.payment._id}/verify`).set(bearer(tok.accountant));
    expect(verify.status).toBe(200);

    const issued = await api().post("/api/v1/certificates").set(bearer(tok.admin)).send({ studentId: fx.studentA._id, type: "fee-clearance" });
    expect(issued.status).toBe(201);
    const ref = issued.body.data.certificate.referenceNumber as string;
    expect(ref).toMatch(/^CERT-\d{4}-\d{6}$/);

    // Public verification: NO auth, and ONLY the minimal public fields
    const pub = await api().get(`/api/v1/certificates/verify/${ref}`);
    expect(pub.status).toBe(200);
    expect(Object.keys(pub.body.data).sort()).toEqual(["issueDate", "referenceNumber", "status", "studentName", "type", "valid"]);
    expect(pub.body.data.valid).toBe(true);
    expect(pub.body.data.studentName).toBe("Ayesha Khan");
    const missing = await api().get("/api/v1/certificates/verify/CERT-2026-999999");
    expect(missing.status).toBe(404);
  });
});
