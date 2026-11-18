// Company / contact / grievance details used on Contact, Privacy, Terms, About and the footer (super admin).
// GET    /api/admin/settings – current values + built-in defaults.
// PUT    /api/admin/settings { settings } – save (only known text fields are kept).
// DELETE /api/admin/settings – go back to the built-in defaults.
import { NextRequest, NextResponse } from 'next/server';
import { adminFail, adminRouteError, audit, requireAdmin } from '@/lib/admin/server';
import { supabaseAdmin } from '@/lib/db';
import { defaultSettings, invalidateSiteContent, mergeSettings, readSiteConfigFresh } from '@/lib/siteContent';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'pages.manage');
  if (auth.response) return auth.response;
  try {
    const { config, customized, updatedAt } = await readSiteConfigFresh();
    const { name: _n, url: _u, ...settings } = config;
    return NextResponse.json({ success: true, data: { settings, defaults: defaultSettings(), customized, updatedAt: updatedAt ?? null } });
  } catch (e) {
    return adminRouteError(e, 'settings GET');
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req, 'pages.manage');
  if (auth.response) return auth.response;
  try {
    const body = await req.json().catch(() => ({}));
    const s = mergeSettings(defaultSettings(), body.settings);
    for (const [field, value] of [
      ['contact.email', s.contact.email],
      ['grievanceOfficer.email', s.grievanceOfficer.email],
      ['accessibilityContactEmail', s.accessibilityContactEmail],
    ] as const) {
      if (!EMAIL_RE.test(value)) return adminFail(400, `Enter a valid email for ${field}.`, { field });
    }
    if (!s.company.legalName) return adminFail(400, 'Legal name is required.', { field: 'company.legalName' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.legalLastUpdated) || Number.isNaN(Date.parse(s.legalLastUpdated))) {
      return adminFail(400, 'Last updated must be a date (YYYY-MM-DD).', { field: 'legalLastUpdated' });
    }
    const { error } = await supabaseAdmin
      .from('site_settings')
      .upsert({ key: 'site', value: s, updated_by: auth.admin.id, updated_at: new Date().toISOString() });
    if (error) throw error;
    invalidateSiteContent();
    await audit(auth.admin, 'settings.update', { type: 'settings', id: 'site' }, null, req);
    return NextResponse.json({ success: true, data: { settings: s } });
  } catch (e) {
    return adminRouteError(e, 'settings PUT');
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req, 'pages.manage');
  if (auth.response) return auth.response;
  try {
    const { error } = await supabaseAdmin.from('site_settings').delete().eq('key', 'site');
    if (error) throw error;
    invalidateSiteContent();
    await audit(auth.admin, 'settings.reset', { type: 'settings', id: 'site' }, null, req);
    return NextResponse.json({ success: true });
  } catch (e) {
    return adminRouteError(e, 'settings DELETE');
  }
}
