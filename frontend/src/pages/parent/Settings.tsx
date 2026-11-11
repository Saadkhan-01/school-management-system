import DashboardLayout from '../../components/layout/DashboardLayout';
import { AccountSettings } from '../portal/shared';
import { PARENT_NAV } from './nav';

export default function ParentSettings() {
  return (<DashboardLayout role="parent" title="Account Settings" nav={PARENT_NAV}>
    <AccountSettings />
  </DashboardLayout>);
}
