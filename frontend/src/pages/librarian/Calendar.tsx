import CalendarPage from '../../components/communication/CalendarPage';
import { LIBRARIAN_NAV } from './nav';
export default function LibrarianCalendar() { return <CalendarPage role="librarian" nav={LIBRARIAN_NAV} canManage={false} />; }
