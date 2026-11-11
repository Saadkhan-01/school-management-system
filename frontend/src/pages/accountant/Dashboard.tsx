import DashboardLayout from '../../components/layout/DashboardLayout';
import { FinanceStatsPanel } from '../../components/finance/FinancePanels';
import { ACCOUNTANT_NAV } from './nav';

export default function AccountantDashboard() {
  return (<DashboardLayout role="accountant" title="Accountant Dashboard" nav={ACCOUNTANT_NAV}>
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold">Finance Overview (§12)</h2>
        <p className="text-sm text-slate-600 mt-1">Live figures from real fee, payment, expense and payroll records. Fee income counts <strong>verified</strong> payments only — a payment is never treated as received before the accounts office verifies it.</p>
        <p className="text-sm text-slate-600 mt-1">Online payments: the gateway is <strong>not configured</strong> in this deployment, so online checkout honestly returns “gateway not configured” — manual payments with verification are the working path. See <code>backend/.env.example</code> for what a real gateway integration needs.</p>
      </div>
      <FinanceStatsPanel variant="accountant" />
    </div>
  </DashboardLayout>);
}
