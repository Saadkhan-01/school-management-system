import DashboardLayout from '../../components/layout/DashboardLayout';
import { AccountSettings } from '../portal/shared';
import { STUDENT_NAV } from './nav';

export default function StudentSettings() {
  return (<DashboardLayout role="student" title="Account Settings" nav={STUDENT_NAV}>
    <AccountSettings />
  </DashboardLayout>);
}
