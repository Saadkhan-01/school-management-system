import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { ADMIN_NAV } from './WebsiteManagement';
import { Banner, btnCls, errText, ghostBtnCls, inputCls, labelCls } from '../teacher/shared';
import { createTimetableEntry, deleteTimetableEntry, listTimetable, refName, type Row } from '../../services/academic';
import { listClasses, listClassrooms, listSections, listSessions, listSubjects, listTeachers, refName as adminRefName } from '../../services/admin';
import { apiErrorMessage } from '../../services/api';

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
type Opt = { value: string; label: string };
const toOpts = (rows: Row[], label: (r: Row) => string): Opt[] => rows.map((r) => ({ value: r._id, label: label(r) }));

export default function AdminTimetable() {
  const [entries, setEntries] = useState<Row[]>([]);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [opts, setOpts] = useState<{ sessions: Opt[]; classes: Opt[]; sections: Opt[]; subjects: Opt[]; teachers: Opt[]; classrooms: Opt[] }>({ sessions: [], classes: [], sections: [], subjects: [], teachers: [], classrooms: [] });
  const [form, setForm] = useState({ sessionId: '', classId: '', sectionId: '', subjectId: '', teacherId: '', classroomId: '', weekday: 'monday', periodNumber: '1', startTime: '08:00', endTime: '08:45' });
  const [filterSession, setFilterSession] = useState('');

  const load = useCallback(async () => {
    try { setEntries(await listTimetable({ limit: 100, ...(filterSession ? { sessionId: filterSession } : {}) })); }
    catch (e) { setBanner({ kind: 'err', text: errText(e, 'Could not load the timetable') }); setEntries([]); }
  }, [filterSession]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const [sessions, classes, sections, subjects, teachers, classrooms] = await Promise.all([
          listSessions({ limit: 50 }), listClasses({ limit: 100 }), listSections({ limit: 100 }), listSubjects({ limit: 100 }), listTeachers({ limit: 100 }), listClassrooms({ limit: 100 }),
        ]);
        setOpts({
          sessions: toOpts(sessions.items as Row[], (r) => String(r.name)),
          classes: toOpts(classes.items as Row[], (r) => String(r.name)),
          sections: toOpts(sections.items as Row[], (r) => `${adminRefName(r.schoolClass)} · ${String(r.name)}`),
          subjects: toOpts(subjects.items as Row[], (r) => `${String(r.name)} (${String(r.code)})`),
          teachers: toOpts(teachers.items as Row[], (r) => `${String(r.employeeId)} — ${adminRefName(r)}`),
          classrooms: toOpts(classrooms.items as Row[], (r) => String(r.name)),
        });
      } catch { /* selects stay empty; the banner from load() covers DB issues */ }
    })();
  }, []);

  const create = async () => {
    try {
      await createTimetableEntry({
        sessionId: form.sessionId, classId: form.classId, sectionId: form.sectionId, subjectId: form.subjectId,
        teacherId: form.teacherId, classroomId: form.classroomId || undefined, weekday: form.weekday,
        periodNumber: Number(form.periodNumber), startTime: form.startTime, endTime: form.endTime,
      } as unknown as Row);
      setBanner({ kind: 'ok', text: 'Timetable entry created — no conflicts detected.' });
      await load();
    } catch (e) { setBanner({ kind: 'err', text: `Create failed: ${apiErrorMessage(e)}` }); }
  };

  const sel = (key: keyof typeof form, label: string, options: Opt[], optional = false) => (
    <div><label className={labelCls}>{label}</label>
      <select className={inputCls} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
        <option value="">{optional ? '— none —' : 'Select…'}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select></div>
  );

  return (<DashboardLayout role="admin" title="Timetable Manager" nav={ADMIN_NAV}>
    <div className="space-y-4">
      <Banner banner={banner} />
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
        <h2 className="text-lg font-semibold">Add Timetable Entry (§18)</h2>
        <p className="text-sm text-slate-600">The server rejects teacher double-booking, classroom double-booking and duplicate class periods with 409 conflict errors — they are shown here exactly as returned.</p>
        <div className="grid md:grid-cols-3 gap-3">
          {sel('sessionId', 'Session', opts.sessions)}
          {sel('classId', 'Class', opts.classes)}
          {sel('sectionId', 'Section', opts.sections)}
          {sel('subjectId', 'Subject', opts.subjects)}
          {sel('teacherId', 'Teacher', opts.teachers)}
          {sel('classroomId', 'Classroom (optional)', opts.classrooms, true)}
          <div><label className={labelCls}>Weekday</label><select className={inputCls} value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })}>{WEEKDAYS.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
          <div><label className={labelCls}>Period #</label><input type="number" min={1} max={20} className={inputCls} value={form.periodNumber} onChange={(e) => setForm({ ...form, periodNumber: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>Start</label><input type="time" className={inputCls} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
            <div><label className={labelCls}>End</label><input type="time" className={inputCls} value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
          </div>
        </div>
        <button className={btnCls} onClick={() => void create()}>Add Entry</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="font-semibold">Entries</h3>
          <select className="border rounded px-2 py-1 text-sm ml-auto" value={filterSession} onChange={(e) => setFilterSession(e.target.value)}>
            <option value="">All sessions</option>{opts.sessions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {entries.length === 0 ? <p className="text-sm text-slate-500">No timetable entries yet.</p>
          : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Day</th><th className="py-2 pr-3">Period</th><th className="py-2 pr-3">Time</th><th className="py-2 pr-3">Class</th><th className="py-2 pr-3">Subject</th><th className="py-2 pr-3">Teacher</th><th className="py-2 pr-3">Room</th><th className="py-2">Delete</th></tr></thead>
            <tbody>{entries.map((t) => (<tr key={t._id} className="border-b last:border-0"><td className="py-2 pr-3 capitalize">{String(t.weekday)}</td><td className="py-2 pr-3">{String(t.periodNumber)}</td>
              <td className="py-2 pr-3">{String(t.startTime)}–{String(t.endTime)}</td><td className="py-2 pr-3">{refName(t.schoolClass)} · {refName(t.section)}</td>
              <td className="py-2 pr-3">{refName(t.subject)}</td><td className="py-2 pr-3">{refName(t.teacher)}</td><td className="py-2 pr-3">{refName(t.classroom)}</td>
              <td className="py-2"><button className={ghostBtnCls} onClick={() => { void (async () => { try { await deleteTimetableEntry(t._id); await load(); } catch (e) { setBanner({ kind: 'err', text: `Delete failed: ${apiErrorMessage(e)}` }); } })(); }}>Delete</button></td></tr>))}</tbody></table></div>)}
      </div>
    </div>
  </DashboardLayout>);
}
