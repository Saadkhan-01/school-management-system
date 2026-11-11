import DashboardLayout from '../../components/layout/DashboardLayout';
import type { Row } from '../../services/academic';
import { Banner } from '../teacher/shared';
import { LoadingNote, ReportCardPanel, Section, useStudentPortal } from '../portal/shared';
import { STUDENT_NAV } from './nav';

export default function StudentResults() {
  const { data, loading, error } = useStudentPortal();
  const studentId = data ? String((data.student as Row).id) : '';
  const publishedExams = data ? ((data.publishedExams as Row[]) ?? []) : [];
  return (<DashboardLayout role="student" title="Exams & Results" nav={STUDENT_NAV}>
    <div className="space-y-4">
      <Banner banner={error ? { kind: 'err', text: `Could not load your results: ${error}` } : null} />
      {loading ? <LoadingNote /> : (<Section title="Published results & report cards">
        <p className="text-xs text-slate-500 mb-3">Only PUBLISHED results are listed — the server returns 404 for anything unpublished, so nothing can leak early.</p>
        {studentId ? <ReportCardPanel exams={publishedExams} studentId={studentId} /> : <p className="text-sm text-slate-500">No student record is linked to your login yet.</p>}
      </Section>)}
    </div>
  </DashboardLayout>);
}
