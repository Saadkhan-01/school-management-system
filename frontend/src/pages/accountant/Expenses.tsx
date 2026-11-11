import DashboardLayout from '../../components/layout/DashboardLayout';
import { ExpensesPanel } from '../../components/finance/FinancePanels2';
import { ACCOUNTANT_NAV } from './nav';
export default function AccountantExpenses() {
  return (<DashboardLayout role="accountant" title="Expenses & Income" nav={ACCOUNTANT_NAV}><ExpensesPanel /></DashboardLayout>);
}
