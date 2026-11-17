import type { Metadata } from 'next';
import Link from 'next/link';
import { HeartHandshake, Lock, ShieldCheck, Users, Accessibility } from 'lucide-react';
import ContentPage, { DocView } from '@/components/ContentPage';
import { getServerT } from '@/i18n/server';
import { aboutContent } from '@/content/about';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: t('pages.aboutTitle'), description: t('pages.aboutDesc'), alternates: { canonical: '/about' } };
}

const VALUE_ICONS = [Lock, ShieldCheck, Users, Accessibility];

export default async function AboutPage() {
  const { lang, t } = await getServerT();
  const a = aboutContent(lang);
  return (
    <ContentPage title={t('pages.aboutTitle')} mockNotice>
      <p className="text-lg text-gray-700 leading-relaxed max-w-3xl">{a.lead}</p>

      <section aria-labelledby="how-it-works" className="mt-10">
        <h2 id="how-it-works" className="text-xl font-black text-gray-900 mb-4">{a.stepsTitle}</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {a.steps.map((s) => (
            <li key={s.title} className="bg-white border border-gray-200 rounded-2xl p-5">
              <h3 className="font-bold text-gray-900">{s.title}</h3>
              <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="values" className="mt-10">
        <h2 id="values" className="text-xl font-black text-gray-900 mb-4">{a.valuesTitle}</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {a.values.map((v, i) => {
            const Icon = VALUE_ICONS[i] ?? HeartHandshake;
            return (
              <li key={v.title} className="flex gap-3 bg-white border border-gray-200 rounded-2xl p-5">
                <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-gray-900">{v.title}</h3>
                  <p className="mt-1 text-sm text-gray-600 leading-relaxed">{v.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-6">
        <DocView doc={a.story} />
      </div>

      <section aria-labelledby="cta" className="mt-10 bg-blue-700 text-white rounded-3xl p-6 sm:p-8">
        <h2 id="cta" className="text-xl font-black">{a.ctaTitle}</h2>
        <p className="mt-1.5 text-blue-50 max-w-2xl">{a.ctaBody}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/contact" className="px-5 py-2.5 rounded-xl bg-white text-blue-800 font-bold text-sm hover:bg-blue-50">{a.ctaContact}</Link>
          <Link href="/" className="px-5 py-2.5 rounded-xl border border-white/70 text-white font-bold text-sm hover:bg-white/10">{a.ctaBrowse}</Link>
        </div>
      </section>
    </ContentPage>
  );
}
