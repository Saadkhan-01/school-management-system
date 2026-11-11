import type { Role } from '../../types';
import type { Row } from '../../services/communication';

/** Deep-link a notification to the page that owns its related entity, when
 *  such a page exists for the viewer's role (§24). Falls back to the
 *  notifications page itself. */
export function notificationLink(role: Role, n: Row): string {
  const kind = (n.relatedEntity as Row | undefined)?.kind as string | undefined;
  const base = `/${role}`;
  switch (kind) {
    case 'assignment': return role === 'student' ? `${base}/assignments` : role === 'parent' ? `${base}/assignments` : role === 'teacher' ? `${base}/assignments` : `${base}/notifications`;
    case 'exam': return role === 'student' || role === 'parent' ? `${base}/results` : role === 'teacher' ? `${base}/marks` : `${base}/notifications`;
    case 'payment': return role === 'accountant' ? `${base}/payments` : role === 'parent' || role === 'student' ? `${base}/fees` : `${base}/notifications`;
    case 'invoice': return role === 'accountant' ? `${base}/invoices` : role === 'parent' || role === 'student' ? `${base}/fees` : `${base}/notifications`;
    case 'leave': return role === 'teacher' || role === 'parent' ? `${base}/leave` : `${base}/notifications`;
    case 'admission': return role === 'admin' ? `${base}/admissions` : role === 'receptionist' ? `${base}/enquiries` : `${base}/notifications`;
    case 'certificate': return role === 'student' ? `${base}/certificates` : `${base}/notifications`;
    case 'message': return `${base}/messages`;
    case 'appointment': return role === 'receptionist' || role === 'admin' ? `${base}/appointments` : `${base}/notifications`;
    case 'complaint': return role === 'admin' || role === 'parent' || role === 'student' || role === 'receptionist' ? `${base}/complaints` : `${base}/notifications`;
    case 'student': return role === 'admin' ? `${base}/students` : `${base}/notifications`;
    default: return `${base}/notifications`;
  }
}

export function fmtDateTime(v: unknown): string {
  return v ? new Date(String(v)).toLocaleString() : '—';
}

export const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'admin', label: 'Admin' }, { value: 'principal', label: 'Principal' },
  { value: 'teacher', label: 'Teachers' }, { value: 'student', label: 'Students' },
  { value: 'parent', label: 'Parents' }, { value: 'accountant', label: 'Accountant' },
  { value: 'librarian', label: 'Librarian' }, { value: 'receptionist', label: 'Receptionist' },
];
