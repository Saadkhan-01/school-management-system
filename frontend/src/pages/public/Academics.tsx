import { DemoBadge, usePublicWebsite } from '../../hooks/usePublicWebsite';

export default function Academics() {
  const { content, source } = usePublicWebsite();
  return (<div className="max-w-5xl mx-auto px-4 py-10">
    <DemoBadge source={source} />
    <h1 className="text-3xl font-bold mt-2 mb-4">Academics</h1>
    <div className="grid gap-4 md:grid-cols-2">
      {content.programs.map((p) => (<div key={p.title} className="bg-white rounded-xl shadow-sm p-6"><h2 className="font-semibold text-lg">{p.title}</h2><p className="text-slate-600 text-sm mt-2 leading-relaxed">{p.description}</p>{p.imageUrl && <img src={p.imageUrl} alt={p.title} className="rounded-lg mt-3 max-h-48 w-full object-cover" />}</div>))}
    </div>
    <div className="bg-white rounded-xl shadow-sm p-6 text-slate-700 leading-relaxed mt-6"><p>Grading scales, examination types and subject assignments are configured in the ERP Academic Management module (Phase 4–5).</p></div>
  </div>);
}
