import DashboardLayout from '../../components/layout/DashboardLayout';
import { InvoicesPanel } from '../../components/finance/FinancePanels';
import { ACCOUNTANT_NAV } from './nav';
export default function AccountantInvoices() {
  return (<DashboardLayout role="accountant" title="Invoices / Challans" nav={ACCOUNTANT_NAV}><InvoicesPanel /></DashboardLayout>);
}
