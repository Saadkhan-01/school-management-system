import { useCallback, useEffect, useState } from 'react';
import DashboardLayout, { type NavItem } from '../layout/DashboardLayout';
import { Banner, btnCls, ghostBtnCls, inputCls, labelCls } from '../../pages/teacher/shared';
import { apiErrorMessage } from '../../services/api';
import { createAppointment, deleteAppointment, listAppointments, listContacts, updateAppointment, type Row } from '../../services/communication';
import { fmtDateTime } from './shared';
import type { Role } from '../../types';

const STATUSES = ['scheduled', 'completed', 'cancelled', 'no-show'];
const STAFF_ROLES = ['admin', 'principal', 'teacher', 'accountant', 'librarian', 'receptionist'];

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** §15 receptionist appointment scheduling (Phase 9). Receptionist/Admin
 *  manage; other staff see only appointments assigned to them (read-only). */
export default function AppointmentsPage({ role, nav, canManage }: { role: Role; nav: NavItem[]; canManage: boolean }) {
  const [items, setItems] = useState<Row[]>([]);
  const [staff, setStaff] = useState<Row[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [form, setForm] = useState({ visitorName: '', visitorPhone: '', visitorEmail: '', purpose: '', scheduledAt: '', durationMinutes: '30', staffToMeet: '', note: '' });

  const load = useCallback(async () => {
    try { setItems(await listAppointments(statusFilter ? { status: statusFilter } : {})); }
    catch (e) { setBanner({ kind: 'err', text: `Could not load appointments: ${apiErrorMessage(e)}` }); }
  }, [statusFilter]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (canManage) { void (async () => { try { setStaff((await listContacts()).filter((c) => STAFF_ROLES.includes(String(c.role)))); } catch { setStaff([]); } })(); } }, [canManage]);

  const create = async () => {
    try {
      await createAppointment({
        visitorName: form.visitorName, visitorPhone: form.visitorPhone || undefined, visitorEmail: form.visitorEmail || undefined,
        purpose: form.purpose, scheduledAt: new Date(form.scheduledAt).toISOString(), durationMinutes: Number(form.durationMinutes),
        staffToMeet: form.staffToMeet, note: form.note || undefined,
      });
      setBanner({ kind: 'ok', text: 'Appointment scheduled — the staff member has been notified.' });
      setForm({ visitorName: '', visitorPhone: '', visitorEmail: '', purpose: '', scheduledAt: '', durationMinutes: '30', staffToMeet: '', note: '' });
      await load();
    } catch (e) { setBanner({ kind: 'err', text: `Could not schedule: ${apiErrorMessage(e)}` }); }
  };
  const setStatus = async (a: Row, status: string) => {
    try { await updateAppointment(a._id, { status }); setBanner({ kind: 'ok', text: `Appointment marked ${status}.` }); await load(); }
    catch (e) { setBanner({ kind: 'err', text: apiErrorMessage(e) }); }
  };
  const remove = async (a: Row) => {
    try { await deleteAppointment(a._id); setBanner({ kind: 'ok', text: 'Appointment deleted.' }); await load(); }
    catch (e) { setBanner({ kind: 'err', text: apiErrorMessage(e) }); }
  };

  return (<DashboardLayout role={role} title="Appointments" nav={nav}>
    <div className="space-y-4">
      <Banner banner={banner} />
      {canManage && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold mb-3">Schedule an appointment</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <div><label className={labelCls}>Visitor / parent name</label><input className={inputCls} value={form.visitorName} onChange={(e) => setForm({ ...form, visitorName: e.target.value })} /></div>
            <div><label className={labelCls}>Phone</label><input className={inputCls} value={form.visitorPhone} onChange={(e) => setForm({ ...form, visitorPhone: e.target.value })} /></div>
            <div><label className={labelCls}>Email</label><input className={inputCls} value={form.visitorEmail} onChange={(e) => setForm({ ...form, visitorEmail: e.target.value })} /></div>
            <div><label className={labelCls}>Purpose</label><input className={inputCls} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
            <div><label className={labelCls}>Staff to meet</label>
              <select className={inputCls} value={form.staffToMeet} onChange={(e) => setForm({ ...form, staffToMeet: e.target.value })}>
                <option value="">Select staff…</option>
                {staff.map((s) => <option key={String(s.userId)} value={String(s.userId)}>{String(s.name)} ({String(s.role)})</option>)}
              </select>
            </div>
            <div><label className={labelCls}>When</label><input type="datetime-local" className={inputCls} value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></div>
            <div><label className={labelCls}>Duration (minutes)</label><input type="number" min={5} max={480} className={inputCls} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} /></div>
            <div className="md:col-span-2"><label className={labelCls}>Note</label><input className={inputCls} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          </div>
          <button className={`${btnCls} mt-3`} onClick={() => void create()} disabled={!form.visitorName || !form.purpose || !form.staffToMeet || !form.scheduledAt}>Schedule appointment</button>
          <p className="text-xs text-slate-500 mt-2">Double-booking the same staff member at an overlapping time is refused (409).</p>
        </div>
      )}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="text-lg font-semibold">Appointments</h2>
          <select className={`${inputCls} ml-auto w-44`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className={ghostBtnCls} onClick={() => void load()}>Refresh</button>
        </div>
        <ul className="divide-y">
          {items.length === 0 && <li className="py-3 text-sm text-slate-500">No appointments{canManage ? '' : ' assigned to you'} yet.</li>}
          {items.map((a) => {
            const staffUser = a.staffToMeet as Row | undefined;
            return (<li key={a._id} className="py-3 flex flex-wrap gap-3 items-start">
              <div className="flex-1 min-w-60">
                <div className="flex items-center gap-2"><span className="font-medium text-sm">{String(a.visitorName)}</span><span className="text-[10px] uppercase bg-slate-100 rounded px-1.5 py-0.5">{String(a.status)}</span></div>
                <p className="text-sm text-slate-600">{String(a.purpose)} — with {staffUser ? String(staffUser.name) : 'staff'} · {fmtDateTime(a.scheduledAt)} · {String(a.durationMinutes)} min</p>
                {(a.visitorPhone || a.visitorEmail) ? <p className="text-xs text-slate-400">{String(a.visitorPhone ?? '')} {String(a.visitorEmail ?? '')}</p> : null}
                {a.note ? <p className="text-xs text-slate-500">{String(a.note)}</p> : null}
              </div>
              {canManage && String(a.status) === 'scheduled' && (
                <div className="flex gap-2">
                  <button className={ghostBtnCls} onClick={() => void setStatus(a, 'completed')}>Complete</button>
                  <button className={ghostBtnCls} onClick={() => void setStatus(a, 'no-show')}>No-show</button>
                  <button className={ghostBtnCls} onClick={() => void setStatus(a, 'cancelled')}>Cancel</button>
                  <button className={ghostBtnCls} onClick={() => void remove(a)}>Delete</button>
                </div>
              )}
            </li>);
          })}
        </ul>
      </div>
    </div>
  </DashboardLayout>);
}

export { toLocalInput };
