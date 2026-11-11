import DashboardLayout from '../../components/layout/DashboardLayout';
import { AnnouncementsPanel, Section } from '../portal/shared';
import { STUDENT_NAV } from './nav';

export default function StudentAnnouncements() {
  return (<DashboardLayout role="student" title="Announcements" nav={STUDENT_NAV}>
    <Section title="Announcements">
      <AnnouncementsPanel />
    </Section>
  </DashboardLayout>);
}
