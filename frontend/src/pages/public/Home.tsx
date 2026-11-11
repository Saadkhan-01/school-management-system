import { Link } from 'react-router-dom';
import { BookOpen, Bus, FlaskConical, Trophy, Users } from 'lucide-react';
import { DemoBadge, usePublicWebsite } from '../../hooks/usePublicWebsite';

export default function Home() {
  const { content, items, source, loading } = usePublicWebsite();
  const newsItems = items.filter((i) => i.type === 'news' || i.type === 'event' || i.type === 'announcement').slice(0, 4);
  return (<div>
    <section className="bg-navy text-white"><div className="max-w-7xl mx-auto px-4 py-16">
      {source === 'demo' && <p className="text-sky-300 text-sm font-medium uppercase tracking-wide">{content.tagline ?? 'Demo homepage — CMS-managed (Phase 2)'}</p>}
      <h1 className="text-4xl md:text-5xl font-bold mt-3 max-w-2xl">{content.hero.title}</h1>
      <p className="mt-4 text-slate-300 max-w-xl">{content.hero.subtitle}</p>
      <div className="mt-6 flex gap-3 flex-wrap">
        <Link to={content.hero.primaryCtaLink ?? '/online-admission'} className="bg-brand px-5 py-2.5 rounded font-medium">{content.hero.primaryCtaLabel ?? 'Apply for Admission'}</Link>
        <Link to={content.hero.secondaryCtaLink ?? '/academics'} className="bg-white/10 px-5 py-2.5 rounded font-medium">{content.hero.secondaryCtaLabel ?? 'Explore Academics'}</Link>
      </div>
      {loading && <p className="mt-3 text-xs text-slate-400">Loading published school content…</p>}
    </div></section>

    {content.stats.length > 0 && (<section className="max-w-7xl mx-auto px-4 pt-10 grid gap-4 sm:grid-cols-3">
      {content.stats.map((s) => (<div key={s.label} className="bg-white rounded-xl shadow-sm p-5 text-center"><p className="text-2xl font-bold text-navy">{s.value}</p><p className="text-sm text-slate-600 mt-1">{s.label}</p></div>))}
    </section>)}

    <section className="max-w-7xl mx-auto px-4 py-12">
      <h2 className="font-semibold text-lg mb-4 flex items-center gap-2"><BookOpen className="text-brand" size={18} /> Academic Programs</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {content.programs.slice(0, 4).map((p) => (<div key={p.title} className="bg-white rounded-xl shadow-sm p-5"><h3 className="font-semibold">{p.title}</h3><p className="text-sm text-slate-600 mt-1">{p.description}</p></div>))}
        {content.programs.length === 0 && (<div className="bg-white rounded-xl shadow-sm p-5"><Users className="text-brand mb-2" /><h3 className="font-semibold">Qualified Faculty</h3><p className="text-sm text-slate-600 mt-1">Programs are published from the Website CMS.</p></div>)}
      </div>
    </section>

    <section className="max-w-7xl mx-auto px-4 pb-12 grid gap-4 md:grid-cols-2">
      <div className="bg-white rounded-xl shadow-sm p-6"><h2 className="font-semibold text-lg mb-2">Principal's Message</h2><p className="text-slate-600 text-sm">{content.principal.message.slice(0, 220)}…</p><p className="text-slate-500 text-sm mt-2">— {content.principal.name}, {content.principal.title}</p><Link className="text-brand text-sm font-medium" to="/principal-message">Read more →</Link></div>
      <div className="bg-white rounded-xl shadow-sm p-6"><h2 className="font-semibold text-lg mb-2 flex items-center gap-2"><Bus className="text-brand" size={18} /> Facilities & Transport</h2>
        {content.facilities.slice(0, 3).map((f) => (<p key={f.name} className="text-slate-600 text-sm mt-1"><span className="font-medium text-slate-800">{f.name}:</span> {f.description}</p>))}
        <Link className="text-brand text-sm font-medium" to="/facilities">See facilities →</Link></div>
    </section>

    {content.facultyHighlights.length > 0 && (<section className="max-w-7xl mx-auto px-4 pb-12"><h2 className="font-semibold text-lg mb-4 flex items-center gap-2"><Users className="text-brand" size={18} /> Faculty Highlights</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{content.facultyHighlights.slice(0, 3).map((f) => (<div key={f.name} className="bg-white rounded-xl shadow-sm p-5"><h3 className="font-semibold">{f.name}</h3><p className="text-xs text-brand font-medium">{f.role}{f.subject ? ` · ${f.subject}` : ''}</p>{f.bio && <p className="text-sm text-slate-600 mt-1">{f.bio}</p>}</div>))}</div></section>)}

    {content.testimonials.length > 0 && (<section className="max-w-7xl mx-auto px-4 pb-12"><h2 className="font-semibold text-lg mb-4 flex items-center gap-2"><Trophy className="text-brand" size={18} /> What People Say</h2><div className="grid gap-4 md:grid-cols-2">{content.testimonials.slice(0, 2).map((t) => (<blockquote key={t.name} className="bg-white rounded-xl shadow-sm p-5 text-slate-700 text-sm">“{t.quote}”<footer className="mt-2 text-slate-500">— {t.name}, {t.role}</footer></blockquote>))}</div></section>)}

    <section className="bg-white border-t"><div className="max-w-7xl mx-auto px-4 py-10"><h2 className="font-semibold text-lg mb-3 flex items-center gap-2"><FlaskConical className="text-brand" size={18} /> News & Events{source === 'demo' ? ' (sample)' : ''}</h2>
      {newsItems.length > 0 ? (<ul className="text-sm text-slate-600 space-y-2">{newsItems.map((n) => (<li key={n._id}>• <span className="font-medium text-slate-800">{n.title}</span>{n.description ? ` — ${n.description}` : ''}</li>))}</ul>) : (<p className="text-sm text-slate-600">No news published yet.</p>)}
      <Link className="text-brand text-sm font-medium" to="/news-events">All news & events →</Link>
      <div className="mt-4"><DemoBadge source={source} /></div>
    </div></section>
  </div>);
}
