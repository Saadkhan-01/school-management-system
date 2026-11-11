import DashboardLayout from '../../components/layout/DashboardLayout';
import DashboardStats from '../../components/admin/DashboardStats';
import { ADMIN_NAV } from './WebsiteManagement';
export default function AdminDashboard() {
  return (<DashboardLayout role="admin" title="Admin Dashboard" nav={ADMIN_NAV}>
    <DashboardStats variant="admin" />
  </DashboardLayout>);
}
