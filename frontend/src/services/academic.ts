import { api } from './api';

/* Phase 5 Academic API client — mirrors backend /attendance, /timetable,
 * /exams, /marks, /results, /assignments, /study-materials, /leave and
 * /academics/my-assignments. All data comes from the real APIs; pages render
 * honest error/empty states when the DB is unavailable (503). */
export type Row = Record<string, unknown> & { _id: string };

/* ---------- Teacher scope ---------- */
export async function getMyAssignments(): Promise<{ profile: Row | null; assignments: Row[] }> {
  const r = await api.get('/academics/my-assignments');
  return { profile: (r.data.data.profile as Row | null) ?? null, assignments: (r.data.data.assignments as Row[]) ?? [] };
}

/* ---------- Attendance ---------- */
export async function getRoster(params: { classId: string; sectionId: string; sessionId: string; date?: string }): Promise<{ enrollments: Row[]; marked: Record<string, string> }> {
  const r = await api.get('/attendance/roster', { params });
  return r.data.data as { enrollments: Row[]; marked: Record<string, string> };
}
export async function bulkMarkAttendance(body: { classId: string; sectionId: string; sessionId: string; date: string; records: Array<{ studentId: string; status: string; note?: string }> }): Promise<{ count: number }> {
  const r = await api.post('/attendance/bulk', body);
  return r.data.data as { count: number };
}
export async function getClassAttendance(params: { classId: string; sectionId: string; sessionId: string; date: string }): Promise<Row[]> {
  const r = await api.get('/attendance/class', { params });
  return (r.data.data.items as Row[]) ?? [];
}
export async function correctAttendance(id: string, body: { status: string; note?: string }): Promise<Row> {
  const r = await api.put(`/attendance/${id}`, body);
  return r.data.data.record as Row;
}
export async function getAttendanceReport(params: Record<string, string>): Promise<Row> {
  const r = await api.get('/attendance/report', { params });
  return r.data.data.report as Row;
}
export async function getApprovedLeaves(params: Record<string, string>): Promise<Row[]> {
  const r = await api.get('/attendance/approved-leaves', { params });
  return (r.data.data.leaves as Row[]) ?? [];
}

/* ---------- Timetable ---------- */
export async function listTimetable(params: Record<string, string | number>): Promise<Row[]> {
  const r = await api.get('/timetable', { params });
  return (r.data.data.entries as Row[]) ?? [];
}
export async function createTimetableEntry(body: Row): Promise<Row> {
  const r = await api.post('/timetable', body);
  return r.data.data.entry as Row;
}
export async function updateTimetableEntry(id: string, body: Row): Promise<Row> {
  const r = await api.patch(`/timetable/${id}`, body);
  return r.data.data.entry as Row;
}
export async function deleteTimetableEntry(id: string): Promise<void> { await api.delete(`/timetable/${id}`); }

/* ---------- Exams / marks / results ---------- */
export async function listExams(params: Record<string, string | number> = {}): Promise<Row[]> {
  const r = await api.get('/exams', { params });
  return (r.data.data.exams as Row[]) ?? [];
}
export async function createExam(body: Row): Promise<Row> {
  const r = await api.post('/exams', body);
  return r.data.data.exam as Row;
}
export async function listExamSchedules(examId: string): Promise<Row[]> {
  const r = await api.get(`/exams/${examId}/schedules`);
  return (r.data.data.schedules as Row[]) ?? [];
}
export async function addExamSchedule(examId: string, body: Row): Promise<Row> {
  const r = await api.post(`/exams/${examId}/schedules`, body);
  return r.data.data.schedule as Row;
}
export async function approveExam(examId: string): Promise<Row> {
  const r = await api.post(`/exams/${examId}/approve`);
  return r.data.data.exam as Row;
}
export async function publishExam(examId: string): Promise<Row> {
  const r = await api.post(`/exams/${examId}/publish`);
  return r.data.data.exam as Row;
}
export async function enterMarksBulk(body: { examScheduleId: string; entries: Array<{ studentId: string; obtainedMarks: number }> }): Promise<{ count: number }> {
  const r = await api.post('/marks/bulk', body);
  return r.data.data as { count: number };
}
export async function listMarks(params: Record<string, string | number>): Promise<Row[]> {
  const r = await api.get('/marks', { params });
  return (r.data.data.marks as Row[]) ?? [];
}
export async function getReportCard(examId: string, studentId: string): Promise<Row> {
  const r = await api.get(`/results/report-card/${examId}/${studentId}`);
  return r.data.data.reportCard as Row;
}
export function reportCardPdfUrl(examId: string, studentId: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:5000/api/v1';
  return `${base}/results/report-card/${examId}/${studentId}/pdf`;
}

/* ---------- Assignments / submissions / materials ---------- */
export async function listAssignments(params: Record<string, string | number> = {}): Promise<Row[]> {
  const r = await api.get('/assignments', { params });
  return (r.data.data.assignments as Row[]) ?? [];
}
export async function createAssignment(body: Row): Promise<Row> {
  const r = await api.post('/assignments', body);
  return r.data.data.assignment as Row;
}
export async function listSubmissions(assignmentId: string): Promise<Row[]> {
  const r = await api.get(`/assignments/${assignmentId}/submissions`);
  return (r.data.data.submissions as Row[]) ?? [];
}
export async function gradeSubmission(submissionId: string, body: { marks?: number; feedback?: string; feedbackPublished?: boolean }): Promise<Row> {
  const r = await api.patch(`/assignments/submissions/${submissionId}/grade`, body);
  return r.data.data.submission as Row;
}
export async function submitAssignment(assignmentId: string, body: { content?: string; attachments?: Array<Record<string, unknown>> }): Promise<Row> {
  const r = await api.post(`/assignments/${assignmentId}/submissions`, body);
  return r.data.data.submission as Row;
}
export async function getMySubmission(assignmentId: string, params: Record<string, string> = {}): Promise<Row> {
  const r = await api.get(`/assignments/${assignmentId}/my-submission`, { params });
  return r.data.data.submission as Row;
}
export async function getTimetableByStudent(studentId: string): Promise<{ enrollment: Row | null; entries: Row[] }> {
  const r = await api.get(`/timetable/by-student/${studentId}`);
  return { enrollment: (r.data.data.enrollment as Row | null) ?? null, entries: (r.data.data.entries as Row[]) ?? [] };
}
export async function listMaterials(params: Record<string, string | number> = {}): Promise<Row[]> {
  const r = await api.get('/study-materials', { params });
  return (r.data.data.materials as Row[]) ?? [];
}
export async function createMaterial(body: Row): Promise<Row> {
  const r = await api.post('/study-materials', body);
  return r.data.data.material as Row;
}
export async function deleteMaterial(id: string): Promise<void> { await api.delete(`/study-materials/${id}`); }

/* ---------- Leave ---------- */
export async function listLeave(params: Record<string, string | number> = {}): Promise<Row[]> {
  const r = await api.get('/leave', { params });
  return (r.data.data.leaves as Row[]) ?? [];
}
export async function createLeave(body: Row): Promise<Row> {
  const r = await api.post('/leave', body);
  return r.data.data.leave as Row;
}
export async function decideLeave(id: string, body: { status: 'approved' | 'rejected'; decisionNote?: string }): Promise<Row> {
  const r = await api.patch(`/leave/${id}/decide`, body);
  return r.data.data.leave as Row;
}

/* ---------- Small render helpers ---------- */
export function refObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}
export function refName(v: unknown): string {
  const o = refObj(v);
  if (typeof o.name === 'string') return o.name;
  const user = refObj(o.user);
  if (typeof user.name === 'string') return user.name as string;
  if (typeof o.firstName === 'string') return `${o.firstName} ${(o.lastName as string) ?? ''}`.trim();
  return '—';
}
export function studentLabel(v: unknown): string {
  const o = refObj(v);
  const name = `${(o.firstName as string) ?? ''} ${(o.lastName as string) ?? ''}`.trim();
  const adm = (o.admissionNumber as string) ?? '';
  return name ? `${name}${adm ? ` (${adm})` : ''}` : adm || '—';
}
