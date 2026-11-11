
import DashboardLayout from '../../components/layout/DashboardLayout';
import { LIBRARIAN_NAV } from './nav';
import { Banner, Section, fmtMinor, useLoader } from '../opsShared';
import { librarySummary } from '../../services/operations';
export default function LibrarianReports() {
  const { data, banner } = useLoader(() => librarySummary());
  const fines = (data?.fineTotalsMinor as Record<string, number> | undefined) ?? {};
  return (<DashboardLayout role="librarian" title="Library Reports" nav={LIBRARIAN_NAV}>
    <Banner banner={banner} />
    <Section title="Summary from real records">
      {data ? <ul className="text-sm space-y-1">
        <li>Books: {String(data.totalBooks ?? 0)} · Copies: {String(data.totalCopies ?? 0)}</li>
        <li>Available: {String(data.availableCopies ?? 0)} · Issued: {String(data.issuedCopies ?? 0)} · Overdue open: {String(data.overdueOpenIssues ?? 0)}</li>
        <li>Loan period: {String(data.loanDays ?? 14)} days · Fine: 5.00/day overdue</li>
        {Object.entries(fines).map(([k, v]) => <li key={k}>Fines ({k}): {fmtMinor(v)}</li>)}
      </ul> : <p className="text-sm text-slate-500">Loading…</p>}
    </Section>
  </DashboardLayout>);
}
