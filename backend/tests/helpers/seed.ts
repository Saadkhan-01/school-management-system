import bcrypt from "bcryptjs";
import { User, type UserRole } from "../../src/modules/users/user.model";
import { Student } from "../../src/modules/students/student.model";
import { api, agent, bearer } from "./api";

/**
 * Seed/fixture factory for the §36 integration suites.
 * Users and login accounts are created directly in the DB (bcrypt cost 4 —
 * the hash cost is irrelevant to what is being tested and keeps the suite
 * fast); EVERYTHING business-shaped (students, sessions, enrollments,
 * invoices, payments…) is created through the real HTTP API so the fixtures
 * themselves exercise the production code path.
 */
export const PASSWORD = "TestPass#123";
const FAST_SALT = 4;

let seq = 0;
const uniq = (tag: string) => `${tag}-${Date.now().toString(36)}-${(seq += 1)}`;

export async function seedUser(role: UserRole, opts: { email?: string; password?: string; name?: string; isActive?: boolean } = {}) {
  const password = opts.password ?? PASSWORD;
  const user = await User.create({
    name: opts.name ?? `Test ${role}`,
    email: (opts.email ?? `${uniq(role)}@test.local`).toLowerCase(),
    passwordHash: await bcrypt.hash(password, FAST_SALT),
    role,
    isActive: opts.isActive ?? true,
    isVerified: true,
  });
  return { user, password, id: String(user._id), email: user.email };
}

/** Log in through the real API; returns { token, agent } — the agent carries the refresh cookie. */
export async function loginAs(email: string, password = PASSWORD) {
  const ag = agent();
  const res = await ag.post("/api/v1/auth/login").send({ email, password });
  if (res.status !== 200) throw new Error(`loginAs(${email}) failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.data.accessToken as string, agent: ag, user: res.body.data.user };
}

export interface SchoolFixture {
  admin: Awaited<ReturnType<typeof seedUser>>;
  principal: Awaited<ReturnType<typeof seedUser>>;
  teacher: Awaited<ReturnType<typeof seedUser>>;      // assigned teacher (profile + assignment)
  teacher2: Awaited<ReturnType<typeof seedUser>>;     // teacher with profile, NO assignment
  accountant: Awaited<ReturnType<typeof seedUser>>;
  librarian: Awaited<ReturnType<typeof seedUser>>;
  receptionist: Awaited<ReturnType<typeof seedUser>>;
  parent: Awaited<ReturnType<typeof seedUser>>;       // verified link to studentA
  parent2: Awaited<ReturnType<typeof seedUser>>;      // UNVERIFIED link to studentA only
  parentUserId: string; parentProfileId: string;
  parent2UserId: string; parent2ProfileId: string;
  sessionId: string; classId: string; sectionId: string; subjectId: string; classroomId: string;
  teacherProfileId: string; teacher2ProfileId: string;
  studentA: Record<string, unknown> & { _id: string };  // has a linked student login too
  studentB: Record<string, unknown> & { _id: string };  // no login, no parent link
  studentAUserId: string;
  enrollmentAId: string; enrollmentBId: string;
  gradingScaleId: string;
}

async function must<T>(promise: Promise<{ status: number; body: { data: T } }>, label: string, expect = [200, 201]): Promise<T> {
  const res = await promise as unknown as { status: number; body: { data: T; error?: unknown } };
  if (!expect.includes(res.status)) throw new Error(`fixture step "${label}" failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
}

/** Build a minimal but complete school: roles, session/class/section/subject, teacher assignment, two students enrolled, one verified + one unverified parent link. */
export async function buildSchool(): Promise<SchoolFixture> {
  const admin = await seedUser("admin", { email: `admin-${uniq("a")}@test.local` });
  const { token: A } = await loginAs(admin.email, admin.password);
  const principal = await seedUser("principal");
  const accountant = await seedUser("accountant");
  const librarian = await seedUser("librarian");
  const receptionist = await seedUser("receptionist");
  const teacherU = await seedUser("teacher");
  const teacher2U = await seedUser("teacher");

  // Academics
  const session = await must(api().post("/api/v1/academics/sessions").set(bearer(A)).send({ name: `Session ${uniq("s")}`, startDate: "2026-01-01", endDate: "2026-12-31", isCurrent: true }), "session") as { session: { _id: string } };
  const sessionId = session.session._id;
  const cls = await must(api().post("/api/v1/academics/classes").set(bearer(A)).send({ name: `Class ${uniq("c")}`, sessionId, level: 6 }), "class") as { class: { _id: string } };
  const classId = cls.class._id;
  const sec = await must(api().post("/api/v1/academics/sections").set(bearer(A)).send({ classId, name: "A" }), "section") as { section: { _id: string } };
  const sectionId = sec.section._id;
  const subj = await must(api().post("/api/v1/academics/subjects").set(bearer(A)).send({ name: "Mathematics", code: `MATH-${uniq("m")}`, sessionId }), "subject") as { subject: { _id: string } };
  const subjectId = subj.subject._id;
  const room = await must(api().post("/api/v1/academics/classrooms").set(bearer(A)).send({ name: `Room ${uniq("r")}`, capacity: 40 }), "classroom") as { classroom: { _id: string } };
  const scale = await must(api().post("/api/v1/academics/grading-scales").set(bearer(A)).send({
    name: "Standard scale", sessionId, isDefault: true,
    ranges: [
      { min: 90, max: 100, grade: "A+", points: 4 },
      { min: 80, max: 89, grade: "A", points: 3.7 },
      { min: 70, max: 79, grade: "B", points: 3 },
      { min: 60, max: 69, grade: "C", points: 2 },
      { min: 50, max: 59, grade: "D", points: 1 },
      { min: 0, max: 49, grade: "F", points: 0 },
    ],
  }), "grading scale") as { gradingScale: { _id: string } };

  // Teacher profiles + assignment (teacher yes, teacher2 no)
  const t1 = await must(api().post("/api/v1/teachers").set(bearer(A)).send({ userId: teacherU.id, employeeId: `EMP-${uniq("t")}` }), "teacher profile") as { teacher: { _id: string } };
  const t2 = await must(api().post("/api/v1/teachers").set(bearer(A)).send({ userId: teacher2U.id, employeeId: `EMP-${uniq("t")}` }), "teacher2 profile") as { teacher: { _id: string } };
  await must(api().post("/api/v1/academics/teacher-assignments").set(bearer(A)).send({ teacherId: t1.teacher._id, classId, sectionId, subjectId, sessionId }), "teacher assignment");

  // Students: A gets a login account, B does not (matches admission-conversion output)
  const studentAUser = await seedUser("student");
  const studentAResp = await must(api().post("/api/v1/students").set(bearer(A)).send({
    userId: studentAUser.id, firstName: "Ayesha", lastName: "Khan", dateOfBirth: "2014-05-10", gender: "female",
    guardianName: "Parent One", guardianPhone: "03001234567", guardianEmail: "guardian-a@test.local",
  }), "student A") as { student: Record<string, unknown> & { _id: string } };
  const studentA = studentAResp.student;
  const studentBResp = await must(api().post("/api/v1/students").set(bearer(A)).send({
    firstName: "Bilal", lastName: "Raza", dateOfBirth: "2014-08-20", gender: "male",
    guardianName: "Guardian B", guardianPhone: "03007654321",
  }), "student B") as { student: Record<string, unknown> & { _id: string } };
  const studentB = studentBResp.student;

  // Enrollments
  const enrA = await must(api().post("/api/v1/enrollments").set(bearer(A)).send({ studentId: studentA._id, sessionId, classId, sectionId }), "enrollment A") as { enrollment: { _id: string } };
  const enrB = await must(api().post("/api/v1/enrollments").set(bearer(A)).send({ studentId: studentB._id, sessionId, classId, sectionId }), "enrollment B") as { enrollment: { _id: string } };

  // Parents: parent = VERIFIED link to A; parent2 = UNVERIFIED link to A
  const parent = await seedUser("parent");
  const parentProfile = await must(api().post("/api/v1/parents").set(bearer(A)).send({ userId: parent.id, phone: "03001112223" }), "parent profile") as { parent: { _id: string } };
  const parentProfileId = (parentProfile as unknown as { _id?: string })._id ?? (parentProfile.parent?._id as string);
  await must(api().post(`/api/v1/parents/${parentProfileId}/students`).set(bearer(A)).send({ studentId: studentA._id, relationship: "Father", verified: true }), "verified link");
  const parent2 = await seedUser("parent");
  const parent2Profile = await must(api().post("/api/v1/parents").set(bearer(A)).send({ userId: parent2.id, phone: "03004445556" }), "parent2 profile") as { parent: { _id: string } };
  const parent2ProfileId = (parent2Profile as unknown as { _id?: string })._id ?? (parent2Profile.parent?._id as string);
  await must(api().post(`/api/v1/parents/${parent2ProfileId}/students`).set(bearer(A)).send({ studentId: studentA._id, relationship: "Mother", verified: false }), "unverified link");

  return {
    admin, principal, teacher: teacherU, teacher2: teacher2U, accountant, librarian, receptionist,
    parent, parent2,
    parentUserId: parent.id, parentProfileId, parent2UserId: parent2.id, parent2ProfileId,
    sessionId, classId, sectionId, subjectId, classroomId: room.classroom._id,
    teacherProfileId: t1.teacher._id, teacher2ProfileId: t2.teacher._id,
    studentA, studentB, studentAUserId: studentAUser.id,
    enrollmentAId: enrA.enrollment._id, enrollmentBId: enrB.enrollment._id,
    gradingScaleId: scale.gradingScale._id,
  };
}
