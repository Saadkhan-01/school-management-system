import { api } from './api';

/* Phase 4 Admin API client — mirrors backend /users, /students, /parents,
 * /teachers, /staff, /academics, /enrollments, /admissions/:id/enroll, /reports. */
export interface PageMeta { page: number; limit: number; total: number; pages: number }
export interface ListOut<T> { items: T[]; meta: PageMeta }
type Row = Record<string, unknown> & { _id: string };

async function list<T>(path: string, key: string, params: Record<string, string | number>): Promise<ListOut<T>> {
  const r = await api.get(path, { params });
  return { items: (r.data.data[key] as T[]) ?? [], meta: r.data.meta as PageMeta };
}
const qs = (p: { page?: number; limit?: number; search?: string; filters?: Record<string, string> }) => {
  const out: Record<string, string | number> = { page: p.page ?? 1, limit: p.limit ?? 20 };
  if (p.search) out.search = p.search;
  for (const [k, v] of Object.entries(p.filters ?? {})) if (v) out[k] = v;
  return out;
};

/* ---------- Users ---------- */
export const listUsers = (p: Parameters<typeof qs>[0]) => list<Row>('/users', 'users', qs(p));
export const createUser = async (body: Row) => (await api.post('/users', body)).data.data.user as Row;
export const updateUser = async (id: string, body: Row) => (await api.patch(`/users/${id}`, body)).data.data.user as Row;
export const setUserActive = async (id: string, isActive: boolean) => (await api.patch(`/users/${id}/status`, { isActive })).data.data.user as Row;
export const resetUserPassword = async (id: string, newPassword: string) => { await api.post(`/users/${id}/reset-password`, { newPassword }); };
export const deleteUser = async (id: string) => { await api.delete(`/users/${id}`); };
export interface LoginEvent { at: string; ip?: string; userAgent?: string; success: boolean }
export async function getLoginHistory(id: string): Promise<{ user: Row; history: LoginEvent[] }> {
  const r = await api.get(`/users/${id}/login-history`, { params: { limit: 50 } });
  return { user: r.data.data.user as Row, history: r.data.data.loginHistory as LoginEvent[] };
}

/* ---------- Students ---------- */
export const listStudents = (p: Parameters<typeof qs>[0]) => list<Row>('/students', 'students', qs(p));
export const createStudent = async (body: Row) => (await api.post('/students', body)).data.data.student as Row;
export const updateStudent = async (id: string, body: Row) => (await api.patch(`/students/${id}`, body)).data.data.student as Row;
export const setStudentStatus = async (id: string, status: string) => (await api.patch(`/students/${id}/status`, { status })).data.data.student as Row;

/* ---------- Parents + links ---------- */
export const listParents = (p: Parameters<typeof qs>[0]) => list<Row>('/parents', 'parents', qs(p));
export const createParent = async (body: Row) => (await api.post('/parents', body)).data.data.parent as Row;
export const updateParent = async (id: string, body: Row) => (await api.patch(`/parents/${id}`, body)).data.data.parent as Row;
export const listParentLinks = async (parentId: string) => (await api.get(`/parents/${parentId}/students`)).data.data.links as Row[];
export const linkParentStudent = async (parentId: string, body: Row) => (await api.post(`/parents/${parentId}/students`, body)).data.data.link as Row;
export const unlinkParentStudent = async (parentId: string, studentId: string) => { await api.delete(`/parents/${parentId}/students/${studentId}`); };
export const setLinkVerified = async (parentId: string, studentId: string, verified: boolean) => { await api.patch(`/parents/${parentId}/students/${studentId}/verify`, { verified }); };

/* ---------- Teachers / Staff ---------- */
export const listTeachers = (p: Parameters<typeof qs>[0]) => list<Row>('/teachers', 'teachers', qs(p));
export const createTeacher = async (body: Row) => (await api.post('/teachers', body)).data.data.teacher as Row;
export const updateTeacher = async (id: string, body: Row) => (await api.patch(`/teachers/${id}`, body)).data.data.teacher as Row;
export const listStaff = (p: Parameters<typeof qs>[0]) => list<Row>('/staff', 'staff', qs(p));
export const createStaff = async (body: Row) => (await api.post('/staff', body)).data.data.staff as Row;
export const updateStaff = async (id: string, body: Row) => (await api.patch(`/staff/${id}`, body)).data.data.staff as Row;

/* ---------- Academics ---------- */
export const listSessions = (p: Parameters<typeof qs>[0] = {}) => list<Row>('/academics/sessions', 'sessions', qs(p));
export const createSession = async (body: Row) => (await api.post('/academics/sessions', body)).data.data.session as Row;
export const updateSession = async (id: string, body: Row) => (await api.patch(`/academics/sessions/${id}`, body)).data.data.session as Row;
export const deleteSession = async (id: string) => { await api.delete(`/academics/sessions/${id}`); };
export const listClasses = (p: Parameters<typeof qs>[0] = {}) => list<Row>('/academics/classes', 'classes', qs(p));
export const createClass = async (body: Row) => (await api.post('/academics/classes', body)).data.data.class as Row;
export const updateClass = async (id: string, body: Row) => (await api.patch(`/academics/classes/${id}`, body)).data.data.class as Row;
export const deleteClass = async (id: string) => { await api.delete(`/academics/classes/${id}`); };
export const listSections = (p: Parameters<typeof qs>[0] = {}) => list<Row>('/academics/sections', 'sections', qs(p));
export const createSection = async (body: Row) => (await api.post('/academics/sections', body)).data.data.section as Row;
export const updateSection = async (id: string, body: Row) => (await api.patch(`/academics/sections/${id}`, body)).data.data.section as Row;
export const deleteSection = async (id: string) => { await api.delete(`/academics/sections/${id}`); };
export const listSubjects = (p: Parameters<typeof qs>[0] = {}) => list<Row>('/academics/subjects', 'subjects', qs(p));
export const createSubject = async (body: Row) => (await api.post('/academics/subjects', body)).data.data.subject as Row;
export const updateSubject = async (id: string, body: Row) => (await api.patch(`/academics/subjects/${id}`, body)).data.data.subject as Row;
export const deleteSubject = async (id: string) => { await api.delete(`/academics/subjects/${id}`); };
export const listClassrooms = (p: Parameters<typeof qs>[0] = {}) => list<Row>('/academics/classrooms', 'classrooms', qs(p));
export const createClassroom = async (body: Row) => (await api.post('/academics/classrooms', body)).data.data.classroom as Row;
export const updateClassroom = async (id: string, body: Row) => (await api.patch(`/academics/classrooms/${id}`, body)).data.data.classroom as Row;
export const deleteClassroom = async (id: string) => { await api.delete(`/academics/classrooms/${id}`); };
export const listGradingScales = (p: Parameters<typeof qs>[0] = {}) => list<Row>('/academics/grading-scales', 'gradingScales', qs(p));
export const createGradingScale = async (body: Row) => (await api.post('/academics/grading-scales', body)).data.data.gradingScale as Row;
export const updateGradingScale = async (id: string, body: Row) => (await api.patch(`/academics/grading-scales/${id}`, body)).data.data.gradingScale as Row;
export const deleteGradingScale = async (id: string) => { await api.delete(`/academics/grading-scales/${id}`); };
export const listTeacherAssignments = (p: Parameters<typeof qs>[0] = {}) => list<Row>('/academics/teacher-assignments', 'assignments', qs(p));
export const createTeacherAssignment = async (body: Row) => (await api.post('/academics/teacher-assignments', body)).data.data.assignment as Row;
export const deleteTeacherAssignment = async (id: string) => { await api.delete(`/academics/teacher-assignments/${id}`); };

/* ---------- Enrollments ---------- */
export const listEnrollments = (p: Parameters<typeof qs>[0]) => list<Row>('/enrollments', 'enrollments', qs(p));
export const createEnrollment = async (body: Row) => (await api.post('/enrollments', body)).data.data.enrollment as Row;
export const transferEnrollment = async (id: string, body: Row) => (await api.post(`/enrollments/${id}/transfer`, body)).data.data.enrollment as Row;
export const withdrawEnrollment = async (id: string, body: Row = {} as Row) => (await api.post(`/enrollments/${id}/withdraw`, body)).data.data.enrollment as Row;
export const promoteEnrollment = async (id: string, body: Row) => (await api.post(`/enrollments/${id}/promote`, body)).data.data.enrollment as Row;

/* ---------- Admission conversion ---------- */
export interface EnrollResult {
  student: { id: string; admissionNumber: string; firstName: string; lastName: string };
  parent: { userId: string; profileId: string; created: boolean; devTemporaryPassword?: string };
  enrollment: { id: string; sessionId: string; classId: string; sectionId: string };
  feeStructureNote: string;
  notificationNote: string;
}
export async function enrollApplication(id: string, body: { sessionId: string; classId: string; sectionId: string; note?: string }): Promise<EnrollResult> {
  const r = await api.post(`/admissions/${id}/enroll`, body);
  return r.data.data as EnrollResult;
}

/* ---------- Dashboard stats ---------- */
export interface DashboardStats {
  variant: string;
  generatedAt: string;
  currentSession: { id: string; name: string } | null;
  totals: { students: number; activeStudents: number; teachers: number; staff: number; parents: number; classes: number; sections: number; subjects: number; users: number; activeEnrollments: number };
  admissions: { pending: number; submitted: number; underReview: number; approvedAwaitingEnrollment: number };
  usersByRole: Record<string, number>;
  attendanceToday: null;
  attendanceNote: string;
  fees: null;
  feesNote: string;
}
export async function getDashboardStats(variant: 'admin' | 'principal'): Promise<DashboardStats> {
  const r = await api.get(`/reports/dashboard/${variant}`);
  return r.data.data.stats as DashboardStats;
}

/* ---------- Small shared helpers for rendering populated refs ---------- */
export type AnyRow = Row;
export function refName(v: unknown): string {
  if (!v || typeof v !== 'object') return '—';
  const o = v as Record<string, unknown>;
  if (typeof o.name === 'string') return o.name;
  const user = o.user as Record<string, unknown> | undefined;
  if (user && typeof user.name === 'string') return user.name as string;
  return '—';
}
export function userName(row: Row): string {
  const u = row.user as Record<string, unknown> | undefined;
  return u && typeof u.name === 'string' ? (u.name as string) : '—';
}
export function userEmail(row: Row): string {
  const u = row.user as Record<string, unknown> | undefined;
  return u && typeof u.email === 'string' ? (u.email as string) : '—';
}
export function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}
