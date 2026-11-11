import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout, { type NavItem } from '../layout/DashboardLayout';
import { Banner, btnCls, ghostBtnCls, inputCls, labelCls } from '../../pages/teacher/shared';
import { apiErrorMessage } from '../../services/api';
import { createEvent, deleteEvent, listEvents, updateEvent, type Row } from '../../services/communication';
import { fmtDateTime, ROLE_OPTIONS } from './shared';
import type { Role } from '../../types';

const EVENT_TYPES = ['holiday', 'exam', 'parent-meeting', 'event', 'announcement'];
const TYPE_BADGE: Record<string, string> = { holiday: 'bg-emerald-100 text-emerald-800', exam: 'bg-red-100 text-red-800', 'parent-meeting': 'bg-amber-100 text-amber-800', event: 'bg-sky-100 text-sky-800', announcement: 'bg-violet-100 text-violet-800' };

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** §23 internal events calendar. Admin/Principal manage (canManage);
 *  everyone else sees the events whose audience includes their role. */
export default function CalendarPage({ role, nav, canManage }: { role: Role; nav: NavItem[]; canManage: boolean }) {
  const [events, setEvents] = useState<Row[]>([]);
  const [view, setView] = useState<'month' | 'list'>('month');
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ title: '', description: '', type: 'event', startAt: '', endAt: '', audience: ['all'] as string[] });

  const range = useMemo(() => {
    if (view === 'month') {
      const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    const from = new Date(); from.setMonth(from.getMonth() - 1);
    const to = new Date(); to.setMonth(to.getMonth() + 3);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [view, cursor]);

  const load = useCallback(async () => {
    try { setEvents(await listEvents(range)); }
    catch (e) { setBanner({ kind: 'err', text: `Could not load events: ${apiErrorMessage(e)}` }); }
  }, [range]);
  useEffect(() => { void load(); }, [load]);

  const resetForm = () => { setEditing(null); setForm({ title: '', description: '', type: 'event', startAt: '', endAt: '', audience: ['all'] }); };
  const save = async () => {
    const body = { title: form.title, description: form.description || undefined, type: form.type, startAt: new Date(form.startAt).toISOString(), endAt: new Date(form.endAt).toISOString(), audience: form.audience };
    try {
      if (editing) { await updateEvent(editing._id, body); setBanner({ kind: 'ok', text: 'Event updated.' }); }
      else { await createEvent(body); setBanner({ kind: 'ok', text: form.type === 'announcement' ? 'Announcement published — its audience has been notified.' : 'Event created.' }); }
      resetForm(); await load();
    } catch (e) { setBanner({ kind: 'err', text: `Save failed: ${apiErrorMessage(e)}` }); }
  };
  const remove = async (ev: Row) => {
    try { await deleteEvent(ev._id); setBanner({ kind: 'ok', text: 'Event deleted.' }); await load(); }
    catch (e) { setBanner({ kind: 'err', text: `Delete failed: ${apiErrorMessage(e)}` }); }
  };
  const beginEdit = (ev: Row) => {
    setEditing(ev);
    setForm({ title: String(ev.title), description: String(ev.description ?? ''), type: String(ev.type), startAt: toLocalInput(new Date(String(ev.startAt))), endAt: toLocalInput(new Date(String(ev.endAt))), audience: (ev.audience as string[]) ?? ['all'] });
  };
  const toggleAudience = (v: string) => {
    setForm((f) => {
      if (v === 'all') return { ...f, audience: ['all'] };
      const without = f.audience.filter((a) => a !== 'all' && a !== v);
      return { ...f, audience: f.audience.includes(v) ? without : [...without, v] };
    });
  };

  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
  const byDay = useMemo(() => {
    const m = new Map<number, Row[]>();
    for (const ev of events) { const d = new Date(String(ev.startAt)); if (d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth()) { const arr = m.get(d.getDate()) ?? []; arr.push(ev); m.set(d.getDate(), arr); } }
    return m;
  }, [events, cursor]);

  return (<DashboardLayout role={role} title="Events & Calendar" nav={nav}>
    <div className="space-y-4">
      <Banner banner={banner} />
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold">School Calendar</h2>
          <div className="ml-auto flex gap-2">
            <button className={view === 'month' ? btnCls : ghostBtnCls} onClick={() => setView('month')}>Month</button>
            <button className={view === 'list' ? btnCls : ghostBtnCls} onClick={() => setView('list')}>List</button>
            <button className={ghostBtnCls} onClick={() => void load()}>Refresh</button>
          </div>
        </div>
        {view === 'month' ? (<>
          <div className="flex items-center gap-3 mb-3">
            <button className={ghostBtnCls} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>← Prev</button>
            <span className="font-medium">{cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
            <button className={ghostBtnCls} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>Next →</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="font-semibold text-slate-500 p-1">{d}</div>)}
            {Array.from({ length: firstWeekday }).map((_, i) => <div key={`blank-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1; const dayEvents = byDay.get(day) ?? [];
              return (<div key={day} className="border rounded min-h-20 p-1 align-top">
                <div className="font-medium text-slate-600">{day}</div>
                {dayEvents.map((ev) => <div key={ev._id} className={`mt-1 rounded px-1 py-0.5 truncate ${TYPE_BADGE[String(ev.type)] ?? 'bg-slate-100'}`} title={String(ev.title)}>{String(ev.title)}</div>)}
              </div>);
            })}
          </div>
        </>) : (
          <ul className="divide-y">
            {events.length === 0 && <li className="py-3 text-sm text-slate-500">No events in this range.</li>}
            {events.map((ev) => (
              <li key={ev._id} className="py-3 flex flex-wrap gap-3 items-start">
                <div className="flex-1 min-w-60">
                  <div className="flex items-center gap-2"><span className="font-medium text-sm">{String(ev.title)}</span><span className={`text-[10px] rounded px-1.5 py-0.5 ${TYPE_BADGE[String(ev.type)] ?? 'bg-slate-100'}`}>{String(ev.type)}</span></div>
                  {ev.description ? <p className="text-sm text-slate-600 mt-0.5">{String(ev.description)}</p> : null}
                  <p className="text-xs text-slate-400 mt-0.5">{fmtDateTime(ev.startAt)} → {fmtDateTime(ev.endAt)} · Audience: {((ev.audience as string[]) ?? []).join(', ')}</p>
                </div>
                {canManage && <div className="flex gap-2"><button className={ghostBtnCls} onClick={() => beginEdit(ev)}>Edit</button>{role === 'admin' && <button className={ghostBtnCls} onClick={() => void remove(ev)}>Delete</button>}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {canManage && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold mb-3">{editing ? 'Edit event' : 'New event / announcement'}</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div><label className={labelCls}>Title</label><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className={labelCls}>Type</label><select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className={labelCls}>Starts</label><input type="datetime-local" className={inputCls} value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></div>
            <div><label className={labelCls}>Ends</label><input type="datetime-local" className={inputCls} value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></div>
            <div className="md:col-span-2"><label className={labelCls}>Description</label><textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="md:col-span-2">
              <label className={labelCls}>Audience</label>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={form.audience.includes('all')} onChange={() => toggleAudience('all')} /> Everyone</label>
                {ROLE_OPTIONS.map((r) => <label key={r.value} className="flex items-center gap-1.5"><input type="checkbox" checked={form.audience.includes(r.value)} onChange={() => toggleAudience(r.value)} /> {r.label}</label>)}
              </div>
              {form.type === 'announcement' && <p className="text-xs text-slate-500 mt-1">Publishing an announcement sends an in-app notification to everyone in the audience.</p>}
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button className={btnCls} onClick={() => void save()} disabled={!form.title || !form.startAt || !form.endAt || form.audience.length === 0}>{editing ? 'Save changes' : 'Create'}</button>
            {editing && <button className={ghostBtnCls} onClick={resetForm}>Cancel edit</button>}
          </div>
        </div>
      )}
    </div>
  </DashboardLayout>);
}
