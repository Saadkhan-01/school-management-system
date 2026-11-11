import DashboardLayout from '../../components/layout/DashboardLayout';
import { FeeStructuresPanel } from '../../components/finance/FinancePanels';
import { ACCOUNTANT_NAV } from './nav';
export default function AccountantFees() {
  return (<DashboardLayout role="accountant" title="Fee Structures & Scholarships" nav={ACCOUNTANT_NAV}><FeeStructuresPanel /></DashboardLayout>);
}
