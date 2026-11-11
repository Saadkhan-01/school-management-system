import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getMySubmission, listAssignments, refName, type Row } from '../../services/academic';
import { Banner, errText } from '../teacher/shared';
import { LoadingNote, Section } from '../portal/shared';
import { ChildSwitcher, NoChildrenNote, useParentChildren } from './shared';
import { PARENT_NAV } from './nav';

/** Child assignments + teacher feedback. Feedback/marks are shown only when
 *  the server returns them — the API withholds them until the teacher
 *  publishes feedback (feedbackPublished), for parents AND students. */
export default function ParentAssignments() {
  const { portal, children, childId, setChildId, loading, error } = useParentChildren();
  const [items, setItems] = useState<Row[]>([]);
  const [subs, setSubs] = useState<Record<string, Row | null>>({});
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!childId) return;
    setListLoading(true); setListError(null);
    try {
      const rows = await listAssignments({ limit: 50, studentId: childId });
      setItems(rows);
      const entries = await Promise.all(rows.map(async (a) => {
        try { return [a._id, await getMySubmission(a._id, { studentId: childId })] as const; }
        catch { return [a._id, null] as const; } // 404 = not submitted yet
      }));
      setSubs(Object.fromEntries(entries));
    } catch (e) { setListError(errText(e, 'Could not load assignments')); setItems([]); }
    finally { setListLoading(false); }
  }, [childId]);
  useEffect(() => { void load(); }, [load]);

  return (<DashboardLayout role="parent" title="Assignments & Feedback" nav={PARENT_NAV}>
    <div className="space-y-4">
      <Banner banner={error ? { kind: 'err', text: `Could not load your portal: ${error}` } : listError ? { kind: 'err', text: listError } : null} />
      {loading ? <LoadingNote /> : children.length === 0 ? <NoChildrenNote portal={portal} /> : (<>
        <ChildSwitcher children={children} childId={childId} onChange={setChildId} />
        <Section title="Assignments for this child">
          {listLoading ? <LoadingNote /> : items.length === 0
            ? <p className="text-sm text-slate-500">No assignments have been set for this child's class yet.</p>
            : (<ul className="divide-y">{items.map((a) => {
              const sub = subs[a._id];
              return (<li key={a._id} className="py-3 text-sm space-y-1">
                <div className="flex justify-between gap-3"><span><strong>{String(a.title)}</strong> · {refName(a.subject)} · {refName(a.teacher)}</span><span className="text-slate-600 whitespace-nowrap">due {new Date(String(a.deadline)).toLocaleString()}</span></div>
                {a.instructions ? <p className="text-slate-600">{String(a.instructions)}</p> : null}
                {sub
                  ? (<p className="text-slate-600">Submission: <strong className="capitalize">{String(sub.status)}</strong>{sub.isLate ? ' (late)' : ''} · {sub.submittedAt ? new Date(String(sub.submittedAt)).toLocaleString() : ''}
                    {sub.feedbackPublished === true
                      ? <> · Marks: <strong>{sub.marks === null || sub.marks === undefined ? '—' : String(sub.marks)}</strong>{sub.feedback ? <> · Feedback: {String(sub.feedback)}</> : null}</>
                      : <> · <span className="text-slate-500">Feedback has not been published by the teacher yet.</span></>}</p>)
                  : <p className="text-slate-500">Not submitted yet.</p>}
              </li>);
            })}</ul>)}
        </Section>
      </>)}
    </div>
  </DashboardLayout>);
}
