import DashboardLayout from '../../components/layout/DashboardLayout';
import type { Row } from '../../services/academic';
import { Banner } from '../teacher/shared';
import { LoadingNote, Section, TimetableGrid, enrollmentLine, useStudentPortal } from '../portal/shared';
import { STUDENT_NAV } from './nav';

export default function StudentTimetable() {
  const { data, loading, error } = useStudentPortal();
  const enrollment = data ? (data.enrollment as Row | null) : null;
  const entries = data ? ((data.timetable as Row[]) ?? []) : [];
  return (<DashboardLayout role="student" title="My Timetable" nav={STUDENT_NAV}>
    <div className="space-y-4">
      <Banner banner={error ? { kind: 'err', text: `Could not load your timetable: ${error}` } : null} />
      {loading ? <LoadingNote /> : (<Section title={`Weekly Timetable — ${enrollmentLine(enrollment)}`}>
        {enrollment ? <TimetableGrid entries={entries} /> : <p className="text-sm text-slate-500">You have no active enrollment yet, so there is no class timetable to show.</p>}
      </Section>)}
    </div>
  </DashboardLayout>);
}
