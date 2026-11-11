import DashboardLayout from '../../components/layout/DashboardLayout';
import { ReportsSummaryPanel } from '../../components/finance/FinancePanels2';
import ReportsPage from '../../components/communication/ReportsPage';
import { ACCOUNTANT_NAV } from './nav';
export default function AccountantReports() {
  return (<DashboardLayout role="accountant" title="Reports" nav={ACCOUNTANT_NAV}>
    <div className="space-y-4">
      <ReportsSummaryPanel />
      {/* Phase 9 (§27): catalogue-driven finance reports (fee collection,
          defaulters, expenses, payroll summary, transport, inventory) with
          CSV / XLSX / PDF exports — same RBAC enforced on the backend. */}
      <ReportsPage role="accountant" nav={ACCOUNTANT_NAV} heading="Detailed Reports & Exports" embedded />
    </div>
  </DashboardLayout>);
}
