// /admin – separate from the public site: no site header/footer, never indexed.
// The admin panel is English-only, whatever language the website is set to.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · LostFound Admin' },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="en" className="flex-1 flex flex-col min-h-screen bg-slate-100">
      {children}
    </div>
  );
}
