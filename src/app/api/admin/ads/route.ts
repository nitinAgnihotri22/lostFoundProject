// Ads + analytics settings (super admin).
// GET /api/admin/ads – saved settings, what the site uses (with env fallbacks), and env info.
// PUT /api/admin/ads { settings } – validate and save. Takes effect within a minute on every server.
import { NextRequest, NextResponse } from 'next/server';
import { adminFail, adminRouteError, audit, requireAdmin } from '@/lib/admin/server';
import { supabaseAdmin } from '@/lib/db';
import { adsSettingsProblems, sanitizeAdsSettings } from '@/lib/monetization';
import { invalidateSiteContent, readAdsSettingsFresh } from '@/lib/siteContent';

const envInfo = () => ({
  adsenseClient: process.env.NEXT_PUBLIC_ADSENSE_CLIENT || null,
  gaId: process.env.NEXT_PUBLIC_GA_ID || null,
});

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'ads.manage');
  if (auth.response) return auth.response;
  try {
    const r = await readAdsSettingsFresh();
    return NextResponse.json({ success: true, data: { ...r, env: envInfo() } });
  } catch (e) {
    return adminRouteError(e, 'ads GET');
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req, 'ads.manage');
  if (auth.response) return auth.response;
  try {
    const body = await req.json().catch(() => ({}));
    const problems = adsSettingsProblems(body.settings);
    const [field] = Object.keys(problems);
    if (field) return adminFail(400, problems[field], { field, problems });
    const s = sanitizeAdsSettings(body.settings);
    const before = await readAdsSettingsFresh().catch(() => null);
    const { error } = await supabaseAdmin
      .from('site_settings')
      .upsert({ key: 'ads', value: s, updated_by: auth.admin.id, updated_at: new Date().toISOString() });
    if (error) throw error;
    invalidateSiteContent();
    await audit(
      auth.admin,
      'ads.update',
      { type: 'settings', id: 'ads' },
      { status: s.enabled ? 'ads on' : 'ads off', changed: before ? `${before.saved.enabled ? 'on' : 'off'} → ${s.enabled ? 'on' : 'off'}, holdout ${s.holdoutPercent}%, test ${s.testMode ? 'on' : 'off'}` : undefined },
      req
    );
    const r = await readAdsSettingsFresh();
    return NextResponse.json({ success: true, data: { ...r, env: envInfo() } });
  } catch (e) {
    return adminRouteError(e, 'ads PUT');
  }
}
