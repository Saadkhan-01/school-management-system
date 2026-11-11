import CalendarPage from '../../components/communication/CalendarPage';
import { PRINCIPAL_NAV } from './nav';
export default function PrincipalCalendar() { return <CalendarPage role="principal" nav={PRINCIPAL_NAV} canManage={true} />; }
