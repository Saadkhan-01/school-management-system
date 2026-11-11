import { api } from './api';
import type { Row } from './academic';

/* Phase 6 Portal API client — mirrors backend /portal aggregates, the
 * /portal/announcements role-sliced feed, and /auth self-service
 * (GET /auth/me, PATCH /auth/me/profile, POST /auth/change-password).
 * Everything renders from these real responses; pages show honest
 * loading/empty/error states and never invent numbers. */
export type { Row };

export async function getStudentPortal(): Promise<Row> {
  const r = await api.get('/portal/student/me');
  return r.data.data as Row;
}

export async function getParentPortal(): Promise<Row> {
  const r = await api.get('/portal/parent/me');
  return r.data.data as Row;
}

export async function getChildSummary(studentId: string): Promise<Row> {
  const r = await api.get(`/portal/parent/children/${studentId}/summary`);
  return r.data.data as Row;
}

export async function listPortalAnnouncements(): Promise<{ announcements: Row[]; audiences: string[] }> {
  const r = await api.get('/portal/announcements');
  return { announcements: (r.data.data.announcements as Row[]) ?? [], audiences: (r.data.data.audiences as string[]) ?? [] };
}

export async function getMyAccount(): Promise<Row> {
  const r = await api.get('/auth/me');
  return r.data.data.user as Row;
}

export async function updateMyProfile(body: { name?: string; phone?: string }): Promise<Row> {
  const r = await api.patch('/auth/me/profile', body);
  return r.data.data.user as Row;
}

export async function changeMyPassword(body: { currentPassword: string; newPassword: string }): Promise<void> {
  await api.post('/auth/change-password', body);
}
