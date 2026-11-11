import DashboardLayout from '../../components/layout/DashboardLayout';
import { AnnouncementsPanel, Section } from '../portal/shared';
import { PARENT_NAV } from './nav';

export default function ParentAnnouncements() {
  return (<DashboardLayout role="parent" title="Announcements" nav={PARENT_NAV}>
    <Section title="Announcements">
      <AnnouncementsPanel />
    </Section>
  </DashboardLayout>);
}
