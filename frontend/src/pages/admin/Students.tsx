import DashboardLayout from '../../components/layout/DashboardLayout';
import ResourceManager from '../../components/admin/ResourceManager';
import { ADMIN_NAV } from './WebsiteManagement';
import { apiErrorMessage } from '../../services/api';
import { createStudent, fmtDate, listStudents, setStudentStatus, updateStudent } from '../../services/admin';

const STATUS_OPTIONS = ['active', 'inactive', 'transferred', 'withdrawn', 'graduated'].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }));
const GENDER_OPTIONS = [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }];

export default function StudentsPage() {
  return (<DashboardLayout role="admin" title="Student Management" nav={ADMIN_NAV}>
    <ResourceManager
      title="Students"
      description="Enrolled student records (§7). Leave the admission number blank to auto-generate one in the format ADM-<year>-<sequence>. Status changes (withdrawn, graduated…) preserve the record — students are never hard-deleted here."
      load={(p) => listStudents(p)}
      filters={[{ name: 'status', label: 'Status', options: STATUS_OPTIONS }, { name: 'gender', label: 'Gender', options: GENDER_OPTIONS }]}
      columns={[
        { key: 'admissionNumber', label: 'Admission No.' },
        { key: 'name', label: 'Student', render: (r) => `${String(r.firstName ?? '')} ${String(r.lastName ?? '')}` },
        { key: 'gender', label: 'Gender', render: (r) => <span className="capitalize">{String(r.gender)}</span> },
        { key: 'dateOfBirth', label: 'Date of birth', render: (r) => fmtDate(r.dateOfBirth) },
        { key: 'guardianName', label: 'Guardian' },
        { key: 'guardianPhone', label: 'Guardian phone' },
        { key: 'status', label: 'Status', render: (r) => <span className="capitalize">{String(r.status)}</span> },
      ]}
      fields={[
        { name: 'admissionNumber', label: 'Admission number (blank = auto-generate)' },
        { name: 'firstName', label: 'First name', required: true },
        { name: 'lastName', label: 'Last name', required: true },
        { name: 'dateOfBirth', label: 'Date of birth', type: 'date', required: true },
        { name: 'gender', label: 'Gender', type: 'select', options: GENDER_OPTIONS, required: true },
        { name: 'bloodGroup', label: 'Blood group' },
        { name: 'email', label: 'Student email', type: 'email' },
        { name: 'phone', label: 'Student phone' },
        { name: 'address', label: 'Address' },
        { name: 'city', label: 'City' },
        { name: 'guardianName', label: 'Guardian name', required: true },
        { name: 'guardianRelation', label: 'Guardian relation' },
        { name: 'guardianEmail', label: 'Guardian email', type: 'email' },
        { name: 'guardianPhone', label: 'Guardian phone', required: true },
        { name: 'previousSchool', label: 'Previous school' },
        { name: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, onlyOnEdit: true },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      onCreate={async (v) => { await createStudent(v as never); }}
      onUpdate={async (id, v) => { await updateStudent(id, v as never); }}
      rowActions={(row, helpers) => (row.status === 'active' ? (
        <button className="text-amber-700 font-medium" onClick={async () => {
          if (!window.confirm(`Mark ${String(row.firstName)} ${String(row.lastName)} as withdrawn? The record and its history are preserved.`)) return;
          try { await setStudentStatus(String(row._id), 'withdrawn'); helpers.notify('ok', 'Student marked as withdrawn.'); helpers.reload(); }
          catch (e) { helpers.notify('err', `Status change failed: ${apiErrorMessage(e)}`); }
        }}>Withdraw</button>
      ) : null)}
    />
  </DashboardLayout>);
}
