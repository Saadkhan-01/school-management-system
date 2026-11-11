import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { listMaterials, refName, type Row } from '../../services/academic';
import { Banner, errText } from '../teacher/shared';
import { LoadingNote, Section } from '../portal/shared';
import { STUDENT_NAV } from './nav';

export default function StudentMaterials() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try { setItems(await listMaterials({ limit: 50 })); }
      catch (e) { setError(errText(e, 'Could not load study materials')); }
      finally { setLoading(false); }
    })();
  }, []);
  return (<DashboardLayout role="student" title="Study Materials" nav={STUDENT_NAV}>
    <div className="space-y-4">
      <Banner banner={error ? { kind: 'err', text: error } : null} />
      <Section title="Materials for my class">
        {loading ? <LoadingNote /> : items.length === 0
          ? <p className="text-sm text-slate-500">No study materials have been shared for your class yet.</p>
          : (<ul className="divide-y text-sm">{items.map((m) => (<li key={m._id} className="py-2 flex justify-between gap-3">
            <span><strong>{String(m.title)}</strong> · {refName(m.subject)}{m.description ? <><br /><span className="text-slate-600">{String(m.description)}</span></> : null}</span>
            <span>{m.fileUrl ? <a className="text-brand hover:underline" href={String(m.fileUrl)} target="_blank" rel="noreferrer">Open file</a> : <span className="text-slate-400">{m.fileName ? String(m.fileName) : 'No file link'}</span>}</span>
          </li>))}</ul>)}
        <p className="text-xs text-slate-500 mt-3">Materials are metadata/file-link records until school file storage is configured (§34).</p>
      </Section>
    </div>
  </DashboardLayout>);
}
