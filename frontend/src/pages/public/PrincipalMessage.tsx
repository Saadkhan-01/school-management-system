import { DemoBadge, usePublicWebsite } from '../../hooks/usePublicWebsite';

export default function PrincipalMessage() {
  const { content, source } = usePublicWebsite();
  return (<div className="max-w-5xl mx-auto px-4 py-10">
    <DemoBadge source={source} />
    <h1 className="text-3xl font-bold mt-2 mb-4">Principal's Message</h1>
    <div className="bg-white rounded-xl shadow-sm p-6 text-slate-700 leading-relaxed space-y-3">
      {content.principal.photoUrl && <img src={content.principal.photoUrl} alt={content.principal.name} className="rounded-lg h-48 w-40 object-cover float-right ml-4 mb-2" />}
      {content.principal.message.split('\n').filter(Boolean).map((para, i) => (<p key={i}>{para}</p>))}
      <p className="font-medium text-slate-900">— {content.principal.name}, {content.principal.title}</p>
    </div>
  </div>);
}
