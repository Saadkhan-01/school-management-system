
import DashboardLayout from '../../components/layout/DashboardLayout';
import { LIBRARIAN_NAV } from './nav';
import { Banner, Section, useLoader } from '../opsShared';
import { librarySummary } from '../../services/operations';
export default function LibrarianDashboard() {
  const { data, banner } = useLoader(() => librarySummary());
  return (<DashboardLayout role="librarian" title="Librarian Dashboard" nav={LIBRARIAN_NAV}>
    <Banner banner={banner} />
    <Section title="Library summary (live records)">
      {data ? (<div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="border rounded-xl p-3"><p className="text-2xl font-bold">{String(data.totalBooks ?? 0)}</p><p className="text-slate-500">Books</p></div>
        <div className="border rounded-xl p-3"><p className="text-2xl font-bold">{String(data.totalCopies ?? 0)}</p><p className="text-slate-500">Copies</p></div>
        <div className="border rounded-xl p-3"><p className="text-2xl font-bold">{String(data.availableCopies ?? 0)}</p><p className="text-slate-500">Available</p></div>
        <div className="border rounded-xl p-3"><p className="text-2xl font-bold">{String(data.overdueOpenIssues ?? 0)}</p><p className="text-slate-500">Overdue issues</p></div>
      </div>) : <p className="text-sm text-slate-500">Loading…</p>}
    </Section>
  </DashboardLayout>);
}
