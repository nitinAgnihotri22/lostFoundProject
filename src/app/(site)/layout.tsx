// Public website shell: every page except /admin gets the site footer, the
// cookie banner, and (with consent) ads + analytics.
import SiteFooter from '@/components/SiteFooter';
import CookieConsent from '@/components/CookieConsent';
import AdsProvider from '@/components/ads/AdsProvider';
import { getAdsSettings, getSiteConfig } from '@/lib/siteContent';
import type { Metadata } from 'next';

// AdSense site verification: Google looks for this meta tag during review.
export async function generateMetadata(): Promise<Metadata> {
  const { effective } = await getAdsSettings();
  return effective.client ? { other: { 'google-adsense-account': effective.client } } : {};
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [{ config }, ads] = await Promise.all([getSiteConfig(), getAdsSettings()]);
  return (
    <AdsProvider settings={ads.effective}>
      {children}
      <SiteFooter companyName={config.company.legalName} />
      <CookieConsent />
    </AdsProvider>
  );
}
