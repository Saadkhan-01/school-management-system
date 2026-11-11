import { io, type Socket } from 'socket.io-client';
import { api, tokenStore } from './api';
import type { Row } from './academic';

export type { Row };

/** Phase 9 — Communication & Reporting API (§23/§24/§27/§33). All calls go
 *  through the shared axios instance (Bearer token + refresh handling). */

// ---------- Notifications ----------
export async function listNotifications(params: Record<string, unknown> = {}): Promise<{ notifications: Row[]; unread: number; total: number }> {
  const res = await api.get('/notifications', { params });
  const d = res.data.data as { notifications: Row[]; unread: number };
  return { notifications: d.notifications, unread: d.unread, total: (res.data.meta?.total as number) ?? d.notifications.length };
}
export async function unreadCount(): Promise<number> {
  const res = await api.get('/notifications/unread-count');
  return (res.data.data as { unread: number }).unread;
}
export async function markNotificationRead(id: string): Promise<void> { await api.patch(`/notifications/${id}/read`); }
export async function markAllNotificationsRead(): Promise<number> {
  const res = await api.patch('/notifications/read-all');
  return (res.data.data as { updated: number }).updated;
}

// ---------- Socket (real-time notifications; degrades silently) ----------
let socket: Socket | null = null;
export function connectNotificationSocket(onNotification: () => void): () => void {
  const token = tokenStore.get();
  if (!token) return () => undefined;
  const base = (api.defaults.baseURL ?? 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');
  try {
    socket = io(base, { auth: { token }, transports: ['websocket', 'polling'], reconnectionAttempts: 3, timeout: 5000 });
    socket.on('notification', onNotification);
    socket.on('connect_error', () => { /* silent: REST polling still works */ });
  } catch { socket = null; }
  return () => { try { socket?.off('notification', onNotification); socket?.disconnect(); } catch { /* noop */ } socket = null; };
}

// ---------- Messages ----------
export async function listContacts(): Promise<Row[]> {
  const res = await api.get('/messages/contacts');
  return (res.data.data as { contacts: Row[] }).contacts;
}
export async function listConversations(): Promise<Row[]> {
  const res = await api.get('/messages/conversations');
  return (res.data.data as { conversations: Row[] }).conversations;
}
export async function createConversation(otherUserId: string, studentId?: string): Promise<Row> {
  const res = await api.post('/messages/conversations', { otherUserId, ...(studentId ? { studentId } : {}) });
  return (res.data.data as { conversation: Row }).conversation;
}
export async function listMessages(conversationId: string): Promise<Row[]> {
  const res = await api.get(`/messages/conversations/${conversationId}/messages`, { params: { limit: 200 } });
  return (res.data.data as { messages: Row[] }).messages;
}
export async function sendMessage(conversationId: string, body: string): Promise<Row> {
  const res = await api.post(`/messages/conversations/${conversationId}/messages`, { body });
  return (res.data.data as { message: Row }).message;
}
export async function markConversationRead(conversationId: string): Promise<void> { await api.patch(`/messages/conversations/${conversationId}/read`); }

// ---------- Events / calendar ----------
export async function listEvents(params: Record<string, unknown> = {}): Promise<Row[]> {
  const res = await api.get('/events', { params: { limit: 200, ...params } });
  return (res.data.data as { events: Row[] }).events;
}
export async function createEvent(body: Record<string, unknown>): Promise<Row> {
  const res = await api.post('/events', body);
  return (res.data.data as { event: Row }).event;
}
export async function updateEvent(id: string, body: Record<string, unknown>): Promise<Row> {
  const res = await api.patch(`/events/${id}`, body);
  return (res.data.data as { event: Row }).event;
}
export async function deleteEvent(id: string): Promise<void> { await api.delete(`/events/${id}`); }

// ---------- Appointments ----------
export async function listAppointments(params: Record<string, unknown> = {}): Promise<Row[]> {
  const res = await api.get('/appointments', { params: { limit: 200, ...params } });
  return (res.data.data as { appointments: Row[] }).appointments;
}
export async function createAppointment(body: Record<string, unknown>): Promise<Row> {
  const res = await api.post('/appointments', body);
  return (res.data.data as { appointment: Row }).appointment;
}
export async function updateAppointment(id: string, body: Record<string, unknown>): Promise<Row> {
  const res = await api.patch(`/appointments/${id}`, body);
  return (res.data.data as { appointment: Row }).appointment;
}
export async function deleteAppointment(id: string): Promise<void> { await api.delete(`/appointments/${id}`); }

// ---------- Reports & exports ----------
export interface ReportDef { key: string; title: string; description: string; formats: string[] }
export interface ReportResult { key: string; title: string; summary: Record<string, unknown>; columns: Array<{ key: string; label: string }>; rows: Array<Record<string, unknown>>; note?: string }
export async function reportCatalogue(): Promise<ReportDef[]> {
  const res = await api.get('/reports/catalogue');
  return (res.data.data as { reports: ReportDef[] }).reports;
}
export async function runReport(key: string, filters: Record<string, unknown> = {}): Promise<ReportResult> {
  const res = await api.get(`/reports/${key}`, { params: filters });
  return (res.data.data as { report: ReportResult }).report;
}
export async function downloadReportExport(key: string, format: 'csv' | 'xlsx' | 'pdf', filters: Record<string, unknown> = {}): Promise<void> {
  const res = await api.get(`/reports/${key}/export`, { params: { ...filters, format }, responseType: 'blob' });
  const blob = res.data as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${key}-report.${format}`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Activity logs (Admin) ----------
export async function listActivityLogs(params: Record<string, unknown> = {}): Promise<{ logs: Row[]; total: number }> {
  const res = await api.get('/reports/activity-logs', { params });
  return { logs: (res.data.data as { logs: Row[] }).logs, total: (res.data.meta?.total as number) ?? 0 };
}
