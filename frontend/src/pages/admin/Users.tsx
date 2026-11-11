import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ResourceManager from '../../components/admin/ResourceManager';
import { ADMIN_NAV } from './WebsiteManagement';
import { apiErrorMessage } from '../../services/api';
import {
  createUser, deleteUser, fmtDate, getLoginHistory, listUsers, resetUserPassword, setUserActive, updateUser,
  type LoginEvent,
} from '../../services/admin';

const ROLE_OPTIONS = ['admin', 'principal', 'teacher', 'student', 'parent', 'accountant', 'librarian', 'receptionist'].map((r) => ({ value: r, label: r[0].toUpperCase() + r.slice(1) }));

function LoginHistoryPanel({ userId }: { userId: string }) {
  const [events, setEvents] = useState<LoginEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getLoginHistory(userId).then((out) => { if (alive) setEvents(out.history); }).catch((e) => { if (alive) setError(apiErrorMessage(e)); });
    return () => { alive = false; };
  }, [userId]);
  if (error) return <p className="text-sm text-red-600">Could not load login history: {error}</p>;
  if (!events) return <p className="text-sm text-slate-500">Loading login history…</p>;
  if (events.length === 0) return <p className="text-sm text-slate-500">No login events recorded for this account yet.</p>;
  return (<div className="overflow-x-auto"><table className="w-full text-sm">
    <thead><tr className="text-left border-b"><th className="py-2 pr-3">When</th><th className="pr-3">Result</th><th className="pr-3">IP</th><th>Device / agent</th></tr></thead>
    <tbody>{events.map((e, i) => (<tr key={i} className="border-b last:border-0">
      <td className="py-2 pr-3 whitespace-nowrap">{new Date(e.at).toLocaleString()}</td>
      <td className="pr-3">{e.success ? <span className="text-green-700 font-medium">Success</span> : <span className="text-red-600 font-medium">Failed</span>}</td>
      <td className="pr-3">{e.ip ?? '—'}</td><td className="max-w-xs truncate">{e.userAgent ?? '—'}</td>
    </tr>))}</tbody></table></div>);
}

export default function UsersPage() {
  return (<DashboardLayout role="admin" title="User Management" nav={ADMIN_NAV}>
    <ResourceManager
      title="Users"
      description="Admin-only account management for all 8 roles (§7). There is no public self-registration. Deactivation is preferred over deletion — accounts with login history or an ERP profile cannot be hard-deleted (the API returns 409 and explains why)."
      load={(p) => listUsers(p)}
      filters={[{ name: 'role', label: 'Role', options: ROLE_OPTIONS }, { name: 'isActive', label: 'Active', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] }]}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role', render: (r) => <span className="capitalize">{String(r.role)}</span> },
        { key: 'isActive', label: 'Status', render: (r) => (r.isActive ? <span className="text-green-700 font-medium">Active</span> : <span className="text-slate-500 font-medium">Inactive</span>) },
        { key: 'lastLoginAt', label: 'Last login', render: (r) => fmtDate(r.lastLoginAt) },
        { key: 'createdAt', label: 'Created', render: (r) => fmtDate(r.createdAt) },
      ]}
      fields={[
        { name: 'name', label: 'Full name', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'password', label: 'Password (min 8 characters)', type: 'password', required: true, hideOnEdit: true },
        { name: 'role', label: 'Role', type: 'select', options: ROLE_OPTIONS, required: true },
        { name: 'isVerified', label: 'Verified account', type: 'checkbox' },
      ]}
      toForm={(r) => ({ name: String(r.name ?? ''), email: String(r.email ?? ''), role: String(r.role ?? ''), isVerified: Boolean(r.isVerified) })}
      onCreate={async (v) => { await createUser(v as never); }}
      onUpdate={async (id, v) => { const body = { ...v }; delete (body as Record<string, unknown>).password; await updateUser(id, body as never); }}
      onDelete={async (id) => { await deleteUser(id); }}
      detailLabel="Login history"
      detailPanel={(row) => <LoginHistoryPanel userId={String(row._id)} />}
      rowActions={(row, helpers) => (<>
        <button className="text-brand font-medium mr-3" onClick={async () => {
          try { await setUserActive(String(row._id), !row.isActive); helpers.notify('ok', `Account ${row.isActive ? 'deactivated' : 'activated'}.`); helpers.reload(); }
          catch (e) { helpers.notify('err', `Status change failed: ${apiErrorMessage(e)}`); }
        }}>{row.isActive ? 'Deactivate' : 'Activate'}</button>
        <button className="text-brand font-medium" onClick={async () => {
          const pw = window.prompt(`Set a new password for ${String(row.email)} (min 8 characters). All existing sessions will be revoked.`);
          if (!pw) return;
          try { await resetUserPassword(String(row._id), pw); helpers.notify('ok', 'Password reset. The user must sign in with the new password.'); }
          catch (e) { helpers.notify('err', `Password reset failed: ${apiErrorMessage(e)}`); }
        }}>Reset password</button>
      </>)}
    />
  </DashboardLayout>);
}
