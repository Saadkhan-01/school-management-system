import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { apiErrorMessage } from '../../services/api';
import { getMySubmission, listAssignments, refName, submitAssignment, type Row } from '../../services/academic';
import { Banner, btnCls, errText } from '../teacher/shared';
import { LoadingNote, Section } from '../portal/shared';
import { STUDENT_NAV } from './nav';

/** Assignments for the student's own class (Phase 5 scoped API) with detail
 *  expansion, own-submission status and submission (text + attachment
 *  metadata — file storage is not configured yet, §34). */
export default function StudentAssignments() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [openId, setOpenId] = useState('');
  const [submissions, setSubmissions] = useState<Record<string, Row | null>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listAssignments({ limit: 50 })); }
    catch (e) { setBanner({ kind: 'err', text: errText(e, 'Could not load assignments') }); setItems([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const toggle = async (a: Row) => {
    if (openId === a._id) { setOpenId(''); return; }
    setOpenId(a._id);
    if (!(a._id in submissions)) {
      try { setSubmissions((s) => ({ ...s, [a._id]: null })); const sub = await getMySubmission(a._id); setSubmissions((s) => ({ ...s, [a._id]: sub })); }
      catch { setSubmissions((s) => ({ ...s, [a._id]: null })); } // 404 = not submitted yet
    }
  };

  const submit = async (assignmentId: string) => {
    try {
      const sub = await submitAssignment(assignmentId, { content: drafts[assignmentId] });
      setSubmissions((s) => ({ ...s, [assignmentId]: sub }));
      setBanner({ kind: 'ok', text: 'Assignment submitted.' });
    } catch (e) { setBanner({ kind: 'err', text: `Submission failed: ${apiErrorMessage(e)}` }); }
  };

  return (<DashboardLayout role="student" title="Assignments & Homework" nav={STUDENT_NAV}>
    <div className="space-y-4">
      <Banner banner={banner} />
      <Section title="Assignments for my class">
        {loading ? <LoadingNote /> : items.length === 0
          ? <p className="text-sm text-slate-500">No assignments have been set for your class yet.</p>
          : (<ul className="divide-y">{items.map((a) => {
            const sub = submissions[a._id];
            const isOpen = openId === a._id;
            return (<li key={a._id} className="py-3 text-sm space-y-2">
              <button className="w-full text-left flex justify-between gap-3" onClick={() => void toggle(a)}>
                <span><strong>{String(a.title)}</strong> · {refName(a.subject)} · {refName(a.teacher)}</span>
                <span className="text-slate-600 whitespace-nowrap">due {new Date(String(a.deadline)).toLocaleString()}</span>
              </button>
              {isOpen && (<div className="space-y-2 border-t pt-2">
                {a.instructions ? <p className="text-slate-600 whitespace-pre-line">{String(a.instructions)}</p> : <p className="text-slate-500">No instructions provided.</p>}
                {a.maxMarks ? <p className="text-slate-600">Maximum marks: {String(a.maxMarks)}</p> : null}
                {Array.isArray(a.attachments) && (a.attachments as Row[]).length > 0
                  ? <p className="text-slate-600">Attachments: {(a.attachments as Row[]).map((f) => String(f.name)).join(', ')}</p> : null}
                {sub
                  ? (<div className="bg-slate-50 rounded p-3 space-y-1">
                    <p>Your submission: <strong className="capitalize">{String(sub.status)}</strong>{sub.isLate ? ' (late)' : ''} · {sub.submittedAt ? new Date(String(sub.submittedAt)).toLocaleString() : ''}</p>
                    {sub.feedbackPublished === true
                      ? <p>Marks: <strong>{sub.marks === null || sub.marks === undefined ? '—' : String(sub.marks)}</strong>{sub.feedback ? <> · Feedback: {String(sub.feedback)}</> : null}</p>
                      : <p className="text-slate-500">Marks and feedback appear here once your teacher publishes them.</p>}
                  </div>)
                  : <p className="text-slate-500">You have not submitted this assignment yet.</p>}
                <div className="flex gap-2">
                  <input className="border rounded px-2 py-1.5 flex-1" placeholder="Type your submission text…" value={drafts[a._id] ?? ''} onChange={(e) => setDrafts({ ...drafts, [a._id]: e.target.value })} />
                  <button className={btnCls} onClick={() => void submit(a._id)}>{sub ? 'Resubmit (before deadline)' : 'Submit'}</button>
                </div>
                <p className="text-xs text-slate-500">Resubmission is allowed before the deadline and resets grading; after the deadline your submission is locked. File upload is not configured yet — text submissions only.</p>
              </div>)}
            </li>);
          })}</ul>)}
      </Section>
    </div>
  </DashboardLayout>);
}
