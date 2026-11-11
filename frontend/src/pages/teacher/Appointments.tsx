import AppointmentsPage from '../../components/communication/AppointmentsPage';
import { TEACHER_NAV } from './nav';
export default function TeacherAppointments() { return <AppointmentsPage role="teacher" nav={TEACHER_NAV} canManage={false} />; }
