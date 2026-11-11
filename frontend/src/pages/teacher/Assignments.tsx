import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { TEACHER_NAV } from './nav';
import { Banner, assignmentLabel, btnCls, errText, ghostBtnCls, inputCls, labelCls, useMyAssignments } from './shared';
import { createAssignment, gradeSubmission, listAssignments, listSubmissions, studentLabel, type Row } from '../../services/academic';
import { apiErrorMessage } from '../../services/api';

export default function TeacherAssignments() {
  const { assignments: scope, error: scopeError } = useMyAssignments();
  const [items, setItems] = useState<Row[]>([]);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [form, setForm] = useState({ scopeKey: '', title: '', instructions: '', deadline: '', maxMarks: '', attachmentName: '', attachmentUrl: '' });
  const [selected, setSelected] = useState<Row | null>(null);
  const [submissions, setSubmissions] = useState<Row[]>([]);
  const [grades, setGrades] = useState<Record<string, { marks: string; feedback: string }>>({});

  const load = useCallback(async () => {
    try { setItems(await listAssignments({ limit: 50 })); }
    catch (e) { setBanner({ kind: 'err', text: errText(e, 'Could not load assignments') }); setItems([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const scopeRow = scope.find((a) => a._id === form.scopeKey) ?? scope[0];

  const create = async () => {
    if (!scopeRow) { setBanner({ kind: 'err', text: 'You have no assigned class/subject to create an assignment for.' }); return; }
    try {
      await createAssignment({
        classId: String((scopeRow.schoolClass as Row)._id), sectionId: String((scopeRow.section as Row)._id),
        subjectId: String((scopeRow.subject as Row)._id), sessionId: String((scopeRow.session as Row)._id),
        title: form.title, instructions: form.instructions || undefined, deadline: new Date(form.deadline).toISOString(),
        maxMarks: form.maxMarks ? Number(form.maxMarks) : undefined,
        attachments: form.attachmentName ? [{ name: form.attachmentName, url: form.attachmentUrl || undefined }] : [],
      } as unknown as Row);
      setBanner({ kind: 'ok', text: 'Assignment created. Students in this class can now see and submit it.' });
      setForm({ ...form, title: '', instructions: '', maxMarks: '', attachmentName: '', attachmentUrl: '' });
      await load();
    } catch (e) { setBanner({ kind: 'err', text: `Create failed: ${apiErrorMessage(e)}` }); }
  };

  const openSubmissions = async (a: Row) => {
    setSelected(a);
    try { setSubmissions(await listSubmissions(a._id)); }
    catch (e) { setBanner({ kind: 'err', text: errText(e, 'Could not load submissions') }); setSubmissions([]); }
  };

  const saveGrade = async (sub: Row) => {
    const g = grades[sub._id] ?? { marks: '', feedback: '' };
    try {
      await gradeSubmission(sub._id, { marks: g.marks ? Number(g.marks) : undefined, feedback: g.feedback || undefined, feedbackPublished: true });
      setBanner({ kind: 'ok', text: 'Grade and feedback saved and published to the student/parent.' });
      if (selected) await openSubmissions(selected);
    } catch (e) { setBanner({ kind: 'err', text: `Grading failed: ${apiErrorMessage(e)}` }); }
  };

  return (<DashboardLayout role="teacher" title="Assignments" nav={TEACHER_NAV}>
    <div className="space-y-4">
      <Banner banner={scopeError ? { kind: 'err', text: scopeError } : banner} />
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
        <h2 className="text-lg font-semibold">Create Assignment (§20)</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div><label className={labelCls}>Class / Section / Subject</label>
            <select className={inputCls} value={scopeRow?._id ?? ''} onChange={(e) => setForm({ ...form, scopeKey: e.target.value })}>
              {scope.length === 0 && <option value="">No assigned classes</option>}
              {scope.map((a) => <option key={a._id} value={a._id}>{assignmentLabel(a)}</option>)}
            </select></div>
          <div><label className={labelCls}>Deadline</label><input type="datetime-local" className={inputCls} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
          <div><label className={labelCls}>Title</label><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Chapter 4 exercises" /></div>
          <div><label className={labelCls}>Max marks (optional)</label><input type="number" min={1} className={inputCls} value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: e.target.value })} /></div>
          <div className="md:col-span-2"><label className={labelCls}>Instructions</label><textarea className={inputCls} rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
          <div><label className={labelCls}>Attachment name (metadata only)</label><input className={inputCls} value={form.attachmentName} onChange={(e) => setForm({ ...form, attachmentName: e.target.value })} placeholder="worksheet.pdf" /></div>
          <div><label className={labelCls}>Attachment URL (optional)</label><input className={inputCls} value={form.attachmentUrl} onChange={(e) => setForm({ ...form, attachmentUrl: e.target.value })} placeholder="https://…" /></div>
        </div>
        <p className="text-xs text-slate-500">File upload storage (Cloudinary/S3) is not configured yet, so attachments are recorded as name/URL metadata — no file is uploaded or faked.</p>
        <button className={btnCls} onClick={() => void create()}>Create Assignment</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold mb-3">My Assignments</h3>
        {items.length === 0 ? <p className="text-sm text-slate-500">No assignments yet.</p>
          : (<ul className="divide-y">{items.map((a) => (<li key={a._id} className="py-2 flex items-center justify-between gap-3 text-sm">
            <span><strong>{String(a.title)}</strong> · due {new Date(String(a.deadline)).toLocaleString()}</span>
            <button className={ghostBtnCls} onClick={() => void openSubmissions(a)}>Submissions</button></li>))}</ul>)}
      </div>

      {selected && (<div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold mb-3">Submissions — {String(selected.title)}</h3>
        {submissions.length === 0 ? <p className="text-sm text-slate-500">No submissions yet.</p>
          : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-3">Student</th><th className="py-2 pr-3">Submitted</th><th className="py-2 pr-3">Late</th><th className="py-2 pr-3">Marks</th><th className="py-2 pr-3">Feedback</th><th className="py-2">Save</th></tr></thead>
            <tbody>{submissions.map((s) => { const g = grades[s._id] ?? { marks: s.marks !== undefined ? String(s.marks) : '', feedback: (s.feedback as string) ?? '' };
              return (<tr key={s._id} className="border-b last:border-0 align-top"><td className="py-2 pr-3">{studentLabel(s.student)}</td>
                <td className="py-2 pr-3">{new Date(String(s.submittedAt)).toLocaleString()}</td><td className="py-2 pr-3">{s.isLate ? 'Yes' : 'No'}</td>
                <td className="py-2 pr-3"><input type="number" min={0} className="border rounded px-2 py-1 w-20" value={g.marks} onChange={(e) => setGrades({ ...grades, [s._id]: { ...g, marks: e.target.value } })} /></td>
                <td className="py-2 pr-3"><input className="border rounded px-2 py-1 w-56" value={g.feedback} onChange={(e) => setGrades({ ...grades, [s._id]: { ...g, feedback: e.target.value } })} placeholder="Feedback (published on save)" /></td>
                <td className="py-2"><button className={btnCls} onClick={() => void saveGrade(s)}>Grade</button></td></tr>); })}</tbody></table></div>)}
      </div>)}
    </div>
  </DashboardLayout>);
}
