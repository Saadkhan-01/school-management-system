import CalendarPage from '../../components/communication/CalendarPage';
import { RECEPTIONIST_NAV } from './nav';
export default function ReceptionistCalendar() { return <CalendarPage role="receptionist" nav={RECEPTIONIST_NAV} canManage={false} />; }
