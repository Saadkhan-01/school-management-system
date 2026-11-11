import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestDb, stopTestDb } from "../helpers/testDb";
import { api, bearer } from "../helpers/api";
import { buildSchool, loginAs, seedUser, type SchoolFixture } from "../helpers/seed";
import { Student } from "../../src/modules/students/student.model";
import { Enrollment } from "../../src/modules/enrollments/enrollment.model";
import { ParentStudent } from "../../src/modules/parents/parent.model";

/**
 * §36 — Academics suite: admission intake → review → approve → enroll
 * conversion (incl. the standalone-mongod SEQUENTIAL FALLBACK path, since
 * multi-document transactions are unavailable), duplicate enrollment 409,
 * attendance duplicate 409, timetable teacher conflict 409, marks > max 422,
 * unpublished results hidden (404) → publish → report card readable.
 */
describe("§36 Academics", () => {
  let fx: SchoolFixture;
  let tok: Record<string, string> = {};
  beforeAll(async () => {
    await startTestDb();
    fx = await buildSchool();
    for (const [key, u] of Object.entries({ admin: fx.admin, principal: fx.principal, teacher: fx.teacher, receptionist: fx.receptionist })) {
      tok[key] = (await loginAs(u.email, u.password)).token;
    }
    const { User } = await import("../../src/modules/users/user.model");
    const su = await User.findById(fx.studentAUserId).lean();
    tok.student = (await loginAs(su!.email)).token;
  }, 300_000);
  afterAll(async () => { await stopTestDb(); });

  it("admission intake → review → approve → enroll conversion creates student + verified parent link + active enrollment", async () => {
    // 1. Public intake (no auth)
    const pub = await api().post("/api/v1/admissions/public").send({
      studentName: "Hira Malik", dateOfBirth: "2015-02-14", gender: "female",
      guardianName: "Malik Senior", guardianPhone: "03009998887", guardianEmail: "hira.guardian@test.local",
      desiredClass: "Class 6", address: "12 Canal Road, Test City",
    });
    expect(pub.status).toBe(201);
    const appId = pub.body.data.id as string;
    expect(pub.body.data.status).toBe("Submitted");

    // 2. Direct approve from Submitted is out of sequence → 409
    const skip = await api().patch(`/api/v1/admissions/${appId}/status`).set(bearer(tok.admin)).send({ status: "Approved" });
    expect(skip.status).toBe(409);
    expect(skip.body.error.code).toBe("INVALID_STATUS_TRANSITION");

    // 3. Receptionist moves to Under Review; receptionist CANNOT approve (deciding role) → 403
    const review = await api().patch(`/api/v1/admissions/${appId}/status`).set(bearer(tok.receptionist)).send({ status: "Under Review" });
    expect(review.status).toBe(200);
    const recApprove = await api().patch(`/api/v1/admissions/${appId}/status`).set(bearer(tok.receptionist)).send({ status: "Approved" });
    expect(recApprove.status).toBe(403);

    // 4. Principal approves
    const approve = await api().patch(`/api/v1/admissions/${appId}/status`).set(bearer(tok.principal)).send({ status: "Approved" });
    expect(approve.status).toBe(200);
    expect(approve.body.data.application.status).toBe("Approved");

    // 5. PATCH to Enrolled is refused with a pointer to the enroll endpoint
    const patchEnroll = await api().patch(`/api/v1/admissions/${appId}/status`).set(bearer(tok.admin)).send({ status: "Enrolled" });
    expect(patchEnroll.status).toBe(422);
    expect(patchEnroll.body.error.code).toBe("USE_ENROLL_ENDPOINT");

    // 6. Enroll (Admin only) — standalone mongod has NO transactions, so the
    //    service's documented SEQUENTIAL FALLBACK path is what executes here.
    const enroll = await api().post(`/api/v1/admissions/${appId}/enroll`).set(bearer(tok.admin)).send({
      sessionId: fx.sessionId, classId: fx.classId, sectionId: fx.sectionId,
      parentPassword: "Guardian#123",
    });
    expect(enroll.status).toBe(201);
    const { student, parent, enrollment, application } = enroll.body.data;
    expect(student.admissionNumber).toMatch(/^ADM-\d{4}-\d{4}$/);
    expect(application.status).toBe("Enrolled");
    expect(enrollment.id).toBeTruthy();
    expect(parent.created).toBe(true);

    // DB-level proof: student, ACTIVE enrollment, VERIFIED parent link
    const dbStudent = await Student.findById(student.id).lean();
    expect(dbStudent?.admissionNumber).toBe(student.admissionNumber);
    const dbEnr = await Enrollment.findOne({ student: student.id, status: "active" }).lean();
    expect(dbEnr).toBeTruthy();
    expect(String(dbEnr!._id)).toBe(enrollment.id);
    const link = await ParentStudent.findOne({ parentUser: parent.userId, student: student.id }).lean();
    expect(link?.verified).toBe(true);
    // The guardian can actually log in with the password set at conversion
    const guardianLogin = await api().post("/api/v1/auth/login").send({ email: "hira.guardian@test.local", password: "Guardian#123" });
    expect(guardianLogin.status).toBe(200);
    expect(guardianLogin.body.data.user.role).toBe("parent");

    // 7. Second enroll → 409 ALREADY_ENROLLED
    const again = await api().post(`/api/v1/admissions/${appId}/enroll`).set(bearer(tok.admin)).send({ sessionId: fx.sessionId, classId: fx.classId, sectionId: fx.sectionId, parentPassword: "Guardian#123" });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("ALREADY_ENROLLED");
  });

  it("duplicate ACTIVE enrollment for the same student + session → 409", async () => {
    const dupe = await api().post("/api/v1/enrollments").set(bearer(tok.admin)).send({
      studentId: fx.studentA._id, sessionId: fx.sessionId, classId: fx.classId, sectionId: fx.sectionId,
    });
    expect(dupe.status).toBe(409);
    expect(dupe.body.error.code).toBe("ALREADY_ENROLLED");
  });

  it("attendance: mark once → 201; duplicate day → 409 ATTENDANCE_ALREADY_MARKED", async () => {
    const body = {
      classId: fx.classId, sectionId: fx.sectionId, sessionId: fx.sessionId, date: "2026-04-06",
      records: [{ studentId: fx.studentA._id, status: "present" }, { studentId: fx.studentB._id, status: "absent" }],
    };
    const first = await api().post("/api/v1/attendance/bulk").set(bearer(tok.teacher)).send(body);
    expect(first.status).toBe(201);
    const second = await api().post("/api/v1/attendance/bulk").set(bearer(tok.teacher)).send(body);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("ATTENDANCE_ALREADY_MARKED");
  });

  it("timetable: second entry for the same teacher at an overlapping time → 409 TEACHER_CONFLICT", async () => {
    const entry = {
      sessionId: fx.sessionId, classId: fx.classId, sectionId: fx.sectionId, subjectId: fx.subjectId,
      teacherId: fx.teacherProfileId, classroomId: fx.classroomId,
      weekday: "monday", periodNumber: 1, startTime: "08:00", endTime: "08:45",
    };
    const first = await api().post("/api/v1/timetable").set(bearer(tok.admin)).send(entry);
    expect(first.status).toBe(201);
    const clash = await api().post("/api/v1/timetable").set(bearer(tok.admin)).send({ ...entry, periodNumber: 2, startTime: "08:30", endTime: "09:15" });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe("TIMETABLE_TEACHER_CONFLICT");
  });

  it("marks & results: >max 422; unpublished → student 404; approve → publish → report card JSON readable with computed grade", async () => {
    // Exam + schedule (max 100)
    const exam = await api().post("/api/v1/exams").set(bearer(tok.admin)).send({
      name: "Midterm 2026", type: "Midterm", sessionId: fx.sessionId, classIds: [fx.classId], gradingScaleId: fx.gradingScaleId,
    });
    expect(exam.status).toBe(201);
    const examId = exam.body.data.exam._id as string;
    const sched = await api().post(`/api/v1/exams/${examId}/schedules`).set(bearer(tok.admin)).send({
      classId: fx.classId, sectionId: fx.sectionId, subjectId: fx.subjectId, date: "2026-05-11", maxMarks: 100,
    });
    expect(sched.status).toBe(201);
    const scheduleId = sched.body.data.schedule._id as string;

    // Marks above the schedule maximum → 422
    const tooHigh = await api().post("/api/v1/marks/bulk").set(bearer(tok.teacher)).send({
      examScheduleId: scheduleId, entries: [{ studentId: fx.studentA._id, obtainedMarks: 101 }],
    });
    expect(tooHigh.status).toBe(422);
    expect(tooHigh.body.error.code).toBe("MARKS_EXCEED_MAX");

    // Valid marks for both students (teacher is assigned to this class+subject)
    const marks = await api().post("/api/v1/marks/bulk").set(bearer(tok.teacher)).send({
      examScheduleId: scheduleId,
      entries: [
        { studentId: fx.studentA._id, obtainedMarks: 85 },
        { studentId: fx.studentB._id, obtainedMarks: 42 },
      ],
    });
    expect(marks.status).toBe(201);

    // Unpublished: the student cannot see any result (404, existence not leaked)
    const hidden = await api().get(`/api/v1/results/report-card/${examId}/${fx.studentA._id}`).set(bearer(tok.student));
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe("RESULT_NOT_PUBLISHED");

    // Approve (principal) then publish (principal)
    const approve = await api().post(`/api/v1/exams/${examId}/approve`).set(bearer(tok.principal));
    expect(approve.status).toBe(200);
    const publish = await api().post(`/api/v1/exams/${examId}/publish`).set(bearer(tok.principal));
    expect(publish.status).toBe(200);

    // Now the student CAN read the report card JSON: 85/100 → overall grade A per the fixture scale
    const card = await api().get(`/api/v1/results/report-card/${examId}/${fx.studentA._id}`).set(bearer(tok.student));
    expect(card.status).toBe(200);
    const rc = card.body.data.reportCard;
    const math = (rc.subjects as Array<{ obtainedMarks: number; maxMarks: number; percentage: number }>).find((s) => s.maxMarks === 100);
    expect(math?.obtainedMarks).toBe(85);
    expect(math?.percentage).toBe(85);
    expect(rc.percentage).toBe(85);
    expect(rc.grade).toBe("A");
    expect(rc.totalObtained).toBe(85);
    expect(rc.totalMax).toBe(100);
  });

  it("one login account fronts exactly ONE student record (unique user link → 409)", async () => {
    const other = await seedUser("student");
    const fresh = await api().post("/api/v1/students").set(bearer(tok.admin)).send({
      firstName: "Copy", lastName: "Cat", dateOfBirth: "2014-01-01", gender: "male",
      guardianName: "Copy Guardian", guardianPhone: "03005554443",
    });
    expect(fresh.status).toBe(201); // a new record without a login is fine…
    const relink = await api().post("/api/v1/students").set(bearer(tok.admin)).send({
      userId: fx.studentAUserId, firstName: "Second", lastName: "Record", dateOfBirth: "2014-01-01", gender: "female",
      guardianName: "Second Guardian", guardianPhone: "03005554444",
    });
    expect(relink.status).toBe(409); // …but student A's account is already linked to student A
    expect(other.id).toBeTruthy();
  });
});
