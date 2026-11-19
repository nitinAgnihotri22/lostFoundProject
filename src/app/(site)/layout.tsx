// Public website shell: every page except /admin gets the site footer.
import SiteFooter from '@/components/SiteFooter';
import CookieConsent from '@/components/CookieConsent';
import { getSiteConfig } from '@/lib/siteContent';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { config } = await getSiteConfig();
  return (
    <>
      {children}
      <SiteFooter companyName={config.company.legalName} />
      <CookieConsent />
    </>
  );
}
