
import DashboardLayout from '../../components/layout/DashboardLayout';
import { ADMIN_NAV } from './WebsiteManagement';
import { ComplaintsPanel } from './OpsSharedPanels';
export default function AdminComplaints() {
  return (<DashboardLayout role="admin" title="Complaints" nav={ADMIN_NAV}><ComplaintsPanel /></DashboardLayout>);
}
