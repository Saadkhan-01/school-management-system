import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { ADMIN_NAV } from './WebsiteManagement';
import { Banner, errText, ghostBtnCls, inputCls, labelCls, todayStr } from '../teacher/shared';
import { getAttendanceReport, type Row } from '../../services/academic';
import { listClasses, listSections, listSessions } from '../../services/admin';

type Opt = { value: string; label: string };

export default function AdminAttendanceOverview() {
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [sessions, setSessions] = useState<Opt[]>([]);
  const [classes, setClasses] = useState<Opt[]>([]);
  const [sections, setSections] = useState<Opt[]>([]);
  const [form, setForm] = useState({ sessionId: '', classId: '', sectionId: '', from: todayStr().slice(0, 8) + '01', to: todayStr() });
  const [report, setReport] = useState<Row | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, c, sec] = await Promise.all([listSessions({ limit: 50 }), listClasses({ limit: 100 }), listSections({ limit: 200 })]);
        setSessions(s.items.map((r) => ({ value: (r as Row)._id, label: String((r as Row).name) })));
        setClasses(c.items.map((r) => ({ value: (r as Row)._id, label: String((r as Row).name) })));
        setSections(sec.items.map((r) => ({ value: (r as Row)._id, label: String((r as Row).name) })));
      } catch (e) { setBanner({ kind: 'err', text: errText(e, 'Could not load academic filters') }); }
    })();
  }, []);

  const run = async () => {
    try {
      setReport(await getAttendanceReport({ sessionId: form.sessionId, ...(form.classId ? { classId: form.classId } : {}), ...(form.sectionId ? { sectionId: form.sectionId } : {}), from: form.from, to: form.to }));
    } catch (e) { setBanner({ kind: 'err', text: errText(e, 'Could not build the attendance report') }); setReport(null); }
  };

  const overall = report ? (report.overall as Row) : null;
  const counts = overall ? (overall.counts as Row) : null;
  const students = report ? ((report.students as Row[]) ?? []) : [];

  return (<DashboardLayout role="admin" title="Attendance Overview" nav={ADMIN_NAV}>
    <div className="space-y-4">
      <Banner banner={banner} />
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
        <h2 className="text-lg font-semibold">Attendance Report (§9/§27)</h2>
        <p className="text-sm text-slate-600">Pick any date range — daily, weekly or monthly. Percentages are computed from real attendance records.</p>
        <div className="grid md:grid-cols-3 gap-3">
          <div><label className={labelCls}>Session</label><select className={inputCls} value={form.sessionId} onChange={(e) => setForm({ ...form, sessionId: e.target.value })}><option value="">Select…</option>{sessions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div><label className={labelCls}>Class (optional)</label><select className={inputCls} value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}><option value="">All classes</option>{classes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div><label className={labelCls}>Section (optional)</label><select className={inputCls} value={form.sectionId} onChange={(e) => setForm({ ...form, sectionId: e.target.value })}><option value="">All sections</option>{sections.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div><label className={labelCls}>From</label><input type="date" className={inputCls} value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></div>
          <div><label className={labelCls}>To</label><input type="date" className={inputCls} value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} /></div>
          <div className="flex items-end"><button className={ghostBtnCls} onClick={() => void run()}>Build Report</button></div>
        </div>
        {overall && (<div className="space-y-3 pt-2">
          <p className="text-sm">Overall attendance: <strong>{overall.attendancePercentage === null ? '—' : `${String(overall.attendancePercentage)}%`}</strong> · {String(overall.total ?? 0)} record(s)
            {counts && <> · Present {String(counts.present ?? 0)} · Absent {String(counts.absent ?? 0)} · Late {String(counts.late ?? 0)} · Excused {String(counts.excused ?? 0)}</>}</p>
          {students.length > 0 && (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Student</th><th className="py-2 pr-3">Days recorded</th><th className="py-2">Attendance %</th></tr></thead>
            <tbody>{students.map((s, i) => { const st = s.student as Row; return (<tr key={i} className="border-b last:border-0"><td className="py-2 pr-3">{`${String(st?.firstName ?? '')} ${String(st?.lastName ?? '')}`.trim()} ({String(st?.admissionNumber ?? '')})</td><td className="py-2 pr-3">{String(s.total ?? 0)}</td><td className="py-2">{s.attendancePercentage === null || s.attendancePercentage === undefined ? '—' : `${String(s.attendancePercentage)}%`}</td></tr>); })}</tbody></table></div>)}
        </div>)}
      </div>
    </div>
  </DashboardLayout>);
}
