// /sitemap.xml for search engines. The human-readable sitemap page lives at /sitemap.
import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/siteConfig';

const PAGES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
  { path: '', changeFrequency: 'hourly', priority: 1 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/sitemap', changeFrequency: 'yearly', priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({
    url: `${siteConfig.url}${p.path}`,
    lastModified: new Date(siteConfig.legalLastUpdated),
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
