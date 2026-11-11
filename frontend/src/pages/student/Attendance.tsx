import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { api, apiErrorMessage } from '../../services/api';
import { refName, type Row } from '../../services/academic';
import { Banner } from '../teacher/shared';
import { LoadingNote, Section, useStudentPortal } from '../portal/shared';
import { STUDENT_NAV } from './nav';

/** Full attendance history via the Phase 5 scoped endpoint
 *  GET /attendance/student/:id (server checks the record is the caller's own). */
export default function StudentAttendance() {
  const portal = useStudentPortal();
  const studentId = portal.data ? String((portal.data.student as Row).id) : '';
  const [records, setRecords] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    (async () => {
      setLoading(true);
      try {
        const r = await api.get(`/attendance/student/${studentId}`, { params: { limit: 100 } });
        setRecords((r.data.data.records as Row[]) ?? []);
        setSummary(r.data.data.summary as Row);
      } catch (e) { setError(apiErrorMessage(e)); }
      finally { setLoading(false); }
    })();
  }, [studentId]);

  const counts = summary ? (summary.counts as Row) : null;
  return (<DashboardLayout role="student" title="Attendance" nav={STUDENT_NAV}>
    <div className="space-y-4">
      <Banner banner={portal.error ? { kind: 'err', text: `Could not load your portal: ${portal.error}` } : error ? { kind: 'err', text: `Could not load attendance records: ${error}` } : null} />
      {portal.loading || loading ? <LoadingNote text="Loading attendance…" /> : (<>
        <Section title="Overview">
          {summary
            ? (<div className="text-sm space-y-1">
              <p>Overall attendance: <strong>{summary.attendancePercentage === null || summary.attendancePercentage === undefined ? '—' : `${String(summary.attendancePercentage)}%`}</strong> over {String(summary.total ?? 0)} recorded day(s).</p>
              {counts ? <p className="text-slate-600">Present {String(counts.present ?? 0)} · Late {String(counts.late ?? 0)} · Excused {String(counts.excused ?? 0)} · Absent {String(counts.absent ?? 0)}</p> : null}
              <p className="text-xs text-slate-500">Attendance is recorded per class per day, so there is no subject-wise breakdown — the school does not record attendance per subject.</p>
            </div>)
            : <p className="text-sm text-slate-500">No attendance summary available.</p>}
        </Section>
        <Section title="Recent records">
          {records.length === 0
            ? <p className="text-sm text-slate-500">No attendance records yet.</p>
            : (<ul className="divide-y text-sm">{records.map((r) => (<li key={r._id} className="py-2 flex justify-between gap-3"><span>{new Date(String(r.date)).toLocaleDateString()} · {refName(r.schoolClass)} {refName(r.section)}</span><span className="capitalize font-medium">{String(r.status)}</span></li>))}</ul>)}
        </Section>
      </>)}
    </div>
  </DashboardLayout>);
}
