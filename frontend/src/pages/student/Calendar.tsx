import CalendarPage from '../../components/communication/CalendarPage';
import { STUDENT_NAV } from './nav';
export default function StudentCalendar() { return <CalendarPage role="student" nav={STUDENT_NAV} canManage={false} />; }
