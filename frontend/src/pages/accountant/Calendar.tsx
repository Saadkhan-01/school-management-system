import CalendarPage from '../../components/communication/CalendarPage';
import { ACCOUNTANT_NAV } from './nav';
export default function AccountantCalendar() { return <CalendarPage role="accountant" nav={ACCOUNTANT_NAV} canManage={false} />; }
