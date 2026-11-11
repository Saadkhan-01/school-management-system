
import { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { ADMIN_NAV } from './WebsiteManagement';
import { Banner, Section, btnCls, fmtDate, inputCls, labelCls, refName, useLoader } from '../opsShared';
import { apiErrorMessage } from '../../services/api';
import { listStaffAttendance, markStaffAttendance } from '../../services/operations';
import type { Row } from '../../services/academic';
import { listUsers } from '../../services/admin';
export default function AdminStaffAttendance() {
  const records = useLoader(() => listStaffAttendance());
  const employees = useLoader(async () => { const out = await listUsers({ limit: 100 }); const rows = (out as unknown as { items?: Row[] }).items ?? (out as unknown as Row[]); return rows.filter((u: Row) => ['teacher','accountant','librarian','receptionist','principal','admin'].includes(String(u.role))); });
  const [form, setForm] = useState({ userId: '', date: '', status: 'present' });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const submit = async () => { try { await markStaffAttendance({ userId: form.userId, date: form.date, status: form.status }); setMsg({ kind: 'ok', text: 'Staff attendance marked.' }); records.reload(); } catch (e) { setMsg({ kind: 'err', text: apiErrorMessage(e) }); } };
  return (<DashboardLayout role="admin" title="Staff Attendance" nav={ADMIN_NAV}><div className="space-y-4">
    <Banner banner={msg ?? records.banner} />
    <Section title="Mark staff attendance (one record per staff member per day)">
      <div className="grid md:grid-cols-3 gap-3">
        <div><label className={labelCls}>Employee</label><select className={inputCls} value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}><option value="">Select…</option>{(employees.data ?? []).map((e) => <option key={e._id} value={e._id}>{String(e.name ?? '')} ({String(e.role ?? '')})</option>)}</select></div>
        <div><label className={labelCls}>Date</label><input className={inputCls} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
        <div><label className={labelCls}>Status</label><select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{['present', 'absent', 'late', 'on-leave'].map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
      </div>
      <button className={`${btnCls} mt-3`} onClick={() => void submit()}>Mark</button>
    </Section>
    <Section title="Records">
      <ul className="divide-y text-sm">{(records.data ?? []).map((r) => <li key={r._id} className="py-2 flex justify-between"><span>{refName(r.user)} · {fmtDate(r.date)}</span><span>{String(r.status)}</span></li>)}</ul>
    </Section>
  </div></DashboardLayout>);
}
