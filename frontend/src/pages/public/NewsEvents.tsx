import { DemoBadge, usePublicWebsite } from '../../hooks/usePublicWebsite';
import type { PublicItem } from '../../services/website';

function ItemCard({ item }: { item: PublicItem }) {
  const date = item.eventStart ? new Date(item.eventStart).toLocaleDateString() : item.publishAt ? new Date(item.publishAt).toLocaleDateString() : '';
  return (<article className="bg-white rounded-xl shadow-sm p-5">
    <p className="text-xs font-medium text-brand uppercase tracking-wide">{item.type}{item.category ? ` · ${item.category}` : ''}{date ? ` · ${date}` : ''}</p>
    <h2 className="font-semibold mt-1">{item.title}</h2>
    {item.description && <p className="text-sm text-slate-600 mt-1">{item.description}</p>}
    {item.body && <p className="text-sm text-slate-700 mt-2 whitespace-pre-line">{item.body}</p>}
    {item.location && <p className="text-xs text-slate-500 mt-2">Location: {item.location}</p>}
    {item.imageUrl && <img src={item.imageUrl} alt={item.title} className="rounded-lg mt-3 max-h-56 w-full object-cover" />}
  </article>);
}

export default function NewsEvents() {
  const { items, source } = usePublicWebsite();
  const announcements = items.filter((i) => i.type === 'announcement');
  const news = items.filter((i) => i.type === 'news');
  const events = items.filter((i) => i.type === 'event');
  return (<div className="max-w-5xl mx-auto px-4 py-10">
    <DemoBadge source={source} />
    <h1 className="text-3xl font-bold mt-2 mb-4">News and Events</h1>
    <p className="text-slate-600 mb-6">Announcements, holidays, examination dates and parent meetings published by the school office appear here. Role-specific announcements are delivered inside the ERP portals, not on this public page.</p>
    {[{ label: 'Announcements', list: announcements }, { label: 'News', list: news }, { label: 'Events', list: events }].map(({ label, list }) => (
      <section key={label} className="mb-8"><h2 className="font-semibold text-xl mb-3">{label}</h2>
        {list.length > 0 ? (<div className="grid gap-4 md:grid-cols-2">{list.map((i) => (<ItemCard key={i._id} item={i} />))}</div>) : (<p className="text-sm text-slate-500 bg-white rounded-xl shadow-sm p-4">Nothing published in this section yet.</p>)}
      </section>
    ))}
  </div>);
}
