import { DemoBadge, usePublicWebsite } from '../../hooks/usePublicWebsite';

export default function About() {
  const { content, source } = usePublicWebsite();
  return (<div className="max-w-5xl mx-auto px-4 py-10">
    <DemoBadge source={source} />
    <h1 className="text-3xl font-bold mt-2 mb-4">About Us — {content.schoolName}</h1>
    <div className="bg-white rounded-xl shadow-sm p-6 text-slate-700 leading-relaxed space-y-3">
      {content.aboutText.split('\n').filter(Boolean).map((para, i) => (<p key={i}>{para}</p>))}
      {content.aboutImageUrl && <img src={content.aboutImageUrl} alt={`${content.schoolName} campus`} className="rounded-lg max-h-80 w-full object-cover" />}
    </div>
    {content.stats.length > 0 && (<div className="grid gap-4 sm:grid-cols-3 mt-6">{content.stats.map((s) => (<div key={s.label} className="bg-white rounded-xl shadow-sm p-5 text-center"><p className="text-2xl font-bold text-navy">{s.value}</p><p className="text-sm text-slate-600 mt-1">{s.label}</p></div>))}</div>)}
  </div>);
}
