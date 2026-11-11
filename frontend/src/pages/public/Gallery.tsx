import { DemoBadge, usePublicWebsite } from '../../hooks/usePublicWebsite';

export default function Gallery() {
  const { items, source } = usePublicWebsite();
  const gallery = items.filter((i) => i.type === 'gallery');
  return (<div className="max-w-5xl mx-auto px-4 py-10">
    <DemoBadge source={source} />
    <h1 className="text-3xl font-bold mt-2 mb-4">Gallery</h1>
    {gallery.length > 0 ? (<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {gallery.map((g) => (<figure key={g._id} className="bg-white rounded-xl shadow-sm overflow-hidden">
        {g.imageUrl ? (<img src={g.imageUrl} alt={g.title} className="h-48 w-full object-cover" />) : (<div className="h-48 w-full bg-slate-100 flex items-center justify-center text-slate-400 text-sm px-4 text-center">No image — published from the CMS once image storage is configured</div>)}
        <figcaption className="p-4"><p className="font-medium">{g.title}</p>{g.description && <p className="text-sm text-slate-600 mt-1">{g.description}</p>}</figcaption>
      </figure>))}
    </div>) : (<div className="bg-white rounded-xl shadow-sm p-6 text-slate-700 leading-relaxed"><p>Gallery images are uploaded and published from Admin → Website Management. No stock photos are presented as real school photos.</p></div>)}
  </div>);
}
