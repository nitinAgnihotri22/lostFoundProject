import type { Metadata } from 'next';
import ContentPage, { DocView } from '@/components/ContentPage';
import { getServerT } from '@/i18n/server';
import { privacyPolicy } from '@/content/privacy';
import { siteConfig } from '@/lib/siteConfig';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: t('pages.privacyTitle'), description: t('pages.privacyDesc'), alternates: { canonical: '/privacy' } };
}

export default async function PrivacyPage() {
  const { lang, t } = await getServerT();
  const doc = privacyPolicy(lang);
  return (
    <ContentPage title={t('pages.privacyTitle')} description={t('pages.privacyDesc')} lastUpdated={siteConfig.legalLastUpdated} toc={doc.sections} mockNotice>
      <DocView doc={doc} />
    </ContentPage>
  );
}
