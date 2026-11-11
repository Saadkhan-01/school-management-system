import DashboardLayout from '../../components/layout/DashboardLayout';
import { PayrollPanel } from '../../components/finance/FinancePanels2';
import { ACCOUNTANT_NAV } from './nav';
export default function AccountantPayroll() {
  return (<DashboardLayout role="accountant" title="Payroll & Payslips" nav={ACCOUNTANT_NAV}><PayrollPanel /></DashboardLayout>);
}
