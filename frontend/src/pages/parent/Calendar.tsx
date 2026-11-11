import CalendarPage from '../../components/communication/CalendarPage';
import { PARENT_NAV } from './nav';
export default function ParentCalendar() { return <CalendarPage role="parent" nav={PARENT_NAV} canManage={false} />; }
