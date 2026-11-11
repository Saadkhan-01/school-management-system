import { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { FeeStructuresPanel, FinanceStatsPanel, InvoicesPanel } from '../../components/finance/FinancePanels';
import { ExpensesPanel, PaymentsPanel, PayrollPanel, ReportsSummaryPanel } from '../../components/finance/FinancePanels2';
import { ADMIN_NAV } from './WebsiteManagement';

type Tab = 'overview' | 'structures' | 'invoices' | 'payments' | 'expenses' | 'payroll' | 'reports';

/** Admin Finance (§7/§12) — one page with tabs over the same Phase 7 APIs the
 * Accountant portal uses; the server applies identical RBAC to both roles. */
export default function AdminFinance() {
  const [tab, setTab] = useState<Tab>('overview');
  return (<DashboardLayout role="admin" title="Finance" nav={ADMIN_NAV}>
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {([['overview', 'Overview'], ['structures', 'Fee Structures & Scholarships'], ['invoices', 'Invoices'], ['payments', 'Payments & Receipts'], ['expenses', 'Expenses & Income'], ['payroll', 'Payroll'], ['reports', 'Reports']] as Array<[Tab, string]>).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded text-sm font-medium ${tab === t ? 'bg-brand text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>{label}</button>
        ))}
      </div>
      {tab === 'overview' && <FinanceStatsPanel variant="accountant" />}
      {tab === 'structures' && <FeeStructuresPanel />}
      {tab === 'invoices' && <InvoicesPanel />}
      {tab === 'payments' && <PaymentsPanel />}
      {tab === 'expenses' && <ExpensesPanel />}
      {tab === 'payroll' && <PayrollPanel />}
      {tab === 'reports' && <ReportsSummaryPanel />}
    </div>
  </DashboardLayout>);
}
