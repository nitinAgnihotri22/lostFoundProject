// Static page text (super admin)
// GET    /api/admin/pages/{slug}?lang=en|hi – published text (if any) + the built-in default as Markdown.
// PUT    /api/admin/pages/{slug}  { lang, title?, body } – publish (live on the website immediately).
// DELETE /api/admin/pages/{slug}?lang= – remove the custom text; the built-in default shows again.
import { NextRequest, NextResponse } from 'next/server';
import { adminFail, adminRouteError, audit, requireAdmin } from '@/lib/admin/server';
import { supabaseAdmin } from '@/lib/db';
import { isLang } from '@/i18n/config';
import { MARKDOWN_MAX_LENGTH } from '@/lib/markdown';
import { invalidateSiteContent, isPageSlug, mapPageRow, readSiteConfigFresh } from '@/lib/siteContent';
import { defaultPageMarkdown, defaultPageTitle, PAGE_HELP } from '@/lib/admin/pageDefaults';

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(req, 'pages.manage');
  if (auth.response) return auth.response;
  try {
    const { slug } = await params;
    const lang = req.nextUrl.searchParams.get('lang');
    if (!isPageSlug(slug)) return adminFail(404, 'Unknown page.');
    if (!isLang(lang)) return adminFail(400, 'lang must be "en" or "hi".');
    const { data, error } = await supabaseAdmin.from('site_pages').select('*').eq('slug', slug).eq('lang', lang).maybeSingle();
    if (error) throw error;
    const { config } = await readSiteConfigFresh();
    return NextResponse.json({
      success: true,
      data: {
        slug,
        lang,
        custom: data ? mapPageRow(data) : null,
        defaultTitle: defaultPageTitle(slug, lang),
        defaultBody: defaultPageMarkdown(slug, lang, config),
        help: PAGE_HELP[slug],
      },
    });
  } catch (e) {
    return adminRouteError(e, 'pages/[slug] GET');
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(req, 'pages.manage');
  if (auth.response) return auth.response;
  try {
    const { slug } = await params;
    if (!isPageSlug(slug)) return adminFail(404, 'Unknown page.');
    const body = await req.json().catch(() => ({}));
    if (!isLang(body.lang)) return adminFail(400, 'lang must be "en" or "hi".');
    const text = typeof body.body === 'string' ? body.body.replace(/\r\n?/g, '\n').trim() : '';
    if (text.length < 20) return adminFail(400, 'Page text is too short (at least 20 characters).', { field: 'body' });
    if (text.length > MARKDOWN_MAX_LENGTH) return adminFail(400, `Page text is too long (max ${MARKDOWN_MAX_LENGTH.toLocaleString('en-IN')} characters).`, { field: 'body' });
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) || null : null;

    const { data, error } = await supabaseAdmin
      .from('site_pages')
      .upsert({ slug, lang: body.lang, title, body: text, updated_by: auth.admin.id, updated_at: new Date().toISOString() })
      .select('*')
      .single();
    if (error) throw error;
    invalidateSiteContent();
    await audit(auth.admin, 'page.publish', { type: 'page', id: `${slug}:${body.lang}` }, { length: text.length, title }, req);
    return NextResponse.json({ success: true, data: mapPageRow(data) });
  } catch (e) {
    return adminRouteError(e, 'pages/[slug] PUT');
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(req, 'pages.manage');
  if (auth.response) return auth.response;
  try {
    const { slug } = await params;
    const lang = req.nextUrl.searchParams.get('lang');
    if (!isPageSlug(slug)) return adminFail(404, 'Unknown page.');
    if (!isLang(lang)) return adminFail(400, 'lang must be "en" or "hi".');
    const { error } = await supabaseAdmin.from('site_pages').delete().eq('slug', slug).eq('lang', lang);
    if (error) throw error;
    invalidateSiteContent();
    await audit(auth.admin, 'page.revert', { type: 'page', id: `${slug}:${lang}` }, null, req);
    return NextResponse.json({ success: true });
  } catch (e) {
    return adminRouteError(e, 'pages/[slug] DELETE');
  }
}
