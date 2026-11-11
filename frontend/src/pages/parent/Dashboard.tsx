import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import type { Row } from '../../services/academic';
import { Banner } from '../teacher/shared';
import { LoadingNote, Section, enrollmentLine } from '../portal/shared';
import { ChildSwitcher, NoChildrenNote, useChildSummary, useParentChildren } from './shared';
import { PARENT_NAV } from './nav';

export default function ParentDashboard() {
  const { portal, children, childId, setChildId, loading, error } = useParentChildren();
  const { summary, loading: summaryLoading, error: summaryError } = useChildSummary(childId);
  const account = portal ? (portal.account as Row) : null;
  const profile = portal ? (portal.profile as Row | null) : null;
  const attSummary = summary ? ((summary.attendance as Row).summary as Row) : null;
  const childAssignments = summary ? (summary.assignments as Row) : null;

  return (<DashboardLayout role="parent" title="Parent Dashboard" nav={PARENT_NAV}>
    <div className="space-y-4">
      <Banner banner={error ? { kind: 'err', text: `Could not load your portal: ${error}` } : summaryError ? { kind: 'err', text: `Could not load the child summary: ${summaryError}` } : null} />
      {loading ? <LoadingNote text="Loading your dashboard…" /> : (<>
        {account && (<div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold">Welcome, {String(account.name)}</h2>
          <p className="text-sm text-slate-600">{String(account.email)}{profile?.occupation ? <> · {String(profile.occupation)}</> : ''}{profile?.phone ? <> · {String(profile.phone)}</> : ''}</p>
          <p className="text-sm text-slate-600">{children.length} verified {children.length === 1 ? 'child' : 'children'} linked to your account.</p>
        </div>)}
        {children.length === 0 ? <NoChildrenNote portal={portal} /> : (<>
          <ChildSwitcher children={children} childId={childId} onChange={setChildId} />
          {summaryLoading ? <LoadingNote text="Loading child summary…" /> : summary ? (<>
            <div className="bg-white rounded-xl shadow-sm p-5 flex flex-wrap gap-5 items-start">
              <div>
                <h3 className="font-semibold">{String((summary.student as Row).fullName)}</h3>
                <p className="text-sm text-slate-600">Admission No: <strong>{String((summary.student as Row).admissionNumber)}</strong> · {enrollmentLine(summary.enrollment as Row | null)}</p>
              </div>
              <div className="ml-auto grid grid-cols-3 gap-3 text-center">
                <div className="border rounded-xl px-4 py-3"><p className="text-xl font-bold">{attSummary && attSummary.attendancePercentage !== null && attSummary.attendancePercentage !== undefined ? `${String(attSummary.attendancePercentage)}%` : '—'}</p><p className="text-xs text-slate-500">Attendance</p></div>
                <div className="border rounded-xl px-4 py-3"><p className="text-xl font-bold">{String(childAssignments?.pendingCount ?? 0)}</p><p className="text-xs text-slate-500">Assignments pending</p></div>
                <div className="border rounded-xl px-4 py-3"><p className="text-xl font-bold">{((summary.publishedExams as Row[]) ?? []).length}</p><p className="text-xs text-slate-500">Published results</p></div>
              </div>
            </div>
            <Section title="Quick links for this child">
              <div className="flex flex-wrap gap-2 text-sm">
                <Link className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200" to="/parent/attendance">Attendance</Link>
                <Link className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200" to="/parent/results">Results & Report Cards</Link>
                <Link className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200" to="/parent/assignments">Assignments & Feedback</Link>
                <Link className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200" to="/parent/timetable">Timetable</Link>
                <Link className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200" to="/parent/leave">Apply for Leave</Link>
                <Link className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200" to="/parent/announcements">Announcements</Link>
              </div>
            </Section>
          </>) : <p className="text-sm text-slate-500">Select a child to see their summary.</p>}
        </>)}
      </>)}
    </div>
  </DashboardLayout>);
}
