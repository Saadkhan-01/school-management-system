import { useCallback, useEffect, useState } from 'react';
import DashboardLayout, { type NavItem } from '../layout/DashboardLayout';
import { Banner, ghostBtnCls, inputCls, labelCls } from '../../pages/teacher/shared';
import { apiErrorMessage } from '../../services/api';
import { listActivityLogs, type Row } from '../../services/communication';
import { fmtDateTime } from './shared';
import type { Role } from '../../types';

/** §33 activity/audit log viewer — Admin only (backend enforces). */
export default function ActivityLogsPage({ role, nav }: { role: Role; nav: NavItem[] }) {
  const [logs, setLogs] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ action: '', entityKind: '', actorRole: '' });
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const out = await listActivityLogs({ limit: 100, ...(filters.action ? { action: filters.action } : {}), ...(filters.entityKind ? { entityKind: filters.entityKind } : {}), ...(filters.actorRole ? { actorRole: filters.actorRole } : {}) });
      setLogs(out.logs); setTotal(out.total);
    } catch (e) { setBanner({ kind: 'err', text: `Could not load activity logs: ${apiErrorMessage(e)}` }); }
  }, [filters]);
  useEffect(() => { void load(); }, [load]);

  return (<DashboardLayout role={role} title="Activity Logs" nav={nav}>
    <div className="space-y-4">
      <Banner banner={banner} />
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold mb-1">Activity Logs</h2>
        <p className="text-sm text-slate-500 mb-4">Audit trail of key changes (users, fees, payments, marks, attendance corrections, enrollments, certificates, admissions). Passwords, tokens and payment secrets are never logged. Showing {logs.length} of {total}.</p>
        <div className="grid md:grid-cols-4 gap-3 items-end mb-4">
          <div><label className={labelCls}>Action contains</label><input className={inputCls} placeholder="e.g. payment.verify" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} /></div>
          <div><label className={labelCls}>Entity kind</label><input className={inputCls} placeholder="e.g. invoice" value={filters.entityKind} onChange={(e) => setFilters({ ...filters, entityKind: e.target.value })} /></div>
          <div><label className={labelCls}>Actor role</label>
            <select className={inputCls} value={filters.actorRole} onChange={(e) => setFilters({ ...filters, actorRole: e.target.value })}>
              <option value="">All roles</option>
              {['admin', 'principal', 'teacher', 'student', 'parent', 'accountant', 'librarian', 'receptionist'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button className={ghostBtnCls} onClick={() => void load()}>Refresh</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b"><th className="py-2 pr-3 font-medium">When</th><th className="py-2 pr-3 font-medium">Actor</th><th className="py-2 pr-3 font-medium">Action</th><th className="py-2 pr-3 font-medium">Entity</th><th className="py-2 pr-3 font-medium">Summary</th></tr></thead>
            <tbody>
              {logs.length === 0 && <tr><td className="py-3 text-slate-500" colSpan={5}>No activity recorded for these filters yet.</td></tr>}
              {logs.map((l) => {
                const actor = l.actor as Row | undefined;
                return (<tr key={l._id} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                  <td className="py-2 pr-3">{actor ? `${String(actor.name)} (${String(l.actorRole)})` : String(l.actorRole)}</td>
                  <td className="py-2 pr-3"><code className="text-xs bg-slate-100 rounded px-1.5 py-0.5">{String(l.action)}</code></td>
                  <td className="py-2 pr-3">{String(l.entityKind)}</td>
                  <td className="py-2 pr-3">{String(l.summary)}</td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </DashboardLayout>);
}
