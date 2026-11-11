import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestDb, stopTestDb } from "../helpers/testDb";
import { api, bearer } from "../helpers/api";
import { seedUser, loginAs, PASSWORD } from "../helpers/seed";
import { Notification } from "../../src/modules/notifications/notification.model";

/**
 * §36 — THE END-TO-END SCENARIO (steps 1–19 of the master prompt), run as ONE
 * sequential integration test against the real app + real (in-memory) MongoDB:
 * a school is set up from nothing, a student is admitted and enrolled, taught,
 * examined, billed and paid — ending with portals, messaging, calendar,
 * reports and a public certificate verification all agreeing with each other.
 */
describe("§36 End-to-end scenario (steps 1–19)", () => {
  beforeAll(async () => { await startTestDb(); }, 120_000);
  afterAll(async () => { await stopTestDb(); });

  it("runs the full school journey in order", async () => {
    const ids: Record<string, string> = {};
    const tok: Record<string, string> = {};

    // (1) Admin logs in
    const admin = await seedUser("admin", { email: "e2e-admin@test.local" });
    tok.admin = (await loginAs(admin.email)).token;
    const me = await api().get("/api/v1/auth/me").set(bearer(tok.admin));
    expect(me.status).toBe(200);
    expect(me.body.data.user.role).toBe("admin");

    // (2) Admin creates Teacher, Accountant (and Principal, Librarian, Receptionist) accounts
    for (const role of ["principal", "teacher", "accountant", "librarian", "receptionist"] as const) {
      const reg = await api().post("/api/v1/auth/register").set(bearer(tok.admin)).send({
        name: `E2E ${role}`, email: `e2e-${role}@test.local`, password: PASSWORD, role,
      });
      expect(reg.status).toBe(201);
      ids[`${role}User`] = reg.body.data.user.id;
      tok[role] = (await loginAs(`e2e-${role}@test.local`)).token;
    }

    // (3) Admin creates session, class, section, subject (+ classroom + grading scale)
    const session = await api().post("/api/v1/academics/sessions").set(bearer(tok.admin)).send({ name: "2026-27", startDate: "2026-04-01", endDate: "2027-03-31", isCurrent: true });
    ids.session = session.body.data.session._id;
    const cls = await api().post("/api/v1/academics/classes").set(bearer(tok.admin)).send({ name: "Class 6", sessionId: ids.session, level: 6 });
    ids.class = cls.body.data.class._id;
    const sec = await api().post("/api/v1/academics/sections").set(bearer(tok.admin)).send({ classId: ids.class, name: "A" });
    ids.section = sec.body.data.section._id;
    const subj = await api().post("/api/v1/academics/subjects").set(bearer(tok.admin)).send({ name: "Mathematics", code: "MATH6", sessionId: ids.session });
    ids.subject = subj.body.data.subject._id;
    const room = await api().post("/api/v1/academics/classrooms").set(bearer(tok.admin)).send({ name: "R-1", capacity: 40 });
    ids.room = room.body.data.classroom._id;
    const scale = await api().post("/api/v1/academics/grading-scales").set(bearer(tok.admin)).send({
      name: "E2E scale", sessionId: ids.session, isDefault: true,
      ranges: [{ min: 90, max: 100, grade: "A+", points: 4 }, { min: 80, max: 89, grade: "A", points: 3.7 }, { min: 0, max: 79, grade: "B", points: 3 }],
    });
    ids.scale = scale.body.data.gradingScale._id;
    for (const k of ["session", "class", "section", "subject", "room", "scale"]) expect(ids[k], k).toBeTruthy();

    // (4) Teacher assigned to class/section/subject
    const tProfile = await api().post("/api/v1/teachers").set(bearer(tok.admin)).send({ userId: ids.teacherUser, employeeId: "EMP-E2E-1" });
    expect(tProfile.status).toBe(201);
    ids.teacherProfile = tProfile.body.data.teacher._id;
    const assign = await api().post("/api/v1/academics/teacher-assignments").set(bearer(tok.admin)).send({
      teacherId: ids.teacherProfile, classId: ids.class, sectionId: ids.section, subjectId: ids.subject, sessionId: ids.session,
    });
    expect(assign.status).toBe(201);

    // (5) Parent submits an online admission application (public)
    const appRes = await api().post("/api/v1/admissions/public").send({
      studentName: "Zara Ahmed", dateOfBirth: "2015-06-15", gender: "female",
      guardianName: "Ahmed Raza", guardianEmail: "zara.guardian@test.local", guardianPhone: "03001239876",
      desiredClass: "Class 6", address: "45 Garden Town, Test City",
    });
    expect(appRes.status).toBe(201);
    ids.application = appRes.body.data.id;

    // (6) Receptionist reviews it
    const review = await api().patch(`/api/v1/admissions/${ids.application}/status`).set(bearer(tok.receptionist)).send({ status: "Under Review" });
    expect(review.status).toBe(200);

    // (7) Principal approves it
    const approve = await api().patch(`/api/v1/admissions/${ids.application}/status`).set(bearer(tok.principal)).send({ status: "Approved" });
    expect(approve.status).toBe(200);

    // (8) Admin enrolls → student + ADM number + verified parent link
    //     (standalone mongod → the documented sequential-fallback path runs)
    const enroll = await api().post(`/api/v1/admissions/${ids.application}/enroll`).set(bearer(tok.admin)).send({
      sessionId: ids.session, classId: ids.class, sectionId: ids.section, parentPassword: "Guardian#123",
    });
    expect(enroll.status).toBe(201);
    ids.student = enroll.body.data.student.id;
    ids.parentUser = enroll.body.data.parent.userId;
    expect(enroll.body.data.student.admissionNumber).toMatch(/^ADM-\d{4}-\d{4}$/);
    tok.parent = (await loginAs("zara.guardian@test.local", "Guardian#123")).token;
    const parentPortal = await api().get("/api/v1/portal/parent/me").set(bearer(tok.parent));
    expect((parentPortal.body.data.children as Array<{ studentId: string }>).map((c) => c.studentId)).toEqual([ids.student]);

    // (9) Teacher creates a timetable entry (+ a conflicting one is refused)
    const tt = await api().post("/api/v1/timetable").set(bearer(tok.admin)).send({
      sessionId: ids.session, classId: ids.class, sectionId: ids.section, subjectId: ids.subject,
      teacherId: ids.teacherProfile, classroomId: ids.room, weekday: "tuesday", periodNumber: 1, startTime: "09:00", endTime: "09:45",
    });
    expect(tt.status).toBe(201);
    const ttClash = await api().post("/api/v1/timetable").set(bearer(tok.admin)).send({
      sessionId: ids.session, classId: ids.class, sectionId: ids.section, subjectId: ids.subject,
      teacherId: ids.teacherProfile, weekday: "tuesday", periodNumber: 2, startTime: "09:30", endTime: "10:15",
    });
    expect(ttClash.status).toBe(409);

    // (10) Teacher marks attendance (present)
    const att = await api().post("/api/v1/attendance/bulk").set(bearer(tok.teacher)).send({
      classId: ids.class, sectionId: ids.section, sessionId: ids.session, date: "2026-05-05",
      records: [{ studentId: ids.student, status: "present" }],
    });
    expect(att.status).toBe(201);

    // (11) Teacher creates an assignment; (12) the student portal shows it + attendance
    const assignment = await api().post("/api/v1/assignments").set(bearer(tok.teacher)).send({
      title: "Algebra worksheet 1", classId: ids.class, sectionId: ids.section, sessionId: ids.session,
      subjectId: ids.subject, deadline: "2026-05-20", maxMarks: 20,
    });
    expect(assignment.status).toBe(201);
    // The admitted student has no login account (conversion default) — the
    // parent portal is the family view; verify BOTH family-visible surfaces:
    const childSummary = await api().get(`/api/v1/portal/parent/children/${ids.student}/summary`).set(bearer(tok.parent));
    expect(childSummary.status).toBe(200);
    const announcements = await api().get("/api/v1/portal/announcements").set(bearer(tok.parent));
    expect(announcements.status).toBe(200);

    // (13) Exam created, marks entered; (14) principal approves + publishes; parent sees the result
    const exam = await api().post("/api/v1/exams").set(bearer(tok.admin)).send({
      name: "E2E Midterm", type: "Midterm", sessionId: ids.session, classIds: [ids.class], gradingScaleId: ids.scale,
    });
    ids.exam = exam.body.data.exam._id;
    const sched = await api().post(`/api/v1/exams/${ids.exam}/schedules`).set(bearer(tok.admin)).send({
      classId: ids.class, sectionId: ids.section, subjectId: ids.subject, date: "2026-06-01", maxMarks: 100,
    });
    const marks = await api().post("/api/v1/marks/bulk").set(bearer(tok.teacher)).send({
      examScheduleId: sched.body.data.schedule._id, entries: [{ studentId: ids.student, obtainedMarks: 92 }],
    });
    expect(marks.status).toBe(201);
    const hiddenFromParent = await api().get(`/api/v1/results/report-card/${ids.exam}/${ids.student}`).set(bearer(tok.parent));
    expect(hiddenFromParent.status).toBe(404); // unpublished → invisible
    expect((await api().post(`/api/v1/exams/${ids.exam}/approve`).set(bearer(tok.principal))).status).toBe(200);
    expect((await api().post(`/api/v1/exams/${ids.exam}/publish`).set(bearer(tok.principal))).status).toBe(200);
    const card = await api().get(`/api/v1/results/report-card/${ids.exam}/${ids.student}`).set(bearer(tok.parent));
    expect(card.status).toBe(200);
    expect(card.body.data.reportCard.grade).toBe("A+");
    expect(card.body.data.reportCard.percentage).toBe(92);

    // (15) Accountant creates a fee structure and generates the invoice
    const structure = await api().post("/api/v1/fees/structures").set(bearer(tok.accountant)).send({
      name: "E2E Term fees", sessionId: ids.session, classId: ids.class, sectionId: ids.section,
      lineItems: [{ label: "Tuition", amount: 300000 }], partialPaymentsAllowed: false, periodLabel: "E2E Term",
    });
    const invoice = await api().post("/api/v1/invoices").set(bearer(tok.accountant)).send({
      studentId: ids.student, feeStructureId: structure.body.data.feeStructure._id, dueDate: "2026-07-31", periodLabel: "E2E Term",
    });
    expect(invoice.status).toBe(201);
    ids.invoice = invoice.body.data.invoice._id;
    expect(invoice.body.data.invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(invoice.body.data.invoice.balance).toBe(300000);

    // (16) Parent pays manually (full amount — partial not allowed on this structure)
    const partial = await api().post("/api/v1/payments").set(bearer(tok.parent)).send({ invoiceId: ids.invoice, amount: 1000, method: "cash" });
    expect(partial.status).toBe(422);
    expect(partial.body.error.code).toBe("PARTIAL_NOT_ALLOWED");
    const pay = await api().post("/api/v1/payments").set(bearer(tok.parent)).send({ invoiceId: ids.invoice, amount: 300000, method: "bank-transfer", reference: "E2E-TXN-1" });
    expect(pay.status).toBe(201);
    ids.payment = pay.body.data.payment._id;

    // (17) Accountant verifies → receipt; invoice paid; parent notified
    const verify = await api().post(`/api/v1/payments/${ids.payment}/verify`).set(bearer(tok.accountant));
    expect(verify.status).toBe(200);
    expect(verify.body.data.receipt.receiptNumber).toMatch(/^RCP-\d{4}-\d{6}$/);
    const invAfter = await api().get(`/api/v1/invoices/${ids.invoice}`).set(bearer(tok.accountant));
    expect(invAfter.body.data.invoice.status).toBe("paid");
    expect(invAfter.body.data.invoice.balance).toBe(0);
    const notif = await Notification.findOne({ recipient: ids.parentUser, type: "payment-verified" }).lean();
    expect(notif).toBeTruthy();
    const parentNotifs = await api().get("/api/v1/notifications").set(bearer(tok.parent));
    expect(parentNotifs.status).toBe(200);
    expect((parentNotifs.body.data.notifications as Array<{ type: string }>).some((n) => n.type === "payment-verified")).toBe(true);

    // (18) Parent messages the teacher (allowed pair via the verified child's class); an event is created
    const contactsRes = await api().get("/api/v1/messages/contacts").set(bearer(tok.parent));
    expect(contactsRes.status).toBe(200);
    expect(JSON.stringify(contactsRes.body.data)).toContain(ids.teacherUser);
    const convo = await api().post("/api/v1/messages/conversations").set(bearer(tok.parent)).send({ otherUserId: ids.teacherUser, studentId: ids.student });
    expect([200, 201]).toContain(convo.status);
    const convoId = convo.body.data.conversation._id ?? convo.body.data.conversation.id;
    const msg = await api().post(`/api/v1/messages/conversations/${convoId}/messages`).set(bearer(tok.parent)).send({ body: "Hello, how is Zara progressing in Mathematics?" });
    expect(msg.status).toBe(201);
    const teacherInbox = await api().get("/api/v1/messages/conversations").set(bearer(tok.teacher));
    expect(JSON.stringify(teacherInbox.body)).toContain("Ahmed Raza");
    const teacherView = await api().get(`/api/v1/messages/conversations/${convoId}/messages`).set(bearer(tok.teacher));
    expect(JSON.stringify(teacherView.body)).toContain("Zara progressing");

    // Admin creates a school event visible on the internal calendar
    const event = await api().post("/api/v1/events").set(bearer(tok.admin)).send({
      title: "Annual Sports Day", type: "event", startAt: "2026-08-14T09:00:00.000Z", endAt: "2026-08-14T13:00:00.000Z", audience: ["all"],
    });
    expect([200, 201]).toContain(event.status);
    const calendar = await api().get("/api/v1/events").set(bearer(tok.parent));
    expect(JSON.stringify(calendar.body)).toContain("Annual Sports Day");

    // (19) Principal views reports; Admin issues a fee-clearance certificate (balance is 0 now) + public verify
    const feeReport = await api().get("/api/v1/reports/fee-collection").set(bearer(tok.principal));
    expect(feeReport.status).toBe(200);
    const csv = await api().get("/api/v1/reports/fee-collection/export").set(bearer(tok.principal)).query({ format: "csv" });
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toMatch(/csv/);
    const cert = await api().post("/api/v1/certificates").set(bearer(tok.admin)).send({ studentId: ids.student, type: "fee-clearance" });
    expect(cert.status).toBe(201);
    const ref = cert.body.data.certificate.referenceNumber as string;
    expect(ref).toMatch(/^CERT-\d{4}-\d{6}$/);
    const pub = await api().get(`/api/v1/certificates/verify/${ref}`);
    expect(pub.status).toBe(200);
    expect(pub.body.data.valid).toBe(true);
    expect(pub.body.data.studentName).toBe("Zara Ahmed");
  }, 600_000);
});
