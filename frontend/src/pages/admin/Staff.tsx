import DashboardLayout from '../../components/layout/DashboardLayout';
import ResourceManager from '../../components/admin/ResourceManager';
import { ADMIN_NAV } from './WebsiteManagement';
import { createStaff, fmtDate, listStaff, updateStaff, userEmail, userName } from '../../services/admin';

const ROLE_OPTIONS = ['principal', 'accountant', 'librarian', 'receptionist', 'admin', 'teacher'].map((r) => ({ value: r, label: r[0].toUpperCase() + r.slice(1) }));
const STATUS_OPTIONS = ['active', 'on-leave', 'suspended', 'terminated', 'retired'].map((s) => ({ value: s, label: s.replace('-', ' ').replace(/^\w/, (c) => c.toUpperCase()) }));

export default function StaffPage() {
  return (<DashboardLayout role="admin" title="Staff Management" nav={ADMIN_NAV}>
    <ResourceManager
      title="Staff"
      description="HR staff profiles (§7/§13): employee ID, department, designation, joining date and employment status. Salary structures and payroll arrive in Phase 7 and are intentionally not shown here."
      load={(p) => listStaff(p)}
      filters={[{ name: 'employmentStatus', label: 'Employment status', options: STATUS_OPTIONS }]}
      columns={[
        { key: 'employeeId', label: 'Employee ID' },
        { key: 'name', label: 'Staff member', render: (r) => userName(r) },
        { key: 'email', label: 'Email', render: (r) => userEmail(r) },
        { key: 'role', label: 'Login role', render: (r) => { const u = (r.user ?? {}) as Record<string, unknown>; return <span className="capitalize">{String(u.role ?? '—')}</span>; } },
        { key: 'department', label: 'Department' },
        { key: 'designation', label: 'Designation' },
        { key: 'joiningDate', label: 'Joined', render: (r) => fmtDate(r.joiningDate) },
        { key: 'employmentStatus', label: 'Status', render: (r) => <span className="capitalize">{String(r.employmentStatus).replace('-', ' ')}</span> },
      ]}
      fields={[
        { name: 'name', label: 'Full name', required: true },
        { name: 'email', label: 'Email (login)', type: 'email', required: true, hideOnEdit: true },
        { name: 'password', label: 'Password (min 8 characters)', type: 'password', required: true, hideOnEdit: true },
        { name: 'role', label: 'Login role', type: 'select', options: ROLE_OPTIONS },
        { name: 'employeeId', label: 'Employee ID (unique)', required: true },
        { name: 'department', label: 'Department', required: true },
        { name: 'designation', label: 'Designation', required: true },
        { name: 'joiningDate', label: 'Joining date', type: 'date' },
        { name: 'employmentStatus', label: 'Employment status', type: 'select', options: STATUS_OPTIONS },
        { name: 'phone', label: 'Phone' },
        { name: 'address', label: 'Address' },
      ]}
      toForm={(r) => ({ name: userName(r), employeeId: String(r.employeeId ?? ''), department: String(r.department ?? ''), designation: String(r.designation ?? ''), joiningDate: r.joiningDate ? String(r.joiningDate).slice(0, 10) : '', employmentStatus: String(r.employmentStatus ?? 'active'), phone: String(r.phone ?? ''), address: String(r.address ?? '') })}
      onCreate={async (v) => { await createStaff(v as never); }}
      onUpdate={async (id, v) => { const body = { ...v }; delete (body as Record<string, unknown>).role; await updateStaff(id, body as never); }}
    />
  </DashboardLayout>);
}
