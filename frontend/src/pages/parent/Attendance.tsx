import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { api, apiErrorMessage } from '../../services/api';
import { refName, type Row } from '../../services/academic';
import { Banner } from '../teacher/shared';
import { LoadingNote, Section } from '../portal/shared';
import { ChildSwitcher, NoChildrenNote, useParentChildren } from './shared';
import { PARENT_NAV } from './nav';

/** Child attendance via GET /attendance/student/:id — the server verifies the
 *  parent↔child link on every request; an unlinked id returns 403. */
export default function ParentAttendance() {
  const { portal, children, childId, setChildId, loading, error } = useParentChildren();
  const [records, setRecords] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Row | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);

  useEffect(() => {
    if (!childId) return;
    (async () => {
      setRecLoading(true); setRecError(null);
      try {
        const r = await api.get(`/attendance/student/${childId}`, { params: { limit: 100 } });
        setRecords((r.data.data.records as Row[]) ?? []);
        setSummary(r.data.data.summary as Row);
      } catch (e) { setRecError(apiErrorMessage(e)); setRecords([]); setSummary(null); }
      finally { setRecLoading(false); }
    })();
  }, [childId]);

  const counts = summary ? (summary.counts as Row) : null;
  return (<DashboardLayout role="parent" title="Child Attendance" nav={PARENT_NAV}>
    <div className="space-y-4">
      <Banner banner={error ? { kind: 'err', text: `Could not load your portal: ${error}` } : recError ? { kind: 'err', text: `Could not load attendance: ${recError}` } : null} />
      {loading ? <LoadingNote /> : children.length === 0 ? <NoChildrenNote portal={portal} /> : (<>
        <ChildSwitcher children={children} childId={childId} onChange={setChildId} />
        {recLoading ? <LoadingNote text="Loading attendance…" /> : (<>
          <Section title="Overview">
            {summary
              ? (<div className="text-sm space-y-1">
                <p>Overall attendance: <strong>{summary.attendancePercentage === null || summary.attendancePercentage === undefined ? '—' : `${String(summary.attendancePercentage)}%`}</strong> over {String(summary.total ?? 0)} recorded day(s).</p>
                {counts ? <p className="text-slate-600">Present {String(counts.present ?? 0)} · Late {String(counts.late ?? 0)} · Excused {String(counts.excused ?? 0)} · Absent {String(counts.absent ?? 0)}</p> : null}
                <p className="text-xs text-slate-500">Attendance is recorded per class per day, so there is no subject-wise breakdown.</p>
              </div>)
              : <p className="text-sm text-slate-500">No attendance summary available for this child.</p>}
          </Section>
          <Section title="Recent records">
            {records.length === 0
              ? <p className="text-sm text-slate-500">No attendance records yet for this child.</p>
              : (<ul className="divide-y text-sm">{records.map((r) => (<li key={r._id} className="py-2 flex justify-between gap-3"><span>{new Date(String(r.date)).toLocaleDateString()} · {refName(r.schoolClass)} {refName(r.section)}</span><span className="capitalize font-medium">{String(r.status)}</span></li>))}</ul>)}
          </Section>
        </>)}
      </>)}
    </div>
  </DashboardLayout>);
}
