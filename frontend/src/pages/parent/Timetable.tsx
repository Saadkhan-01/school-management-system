import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { apiErrorMessage } from '../../services/api';
import { getTimetableByStudent, type Row } from '../../services/academic';
import { Banner } from '../teacher/shared';
import { LoadingNote, Section, TimetableGrid, enrollmentLine } from '../portal/shared';
import { ChildSwitcher, NoChildrenNote, useParentChildren } from './shared';
import { PARENT_NAV } from './nav';

/** Child timetable via GET /timetable/by-student/:id (verified-link scoped). */
export default function ParentTimetable() {
  const { portal, children, childId, setChildId, loading, error } = useParentChildren();
  const [entries, setEntries] = useState<Row[]>([]);
  const [enrollment, setEnrollment] = useState<Row | null>(null);
  const [ttLoading, setTtLoading] = useState(false);
  const [ttError, setTtError] = useState<string | null>(null);

  useEffect(() => {
    if (!childId) return;
    (async () => {
      setTtLoading(true); setTtError(null);
      try {
        const out = await getTimetableByStudent(childId);
        setEntries(out.entries);
        setEnrollment(out.enrollment);
      } catch (e) { setTtError(apiErrorMessage(e)); setEntries([]); }
      finally { setTtLoading(false); }
    })();
  }, [childId]);

  return (<DashboardLayout role="parent" title="Child Timetable" nav={PARENT_NAV}>
    <div className="space-y-4">
      <Banner banner={error ? { kind: 'err', text: `Could not load your portal: ${error}` } : ttError ? { kind: 'err', text: `Could not load the timetable: ${ttError}` } : null} />
      {loading ? <LoadingNote /> : children.length === 0 ? <NoChildrenNote portal={portal} /> : (<>
        <ChildSwitcher children={children} childId={childId} onChange={setChildId} />
        {ttLoading ? <LoadingNote text="Loading timetable…" /> : (<Section title={`Weekly Timetable — ${enrollmentLine(enrollment)}`}>
          {enrollment ? <TimetableGrid entries={entries} /> : <p className="text-sm text-slate-500">This child has no active enrollment yet, so there is no class timetable to show.</p>}
        </Section>)}
      </>)}
    </div>
  </DashboardLayout>);
}
