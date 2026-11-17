import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getServerT } from '@/i18n/server';
import { LanguageProvider } from '@/i18n/LanguageProvider';
import { siteConfig } from '@/lib/siteConfig';
import { a11yBootScript } from '@/lib/a11ySettings';
import SiteFooter from '@/components/SiteFooter';
import AccessibilityWidget from '@/components/AccessibilityWidget';

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = await getServerT();
  const description =
    lang === 'hi'
      ? 'मिली वस्तुओं को जियोकोड स्थान के साथ दर्ज करें, 5 किमी के दायरे में खोजें, और 3 गुप्त प्रमाणों से दावों की पुष्टि करें।'
      : 'Report found items with geocode locations, search within a 5km radius, and verify claims with 3 secret proofs.';
  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: lang === 'hi' ? 'LostFound | कम्युनिटी खोया-पाया' : 'LostFound | Geocoded Community Lost & Found App',
      template: '%s | LostFound',
    },
    description,
    openGraph: { siteName: siteConfig.name, type: 'website', locale: lang === 'hi' ? 'hi_IN' : 'en_IN', description },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Never block pinch-zoom (WCAG 1.4.4 Resize text).
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, t } = await getServerT();

  return (
    // The boot script may add accessibility classes/font size before React hydrates.
    <html lang={lang} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: a11yBootScript }} />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <a href="#main-content" className="skip-link">
          {t('a11y.skip')}
        </a>
        <LanguageProvider initialLang={lang}>
          {children}
          <SiteFooter />
          <AccessibilityWidget />
        </LanguageProvider>
      </body>
    </html>
  );
}
