import CalendarPage from '../../components/communication/CalendarPage';
import { TEACHER_NAV } from './nav';
export default function TeacherCalendar() { return <CalendarPage role="teacher" nav={TEACHER_NAV} canManage={false} />; }
