import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { TEACHER_NAV } from './nav';
import { Banner, btnCls, errText, inputCls, labelCls, useMyAssignments } from './shared';
import { enterMarksBulk, getRoster, listExamSchedules, listExams, listMarks, refName, studentLabel, type Row } from '../../services/academic';
import { apiErrorMessage } from '../../services/api';

export default function TeacherMarks() {
  const { assignments: scope } = useMyAssignments();
  const [exams, setExams] = useState<Row[]>([]);
  const [examId, setExamId] = useState('');
  const [schedules, setSchedules] = useState<Row[]>([]);
  const [scheduleId, setScheduleId] = useState('');
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [roster, setRoster] = useState<Row[]>([]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Record<string, number>>({});

  const schedule = schedules.find((s) => s._id === scheduleId) ?? schedules[0];
  const exam = exams.find((e) => e._id === examId) ?? exams[0];
  const maxMarks = schedule ? Number(schedule.maxMarks ?? 0) : 0;

  useEffect(() => { (async () => { try { setExams(await listExams({ limit: 50 })); } catch (e) { setBanner({ kind: 'err', text: errText(e, 'Could not load exams') }); } })(); }, []);

  const loadSchedules = useCallback(async () => {
    if (!exam) { setSchedules([]); return; }
    try { setSchedules(await listExamSchedules(exam._id)); } catch (e) { setBanner({ kind: 'err', text: errText(e, 'Could not load exam schedules') }); setSchedules([]); }
  }, [exam]);
  useEffect(() => { void loadSchedules(); }, [loadSchedules]);

  const loadRosterAndMarks = useCallback(async () => {
    if (!schedule || !exam) return;
    const classId = String((schedule.schoolClass as Row)?._id ?? '');
    const sectionId = schedule.section ? String((schedule.section as Row)._id) : '';
    const combo = scope.find((a) => String((a.schoolClass as Row)._id) === classId && (!sectionId || String((a.section as Row)._id) === sectionId));
    try {
      if (combo) {
        const out = await getRoster({ classId, sectionId: String((combo.section as Row)._id), sessionId: String(exam.session ? ((exam.session as Row)._id as string) : '') });
        setRoster(out.enrollments);
      } else setRoster([]);
      const rows = await listMarks({ examScheduleId: schedule._id, limit: 200 });
      const map: Record<string, number> = {}; const init: Record<string, string> = {};
      for (const m of rows) { const sid = String((m.student as Row)?._id ?? ''); map[sid] = Number(m.obtainedMarks); init[sid] = String(m.obtainedMarks); }
      setExisting(map); setMarks(init);
    } catch (e) { setBanner({ kind: 'err', text: errText(e, 'Could not load the marks sheet') }); }
  }, [schedule, exam, scope]);
  useEffect(() => { void loadRosterAndMarks(); }, [loadRosterAndMarks]);

  const save = async () => {
    if (!schedule) return;
    const entries: Array<{ studentId: string; obtainedMarks: number }> = [];
    for (const e of roster) {
      const sid = String((e.student as Row)._id);
      const raw = marks[sid];
      if (raw === undefined || raw === '') continue;
      const value = Number(raw);
      if (Number.isNaN(value) || value < 0) { setBanner({ kind: 'err', text: `Invalid marks value for ${studentLabel(e.student)}.` }); return; }
      if (value > maxMarks) { setBanner({ kind: 'err', text: `Marks for ${studentLabel(e.student)} exceed the maximum of ${maxMarks}. The server would reject this with 422 — fix it before saving.` }); return; }
      entries.push({ studentId: sid, obtainedMarks: value });
    }
    if (entries.length === 0) { setBanner({ kind: 'err', text: 'Enter at least one marks value.' }); return; }
    try {
      const out = await enterMarksBulk({ examScheduleId: schedule._id, entries });
      setBanner({ kind: 'ok', text: `Saved marks for ${out.count} student(s). Results stay hidden from students/parents until an Admin/Principal approves and publishes them.` });
      await loadRosterAndMarks();
    } catch (e) { setBanner({ kind: 'err', text: `Save failed: ${apiErrorMessage(e)}` }); }
  };

  return (<DashboardLayout role="teacher" title="Marks Entry" nav={TEACHER_NAV}>
    <div className="space-y-4">
      <Banner banner={banner} />
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <p className="text-sm text-slate-600">You can only enter marks for subjects/classes you are assigned to — the server returns 403 otherwise. Marks above the schedule maximum are rejected (422).</p>
        <div className="grid md:grid-cols-2 gap-3">
          <div><label className={labelCls}>Exam</label>
            <select className={inputCls} value={exam?._id ?? ''} onChange={(e) => setExamId(e.target.value)}>
              {exams.length === 0 && <option value="">No exams</option>}
              {exams.map((e) => <option key={e._id} value={e._id}>{String(e.name)} — results: {String(e.resultStatus)}</option>)}
            </select></div>
          <div><label className={labelCls}>Schedule (class · subject · max marks)</label>
            <select className={inputCls} value={schedule?._id ?? ''} onChange={(e) => setScheduleId(e.target.value)}>
              {schedules.length === 0 && <option value="">No schedules for this exam</option>}
              {schedules.map((s) => <option key={s._id} value={s._id}>{refName(s.schoolClass)} · {refName(s.subject)} · max {String(s.maxMarks)}</option>)}
            </select></div>
        </div>
        {schedule && (roster.length === 0
          ? <p className="text-sm text-slate-500">No roster could be loaded for this schedule (you may not be assigned to this class, or there are no enrollments).</p>
          : (<>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Student</th><th className="py-2 pr-3">Marks (max {maxMarks})</th><th className="py-2">Previously saved</th></tr></thead>
              <tbody>{roster.map((e) => { const sid = String((e.student as Row)._id); const over = marks[sid] !== undefined && marks[sid] !== '' && Number(marks[sid]) > maxMarks;
                return (<tr key={e._id} className="border-b last:border-0"><td className="py-2 pr-3">{studentLabel(e.student)}</td>
                  <td className="py-2 pr-3"><input type="number" min={0} max={maxMarks} className={`border rounded px-2 py-1 w-28 ${over ? 'border-red-500 bg-red-50' : ''}`} value={marks[sid] ?? ''} onChange={(ev) => setMarks({ ...marks, [sid]: ev.target.value })} />{over && <span className="ml-2 text-xs text-red-600">Exceeds max {maxMarks}</span>}</td>
                  <td className="py-2 text-slate-500">{existing[sid] !== undefined ? String(existing[sid]) : '—'}</td></tr>); })}</tbody></table></div>
            <button className={btnCls} onClick={() => void save()}>Save Marks</button>
          </>))}
      </div>
    </div>
  </DashboardLayout>);
}
