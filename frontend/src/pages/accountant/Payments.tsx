import DashboardLayout from '../../components/layout/DashboardLayout';
import { PaymentsPanel } from '../../components/finance/FinancePanels2';
import { ACCOUNTANT_NAV } from './nav';
export default function AccountantPayments() {
  return (<DashboardLayout role="accountant" title="Payments & Receipts" nav={ACCOUNTANT_NAV}><PaymentsPanel /></DashboardLayout>);
}
