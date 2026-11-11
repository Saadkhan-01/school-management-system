import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { ADMIN_NAV } from './WebsiteManagement';
import { Banner, btnCls, errText, ghostBtnCls, inputCls, labelCls } from '../teacher/shared';
import { addExamSchedule, approveExam, createExam, listExamSchedules, listExams, publishExam, refName, type Row } from '../../services/academic';
import { listClasses, listSections, listSessions, listSubjects } from '../../services/admin';
import { apiErrorMessage } from '../../services/api';

type Opt = { value: string; label: string };

export function ExamManager({ role }: { role: 'admin' | 'principal' }) {
  const [exams, setExams] = useState<Row[]>([]);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [sessions, setSessions] = useState<Opt[]>([]);
  const [classes, setClasses] = useState<Opt[]>([]);
  const [sections, setSections] = useState<Opt[]>([]);
  const [subjects, setSubjects] = useState<Opt[]>([]);
  const [form, setForm] = useState({ name: '', type: 'Midterm', sessionId: '', classIds: [] as string[], allowPositions: false });
  const [selected, setSelected] = useState<Row | null>(null);
  const [schedules, setSchedules] = useState<Row[]>([]);
  const [sched, setSched] = useState({ classId: '', sectionId: '', subjectId: '', date: '', maxMarks: '100' });

  const load = useCallback(async () => {
    try { setExams(await listExams({ limit: 50 })); }
    catch (e) { setBanner({ kind: 'err', text: errText(e, 'Could not load exams') }); setExams([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (role !== 'admin') return;
    (async () => {
      try {
        const [s, c, sec, sub] = await Promise.all([listSessions({ limit: 50 }), listClasses({ limit: 100 }), listSections({ limit: 100 }), listSubjects({ limit: 100 })]);
        setSessions(s.items.map((r) => ({ value: (r as Row)._id, label: String((r as Row).name) })));
        setClasses(c.items.map((r) => ({ value: (r as Row)._id, label: String((r as Row).name) })));
        setSections(sec.items.map((r) => ({ value: (r as Row)._id, label: String((r as Row).name) })));
        setSubjects(sub.items.map((r) => ({ value: (r as Row)._id, label: `${String((r as Row).name)} (${String((r as Row).code)})` })));
      } catch { /* covered by load banner */ }
    })();
  }, [role]);

  const create = async () => {
    try {
      await createExam({ name: form.name, type: form.type, sessionId: form.sessionId, classIds: form.classIds, allowPositions: form.allowPositions } as unknown as Row);
      setBanner({ kind: 'ok', text: 'Exam created. Now add subject schedules below.' });
      setForm({ name: '', type: 'Midterm', sessionId: '', classIds: [], allowPositions: false });
      await load();
    } catch (e) { setBanner({ kind: 'err', text: `Create failed: ${apiErrorMessage(e)}` }); }
  };

  const open = async (exam: Row) => {
    setSelected(exam);
    try { setSchedules(await listExamSchedules(exam._id)); }
    catch (e) { setBanner({ kind: 'err', text: errText(e, 'Could not load schedules') }); setSchedules([]); }
  };

  const addSchedule = async () => {
    if (!selected) return;
    try {
      await addExamSchedule(selected._id, { classId: sched.classId, sectionId: sched.sectionId || undefined, subjectId: sched.subjectId, date: sched.date, maxMarks: Number(sched.maxMarks) } as unknown as Row);
      setBanner({ kind: 'ok', text: 'Schedule added. Teachers assigned to this subject/class can now enter marks.' });
      await open(selected);
    } catch (e) { setBanner({ kind: 'err', text: `Schedule failed: ${apiErrorMessage(e)}` }); }
  };

  const act = async (exam: Row, kind: 'approve' | 'publish') => {
    try {
      const out = kind === 'approve' ? await approveExam(exam._id) : await publishExam(exam._id);
      setBanner({ kind: 'ok', text: kind === 'approve' ? 'Results approved.' : 'Results published — students and parents can now view report cards.' });
      setSelected(out); await load();
    } catch (e) { setBanner({ kind: 'err', text: `${kind === 'approve' ? 'Approve' : 'Publish'} failed: ${apiErrorMessage(e)}` }); }
  };

  return (<div className="space-y-4">
    <Banner banner={banner} />
    {role === 'admin' && (<div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
      <h2 className="text-lg font-semibold">Create Exam (§19)</h2>
      <div className="grid md:grid-cols-2 gap-3">
        <div><label className={labelCls}>Name</label><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Midterm Examination 2026" /></div>
        <div><label className={labelCls}>Type</label><input className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} /></div>
        <div><label className={labelCls}>Session</label><select className={inputCls} value={form.sessionId} onChange={(e) => setForm({ ...form, sessionId: e.target.value })}><option value="">Select…</option>{sessions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <div><label className={labelCls}>Classes (Ctrl/Cmd-click for several)</label>
          <select multiple className={inputCls} value={form.classIds} onChange={(e) => setForm({ ...form, classIds: [...e.target.selectedOptions].map((o) => o.value) })}>{classes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allowPositions} onChange={(e) => setForm({ ...form, allowPositions: e.target.checked })} /> Allow class positions (school-policy flag, off by default)</label>
      </div>
      <button className={btnCls} onClick={() => void create()}>Create Exam</button>
    </div>)}

    <div className="bg-white rounded-xl shadow-sm p-5">
      <h3 className="font-semibold mb-3">Exams & Result Workflow</h3>
      {exams.length === 0 ? <p className="text-sm text-slate-500">No exams yet.</p>
        : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Exam</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Results</th><th className="py-2">Actions</th></tr></thead>
          <tbody>{exams.map((e) => (<tr key={e._id} className="border-b last:border-0"><td className="py-2 pr-3"><strong>{String(e.name)}</strong></td><td className="py-2 pr-3">{String(e.type)}</td>
            <td className="py-2 pr-3 capitalize">{String(e.resultStatus)}</td>
            <td className="py-2"><div className="flex gap-2 flex-wrap">
              <button className={ghostBtnCls} onClick={() => void open(e)}>Schedules</button>
              <button className={ghostBtnCls} disabled={String(e.resultStatus) === 'published'} onClick={() => void act(e, 'approve')}>Approve Results</button>
              <button className={btnCls} disabled={String(e.resultStatus) === 'published'} onClick={() => void act(e, 'publish')}>Publish Results</button>
            </div></td></tr>))}</tbody></table></div>)}
      <p className="text-xs text-slate-500 mt-3">Publish requires a prior approval (the server returns 409 otherwise). Unpublished results are invisible to students and parents.</p>
    </div>

    {selected && (<div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
      <h3 className="font-semibold">Schedules — {String(selected.name)}</h3>
      {schedules.length === 0 ? <p className="text-sm text-slate-500">No schedules yet.</p>
        : (<ul className="divide-y text-sm">{schedules.map((s) => (<li key={s._id} className="py-2">{refName(s.schoolClass)}{s.section ? ` · ${refName(s.section)}` : ''} · {refName(s.subject)} · {new Date(String(s.date)).toLocaleDateString()} · max {String(s.maxMarks)}</li>))}</ul>)}
      {role === 'admin' && (<>
        <div className="grid md:grid-cols-3 gap-3">
          <div><label className={labelCls}>Class</label><select className={inputCls} value={sched.classId} onChange={(e) => setSched({ ...sched, classId: e.target.value })}><option value="">Select…</option>{classes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div><label className={labelCls}>Section (optional)</label><select className={inputCls} value={sched.sectionId} onChange={(e) => setSched({ ...sched, sectionId: e.target.value })}><option value="">All sections</option>{sections.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div><label className={labelCls}>Subject</label><select className={inputCls} value={sched.subjectId} onChange={(e) => setSched({ ...sched, subjectId: e.target.value })}><option value="">Select…</option>{subjects.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div><label className={labelCls}>Date</label><input type="date" className={inputCls} value={sched.date} onChange={(e) => setSched({ ...sched, date: e.target.value })} /></div>
          <div><label className={labelCls}>Max marks</label><input type="number" min={1} className={inputCls} value={sched.maxMarks} onChange={(e) => setSched({ ...sched, maxMarks: e.target.value })} /></div>
        </div>
        <button className={btnCls} onClick={() => void addSchedule()}>Add Schedule</button>
      </>)}
    </div>)}
  </div>);
}

export default function AdminExams() {
  return (<DashboardLayout role="admin" title="Examinations" nav={ADMIN_NAV}><ExamManager role="admin" /></DashboardLayout>);
}
