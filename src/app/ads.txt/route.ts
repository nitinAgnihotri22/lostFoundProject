// /ads.txt – tells ad buyers which AdSense account may sell ads on this site.
// Built from the publisher id saved in /admin/ads (or NEXT_PUBLIC_ADSENSE_CLIENT).
import { getAdsSettings } from '@/lib/siteContent';
import { publisherId } from '@/lib/monetization';

export async function GET() {
  const { effective } = await getAdsSettings();
  if (!effective.client) return new Response('# No ad sellers configured.\n', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  // f08c47fec0942fa0 is Google's fixed certification authority id.
  return new Response(`google.com, ${publisherId(effective.client)}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
