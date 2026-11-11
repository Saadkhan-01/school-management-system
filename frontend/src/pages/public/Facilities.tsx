import { DemoBadge, usePublicWebsite } from '../../hooks/usePublicWebsite';

export default function Facilities() {
  const { content, source } = usePublicWebsite();
  return (<div className="max-w-5xl mx-auto px-4 py-10">
    <DemoBadge source={source} />
    <h1 className="text-3xl font-bold mt-2 mb-4">Facilities</h1>
    <div className="grid gap-4 sm:grid-cols-2">
      {content.facilities.map((f) => (<div key={f.name} className="bg-white rounded-xl shadow-sm p-6"><h2 className="font-semibold text-lg">{f.name}</h2><p className="text-slate-600 text-sm mt-2 leading-relaxed">{f.description}</p>{f.imageUrl && <img src={f.imageUrl} alt={f.name} className="rounded-lg mt-3 max-h-48 w-full object-cover" />}</div>))}
    </div>
    <div className="bg-white rounded-xl shadow-sm p-6 text-slate-700 leading-relaxed mt-6"><p>Transport routes are managed in the ERP Transport module; live GPS is not claimed — it will only be added if a real tracking service is configured.</p></div>
  </div>);
}
