// GET /api/admin/pages – which pages/languages have published custom text (super admin).
import { NextRequest, NextResponse } from 'next/server';
import { adminRouteError, listAdmins, requireAdmin } from '@/lib/admin/server';
import { supabaseAdmin } from '@/lib/db';
import { LANGS } from '@/i18n/config';
import { PAGE_SLUGS, mapPageRow } from '@/lib/siteContent';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'pages.manage');
  if (auth.response) return auth.response;
  try {
    const [{ data, error }, admins] = await Promise.all([
      supabaseAdmin.from('site_pages').select('slug,lang,title,updated_at,updated_by,body'),
      listAdmins(),
    ]);
    if (error) throw error;
    const names = new Map(admins.map((a) => [a.id, a.name]));
    const rows = (data as any[]).map(mapPageRow);
    const pages = PAGE_SLUGS.map((slug) => ({
      slug,
      langs: LANGS.map((lang) => {
        const r = rows.find((x) => x.slug === slug && x.lang === lang);
        return { lang, custom: !!r, updatedAt: r?.updatedAt ?? null, updatedBy: r?.updatedBy ? names.get(r.updatedBy) ?? null : null };
      }),
    }));
    return NextResponse.json({ success: true, data: pages });
  } catch (e) {
    return adminRouteError(e, 'pages GET');
  }
}
