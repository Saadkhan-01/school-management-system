import CalendarPage from '../../components/communication/CalendarPage';
import { ADMIN_NAV } from './WebsiteManagement';
export default function AdminCalendar() { return <CalendarPage role="admin" nav={ADMIN_NAV} canManage={true} />; }
