import { useEffect, useState } from 'react';
import { DEMO_CONTENT, DEMO_ITEMS, fetchPublicContent, fetchPublicItems, type PublicItem, type WebsiteContent } from '../services/website';

export type ContentSource = 'live' | 'demo';

/**
 * Loads published CMS content + public items. On ANY failure (API down, database
 * unavailable/503, or nothing published yet) it falls back to clearly demo-marked
 * sample content and reports source='demo' so pages can show the demo badge.
 */
export function usePublicWebsite() {
  const [content, setContent] = useState<WebsiteContent>(DEMO_CONTENT);
  const [items, setItems] = useState<PublicItem[]>(DEMO_ITEMS);
  const [source, setSource] = useState<ContentSource>('demo');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [liveContent, liveItems] = await Promise.all([fetchPublicContent(), fetchPublicItems()]);
        if (cancelled) return;
        if (liveContent) {
          setContent(liveContent);
          setItems(liveItems);
          setSource('live');
        } else {
          // API reachable but nothing published yet: keep demo fallback, still show items if any were published.
          if (liveItems.length > 0) setItems(liveItems);
          setSource('demo');
        }
      } catch {
        if (!cancelled) setSource('demo');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { content, items, source, loading };
}

export function DemoBadge({ source }: { source: ContentSource }) {
  if (source === 'live') return null;
  return <p className="text-xs font-medium text-brand uppercase tracking-wide">Demo content — editable via Website CMS (Admin → Website Management)</p>;
}
