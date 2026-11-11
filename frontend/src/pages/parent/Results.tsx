import DashboardLayout from '../../components/layout/DashboardLayout';
import type { Row } from '../../services/academic';
import { Banner } from '../teacher/shared';
import { LoadingNote, ReportCardPanel, Section } from '../portal/shared';
import { ChildSwitcher, NoChildrenNote, useChildSummary, useParentChildren } from './shared';
import { PARENT_NAV } from './nav';

export default function ParentResults() {
  const { portal, children, childId, setChildId, loading, error } = useParentChildren();
  const { summary, loading: summaryLoading, error: summaryError } = useChildSummary(childId);
  const publishedExams = summary ? ((summary.publishedExams as Row[]) ?? []) : [];
  return (<DashboardLayout role="parent" title="Results & Report Cards" nav={PARENT_NAV}>
    <div className="space-y-4">
      <Banner banner={error ? { kind: 'err', text: `Could not load your portal: ${error}` } : summaryError ? { kind: 'err', text: `Could not load results: ${summaryError}` } : null} />
      {loading ? <LoadingNote /> : children.length === 0 ? <NoChildrenNote portal={portal} /> : (<>
        <ChildSwitcher children={children} childId={childId} onChange={setChildId} />
        {summaryLoading ? <LoadingNote text="Loading results…" /> : (<Section title="Published results & report cards">
          <p className="text-xs text-slate-500 mb-3">Only PUBLISHED results are listed — unpublished results are hidden by the server (404 by design).</p>
          {childId ? <ReportCardPanel exams={publishedExams} studentId={childId} /> : null}
        </Section>)}
      </>)}
    </div>
  </DashboardLayout>);
}
