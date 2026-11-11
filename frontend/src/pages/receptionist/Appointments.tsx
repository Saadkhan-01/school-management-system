import AppointmentsPage from '../../components/communication/AppointmentsPage';
import { RECEPTIONIST_NAV } from './nav';
export default function ReceptionistAppointments() { return <AppointmentsPage role="receptionist" nav={RECEPTIONIST_NAV} canManage={true} />; }
