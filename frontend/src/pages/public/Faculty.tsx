import { DemoBadge, usePublicWebsite } from '../../hooks/usePublicWebsite';

export default function Faculty() {
  const { content, source } = usePublicWebsite();
  return (<div className="max-w-5xl mx-auto px-4 py-10">
    <DemoBadge source={source} />
    <h1 className="text-3xl font-bold mt-2 mb-4">Faculty</h1>
    {content.facultyHighlights.length > 0 ? (<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {content.facultyHighlights.map((f) => (<div key={f.name} className="bg-white rounded-xl shadow-sm p-5">
        {f.photoUrl && <img src={f.photoUrl} alt={f.name} className="rounded-lg h-40 w-full object-cover mb-3" />}
        <h2 className="font-semibold">{f.name}</h2>
        <p className="text-xs text-brand font-medium">{f.role}{f.subject ? ` · ${f.subject}` : ''}</p>
        {f.bio && <p className="text-sm text-slate-600 mt-2">{f.bio}</p>}
      </div>))}
    </div>) : (<div className="bg-white rounded-xl shadow-sm p-6 text-slate-700 leading-relaxed"><p>Faculty highlights are published from teacher profiles managed in the ERP (Teacher Management + Website CMS).</p></div>)}
  </div>);
}
