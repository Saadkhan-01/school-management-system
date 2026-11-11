import AppointmentsPage from '../../components/communication/AppointmentsPage';
import { ADMIN_NAV } from './WebsiteManagement';
export default function AdminAppointments() { return <AppointmentsPage role="admin" nav={ADMIN_NAV} canManage={true} />; }
