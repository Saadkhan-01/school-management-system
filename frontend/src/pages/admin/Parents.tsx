import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ResourceManager from '../../components/admin/ResourceManager';
import { ADMIN_NAV } from './WebsiteManagement';
import { apiErrorMessage } from '../../services/api';
import {
  createParent, linkParentStudent, listParentLinks, listParents, listStudents, setLinkVerified,
  unlinkParentStudent, updateParent, userEmail, userName, type AnyRow,
} from '../../services/admin';

const inputCls = 'w-full border rounded px-3 py-2 text-sm';

function ParentLinksPanel({ parent }: { parent: AnyRow }) {
  const parentId = String(parent._id);
  const [links, setLinks] = useState<AnyRow[] | null>(null);
  const [students, setStudents] = useState<AnyRow[]>([]);
  const [studentId, setStudentId] = useState('');
  const [relationship, setRelationship] = useState('Guardian');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    try { setLinks(await listParentLinks(parentId)); }
    catch (e) { setMsg({ kind: 'err', text: `Could not load links: ${apiErrorMessage(e)}` }); }
  }, [parentId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    listStudents({ page: 1, limit: 100, filters: { status: 'active' } }).then((out) => setStudents(out.items)).catch(() => setStudents([]));
  }, []);

  const add = async () => {
    if (!studentId) { setMsg({ kind: 'err', text: 'Select a student to link.' }); return; }
    try {
      await linkParentStudent(parentId, { studentId, relationship, verified: true } as never);
      setMsg({ kind: 'ok', text: 'Student linked with a verified link — the parent can now see this child in their portal.' });
      setStudentId(''); await load();
    } catch (e) { setMsg({ kind: 'err', text: `Link failed: ${apiErrorMessage(e)}` }); }
  };

  return (<div className="space-y-4">
    <p className="text-sm text-slate-600">Only <strong>verified</strong> links grant a parent access to a child's records (§4). Links created here are verified by the school.</p>
    {msg && <p className={`rounded p-3 text-sm ${msg.kind === 'ok' ? 'text-green-800 bg-green-50 border border-green-200' : 'text-red-700 bg-red-50 border border-red-200'}`}>{msg.text}</p>}
    {!links ? <p className="text-sm text-slate-500">Loading links…</p> : links.length === 0 ? <p className="text-sm text-slate-500">No children linked yet.</p> : (
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-left border-b"><th className="py-2 pr-3">Student</th><th className="pr-3">Admission No.</th><th className="pr-3">Relationship</th><th className="pr-3">Verified</th><th>Actions</th></tr></thead>
        <tbody>{links.map((l) => {
          const stu = (l.student ?? {}) as AnyRow;
          return (<tr key={String(l._id)} className="border-b last:border-0">
            <td className="py-2 pr-3 font-medium">{String(stu.firstName ?? '')} {String(stu.lastName ?? '')}</td>
            <td className="pr-3">{String(stu.admissionNumber ?? '—')}</td>
            <td className="pr-3">{String(l.relationship ?? '')}</td>
            <td className="pr-3">{l.verified ? <span className="text-green-700 font-medium">Verified</span> : <span className="text-amber-700 font-medium">Unverified</span>}</td>
            <td className="whitespace-nowrap">
              <button className="text-brand font-medium mr-3" onClick={async () => { try { await setLinkVerified(parentId, String(stu._id), !l.verified); await load(); } catch (e) { setMsg({ kind: 'err', text: apiErrorMessage(e) }); } }}>{l.verified ? 'Unverify' : 'Verify'}</button>
              <button className="text-red-600 font-medium" onClick={async () => { if (window.confirm('Remove this parent–student link?')) { try { await unlinkParentStudent(parentId, String(stu._id)); await load(); } catch (e) { setMsg({ kind: 'err', text: apiErrorMessage(e) }); } } }}>Unlink</button>
            </td></tr>);
        })}</tbody></table></div>
    )}
    <div className="grid gap-3 md:grid-cols-3 items-end">
      <div><label className="block text-sm font-medium mb-1">Link a student</label>
        <select className={inputCls} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">— Select active student —</option>
          {students.map((s) => <option key={String(s._id)} value={String(s._id)}>{String(s.admissionNumber)} — {String(s.firstName)} {String(s.lastName)}</option>)}
        </select></div>
      <div><label className="block text-sm font-medium mb-1">Relationship</label>
        <input className={inputCls} value={relationship} onChange={(e) => setRelationship(e.target.value)} /></div>
      <button onClick={() => void add()} className="bg-brand text-white px-4 py-2 rounded text-sm font-medium">Link student (verified)</button>
    </div>
  </div>);
}

export default function ParentsPage() {
  return (<DashboardLayout role="admin" title="Parent Management" nav={ADMIN_NAV}>
    <ResourceManager
      title="Parents"
      description="Parent profiles (§7/§11). Creating a parent also creates their verified login account. Use “Children” on a row to manage verified parent–student links — a parent only ever sees children linked and verified here."
      load={(p) => listParents(p)}
      columns={[
        { key: 'name', label: 'Parent', render: (r) => userName(r) },
        { key: 'email', label: 'Email', render: (r) => userEmail(r) },
        { key: 'phone', label: 'Phone', render: (r) => String(r.phone ?? '—') },
        { key: 'occupation', label: 'Occupation', render: (r) => String(r.occupation ?? '—') },
        { key: 'linkedChildren', label: 'Linked children', render: (r) => `${String(r.verifiedChildren ?? 0)} verified / ${String(r.linkedChildren ?? 0)} total` },
      ]}
      fields={[
        { name: 'name', label: 'Full name', required: true, hideOnEdit: false },
        { name: 'email', label: 'Email (login)', type: 'email', required: true, hideOnEdit: true },
        { name: 'password', label: 'Password (min 8 characters)', type: 'password', required: true, hideOnEdit: true },
        { name: 'phone', label: 'Phone' },
        { name: 'alternatePhone', label: 'Alternate phone' },
        { name: 'address', label: 'Address' },
        { name: 'city', label: 'City' },
        { name: 'occupation', label: 'Occupation' },
        { name: 'relationNote', label: 'Relation note' },
      ]}
      toForm={(r) => ({ name: userName(r), phone: String(r.phone ?? ''), alternatePhone: String(r.alternatePhone ?? ''), address: String(r.address ?? ''), city: String(r.city ?? ''), occupation: String(r.occupation ?? ''), relationNote: String(r.relationNote ?? '') })}
      onCreate={async (v) => { await createParent(v as never); }}
      onUpdate={async (id, v) => { await updateParent(id, v as never); }}
      detailLabel="Children"
      detailPanel={(row) => <ParentLinksPanel parent={row} />}
    />
  </DashboardLayout>);
}
