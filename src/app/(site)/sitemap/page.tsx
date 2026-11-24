import type { Metadata } from 'next';
import Link from 'next/link';
import ContentPage from '@/components/ContentPage';
import { getServerT } from '@/i18n/server';
import type { TKey } from '@/i18n/translate';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: t('pages.sitemapTitle'), description: t('pages.sitemapDesc'), alternates: { canonical: '/sitemap' } };
}

// Human-readable sitemap (WCAG 2.4.5 Multiple Ways). The XML version for search engines is /sitemap.xml.
const GROUPS: { title: TKey; links: { href: string; label: TKey; external?: boolean }[] }[] = [
  { title: 'sitemap.main', links: [{ href: '/', label: 'sitemap.home' }] },
  { title: 'sitemap.account', links: [{ href: '/profile', label: 'sitemap.profile' }, { href: '/alerts', label: 'nav.alerts' }] },
  {
    title: 'sitemap.info',
    links: [
      { href: '/about', label: 'pages.aboutTitle' },
      { href: '/contact', label: 'pages.contactTitle' },
    ],
  },
  {
    title: 'sitemap.legal',
    links: [
      { href: '/privacy', label: 'pages.privacyTitle' },
      { href: '/terms', label: 'pages.termsTitle' },
    ],
  },
  {
    title: 'sitemap.developers',
    links: [
      { href: '/docs', label: 'sitemap.apiDocs' },
      { href: '/sitemap.xml', label: 'sitemap.xml', external: true },
    ],
  },
];

export default async function SitemapPage() {
  const { t } = await getServerT();
  return (
    <ContentPage title={t('pages.sitemapTitle')} description={t('pages.sitemapDesc')}>
      <div className="grid gap-6 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.title} aria-labelledby={`sm-${g.title}`} className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 id={`sm-${g.title}`} className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">{t(g.title)}</h2>
            <ul className="space-y-2">
              {g.links.map((l) => (
                <li key={l.href}>
                  {l.external ? (
                    <a href={l.href} className="text-blue-700 font-semibold hover:underline underline-offset-2">{t(l.label)}</a>
                  ) : (
                    <Link href={l.href} className="text-blue-700 font-semibold hover:underline underline-offset-2">{t(l.label)}</Link>
                  )}
                  <span className="ml-2 text-xs text-gray-500 font-mono">{l.href}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </ContentPage>
  );
}
