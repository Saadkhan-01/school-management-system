import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { TEACHER_NAV } from './nav';
import { Banner, btnCls, classCombos, errText, ghostBtnCls, inputCls, labelCls, todayStr, useMyAssignments } from './shared';
import { bulkMarkAttendance, correctAttendance, getApprovedLeaves, getAttendanceReport, getClassAttendance, getRoster, studentLabel, type Row } from '../../services/academic';
import { apiErrorMessage } from '../../services/api';

const STATUSES = ['present', 'absent', 'late', 'excused'] as const;

export default function TeacherAttendance() {
  const { assignments, error: scopeError } = useMyAssignments();
  const combos = classCombos(assignments);
  const [comboKey, setComboKey] = useState('');
  const combo = combos.find((c) => c.key === comboKey) ?? combos[0];
  const [date, setDate] = useState(todayStr());
  const [tab, setTab] = useState<'mark' | 'history' | 'report'>('mark');
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Marking state
  const [roster, setRoster] = useState<Row[]>([]);
  const [marked, setMarked] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [onLeave, setOnLeave] = useState<Set<string>>(new Set());
  const [loadingRoster, setLoadingRoster] = useState(false);

  // History state
  const [history, setHistory] = useState<Row[]>([]);
  // Report state
  const [from, setFrom] = useState(todayStr().slice(0, 8) + '01');
  const [to, setTo] = useState(todayStr());
  const [report, setReport] = useState<Row | null>(null);

  const loadRoster = useCallback(async () => {
    if (!combo) return;
    setLoadingRoster(true);
    try {
      const out = await getRoster({ classId: combo.classId, sectionId: combo.sectionId, sessionId: combo.sessionId, date });
      setRoster(out.enrollments); setMarked(out.marked);
      const init: Record<string, string> = {};
      for (const e of out.enrollments) { const sid = String((e.student as Row)?._id ?? ''); init[sid] = out.marked[sid] ?? 'present'; }
      setChoices(init);
      try {
        const leaves = await getApprovedLeaves({ classId: combo.classId, sectionId: combo.sectionId, sessionId: combo.sessionId, date });
        setOnLeave(new Set(leaves.map((l) => String((l.student as Row)?._id ?? ''))));
      } catch { setOnLeave(new Set()); }
    } catch (e) { setBanner({ kind: 'err', text: errText(e, 'Could not load the class roster') }); setRoster([]); }
    finally { setLoadingRoster(false); }
  }, [combo, date]);

  useEffect(() => { if (tab === 'mark') void loadRoster(); }, [loadRoster, tab]);

  const loadHistory = useCallback(async () => {
    if (!combo) return;
    try { setHistory(await getClassAttendance({ classId: combo.classId, sectionId: combo.sectionId, sessionId: combo.sessionId, date })); }
    catch (e) { setBanner({ kind: 'err', text: errText(e, 'Could not load attendance history') }); setHistory([]); }
  }, [combo, date]);
  useEffect(() => { if (tab === 'history') void loadHistory(); }, [loadHistory, tab]);

  const saveBulk = async () => {
    if (!combo) return;
    const pending = roster.filter((e) => !marked[String((e.student as Row)?._id ?? '')]);
    if (pending.length === 0) { setBanner({ kind: 'ok', text: 'Attendance for this date is already fully marked. Use History to correct a status.' }); return; }
    try {
      const out = await bulkMarkAttendance({
        classId: combo.classId, sectionId: combo.sectionId, sessionId: combo.sessionId, date,
        records: pending.map((e) => { const sid = String((e.student as Row)._id); return { studentId: sid, status: choices[sid] ?? 'present' }; }),
      });
      setBanner({ kind: 'ok', text: `Saved attendance for ${out.count} student(s) on ${date}.` });
      await loadRoster();
    } catch (e) { setBanner({ kind: 'err', text: `Save failed: ${apiErrorMessage(e)}` }); }
  };

  const runReport = async () => {
    if (!combo) return;
    try { setReport(await getAttendanceReport({ sessionId: combo.sessionId, classId: combo.classId, sectionId: combo.sectionId, from, to })); }
    catch (e) { setBanner({ kind: 'err', text: errText(e, 'Could not build the report') }); setReport(null); }
  };

  const overall = report ? (report.overall as Row) : null;
  const reportStudents = report ? ((report.students as Row[]) ?? []) : [];

  return (<DashboardLayout role="teacher" title="Attendance" nav={TEACHER_NAV}>
    <div className="space-y-4">
      <Banner banner={scopeError ? { kind: 'err', text: scopeError } : banner} />
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {(['mark', 'history', 'report'] as const).map((t) => (<button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded text-sm font-medium ${tab === t ? 'bg-brand text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>{t === 'mark' ? 'Mark Attendance' : t === 'history' ? 'History & Corrections' : 'Reports'}</button>))}
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <div><label className={labelCls}>Class / Section / Session</label>
            <select className={inputCls} value={combo?.key ?? ''} onChange={(e) => setComboKey(e.target.value)}>
              {combos.length === 0 && <option value="">No assigned classes</option>}
              {combos.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select></div>
          <div><label className={labelCls}>Date</label><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>

        {tab === 'mark' && (<>
          {loadingRoster ? <p className="text-sm text-slate-500">Loading roster…</p> : roster.length === 0
            ? <p className="text-sm text-slate-500">No active enrollments in this class for the selected session.</p>
            : (<>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Student</th><th className="py-2 pr-3">Status</th><th className="py-2">Notes</th></tr></thead>
                <tbody>{roster.map((e) => {
                  const st = e.student as Row; const sid = String(st?._id ?? '');
                  const already = Boolean(marked[sid]);
                  return (<tr key={e._id} className="border-b last:border-0"><td className="py-2 pr-3">{studentLabel(st)}{onLeave.has(sid) && <span className="ml-2 text-[11px] bg-amber-100 text-amber-800 rounded px-1.5 py-0.5">Approved leave</span>}</td>
                    <td className="py-2 pr-3"><select disabled={already} className="border rounded px-2 py-1 text-sm" value={choices[sid] ?? 'present'} onChange={(ev) => setChoices({ ...choices, [sid]: ev.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></td>
                    <td className="py-2 text-slate-500">{already ? `Already marked: ${marked[sid]} (correct in History)` : ''}</td></tr>);
                })}</tbody></table></div>
              <button className={btnCls} onClick={() => void saveBulk()}>Save Attendance (bulk)</button>
              <p className="text-xs text-slate-500">Duplicates are blocked by the server (409). Approved-leave students are flagged so you can mark them Excused.</p>
            </>)}
        </>)}

        {tab === 'history' && (<>
          {history.length === 0 ? <p className="text-sm text-slate-500">No attendance recorded for this class on {date}.</p>
            : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Student</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Edits</th><th className="py-2">Correct</th></tr></thead>
              <tbody>{history.map((r) => (<tr key={r._id} className="border-b last:border-0"><td className="py-2 pr-3">{studentLabel(r.student)}</td><td className="py-2 pr-3 capitalize">{String(r.status)}</td>
                <td className="py-2 pr-3">{Array.isArray(r.editHistory) ? (r.editHistory as unknown[]).length : 0}</td>
                <td className="py-2"><select className="border rounded px-2 py-1 text-sm" defaultValue={String(r.status)} onChange={(ev) => { void (async () => { try { await correctAttendance(r._id, { status: ev.target.value }); setBanner({ kind: 'ok', text: 'Correction saved — the change was appended to the edit history.' }); await loadHistory(); } catch (e2) { setBanner({ kind: 'err', text: `Correction failed: ${apiErrorMessage(e2)}` }); } })(); }}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></td></tr>))}</tbody></table></div>)}
        </>)}

        {tab === 'report' && (<>
          <div className="grid md:grid-cols-3 gap-3 items-end">
            <div><label className={labelCls}>From</label><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label className={labelCls}>To</label><input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <button className={ghostBtnCls} onClick={() => void runReport()}>Build Report</button>
          </div>
          {overall && (<div className="space-y-3">
            <p className="text-sm">Overall: <strong>{overall.attendancePercentage === null ? '—' : `${String(overall.attendancePercentage)}%`}</strong> attendance across {String(overall.total ?? 0)} record(s).</p>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Student</th><th className="py-2 pr-3">Days</th><th className="py-2">Attendance %</th></tr></thead>
              <tbody>{reportStudents.map((s, i) => (<tr key={i} className="border-b last:border-0"><td className="py-2 pr-3">{studentLabel(s.student)}</td><td className="py-2 pr-3">{String(s.total ?? 0)}</td><td className="py-2">{s.attendancePercentage === null || s.attendancePercentage === undefined ? '—' : `${String(s.attendancePercentage)}%`}</td></tr>))}</tbody></table></div>
          </div>)}
        </>)}
      </div>
    </div>
  </DashboardLayout>);
}
