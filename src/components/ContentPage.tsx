// Shell for the static content pages (server component).
import React from 'react';
import { Info } from 'lucide-react';
import SiteHeader from './SiteHeader';
import { getServerT } from '@/i18n/server';
import { LOCALE_TAG } from '@/i18n/config';
import type { Block, Doc, Section } from '@/content/types';

interface ContentPageProps {
  title: string;
  description?: string;
  /** ISO date shown as "Last updated". */
  lastUpdated?: string;
  /** Sections to list in an "On this page" table of contents. */
  toc?: Section[];
  /** Show the "details are placeholders" banner (mock company data). */
  mockNotice?: boolean;
  children: React.ReactNode;
}

export default async function ContentPage({ title, description, lastUpdated, toc, mockNotice, children }: ContentPageProps) {
  const { lang, t } = await getServerT();
  const updated = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString(LOCALE_TAG[lang], { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="flex-1 flex flex-col">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 focus:outline-none">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">{title}</h1>
          {description && <p className="mt-2 text-base text-gray-600 max-w-2xl">{description}</p>}
          {updated && <p className="mt-2 text-sm text-gray-500">{t('common.lastUpdated', { date: updated })}</p>}
        </header>

        {mockNotice && (
          <p className="mb-8 flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            {t('pages.mockNotice')}
          </p>
        )}

        <div className={toc ? 'lg:grid lg:grid-cols-[14rem_1fr] lg:gap-10' : ''}>
          {toc && (
            <nav aria-labelledby="toc-title" className="mb-8 lg:mb-0">
              <div className="lg:sticky lg:top-24 bg-white border border-gray-200 rounded-2xl p-4">
                <h2 id="toc-title" className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">{t('pages.onThisPage')}</h2>
                <ol className="space-y-1.5">
                  {toc.map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className="text-sm text-gray-700 hover:text-blue-700 hover:underline underline-offset-2">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            </nav>
          )}
          <div className="min-w-0">{children}</div>
        </div>
      </main>
    </div>
  );
}

/** Renders a content block: paragraph, bullet list or definition list. */
export function BlockView({ block }: { block: Block }) {
  if (typeof block === 'string') return <p>{block}</p>;
  if (Array.isArray(block)) {
    return (
      <ul>
        {block.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-x-4 gap-y-1.5 bg-white border border-gray-200 rounded-xl p-4 mb-3 text-[0.9375rem]">
      {block.dl.map(([term, desc]) => (
        <React.Fragment key={term}>
          <dt className="font-semibold text-gray-900">{term}</dt>
          <dd className="text-gray-700 break-words mb-2 sm:mb-0">{desc}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

/** A whole document: intro blocks then each section with its heading anchor. */
export function DocView({ doc }: { doc: Doc }) {
  return (
    <div className="prose-page">
      {doc.intro?.map((b, i) => <BlockView key={i} block={b} />)}
      {doc.sections.map((s) => (
        <section key={s.id} aria-labelledby={s.id}>
          <h2 id={s.id}>{s.title}</h2>
          {s.blocks.map((b, i) => (
            <BlockView key={i} block={b} />
          ))}
        </section>
      ))}
    </div>
  );
}
