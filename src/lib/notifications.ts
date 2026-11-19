// Emails to website users about their posts (server only).
// We don't store a language per user, so each email has English then Hindi.
import { supabaseAdmin } from '@/lib/db';
import { escapeHtml, sendEmail } from '@/lib/email';
import { siteConfig } from '@/lib/siteConfig';

interface ReviewedPost {
  id: string;
  title: string;
  type: 'found' | 'lost';
  userName: string;
  email: string;
}

function reviewEmail(p: ReviewedPost, decision: 'approve' | 'reject', reason: string | null) {
  const profileUrl = `${siteConfig.url}/profile`;
  const approved = decision === 'approve';
  const t = escapeHtml(p.title);
  const n = escapeHtml(p.userName || 'there');
  const r = reason ? escapeHtml(reason) : '';

  const subject = approved
    ? `Your post is live: ${p.title} | आपकी पोस्ट लाइव है`
    : `Your post was not approved: ${p.title} | आपकी पोस्ट स्वीकृत नहीं हुई`;

  const en = approved
    ? `<p>Hi ${n},</p><p>Good news – your ${p.type} item post <strong>“${t}”</strong> has been approved and is now visible to people nearby on ${siteConfig.name}.</p><p>We’ll let you know on the site when someone claims it or sends you a message.</p>`
    : `<p>Hi ${n},</p><p>Your ${p.type} item post <strong>“${t}”</strong> was reviewed and <strong>not approved</strong>, so it isn’t visible to others.</p><p><strong>Reason:</strong> ${r || '—'}</p><p>You can delete it from your profile and post again with the details corrected.</p>`;
  const hi = approved
    ? `<p>नमस्ते ${n},</p><p>आपकी पोस्ट <strong>“${t}”</strong> स्वीकृत हो गई है और अब ${siteConfig.name} पर आस-पास के लोगों को दिख रही है।</p>`
    : `<p>नमस्ते ${n},</p><p>आपकी पोस्ट <strong>“${t}”</strong> की समीक्षा हुई और यह <strong>स्वीकृत नहीं हुई</strong>, इसलिए यह दूसरों को नहीं दिखती।</p><p><strong>कारण:</strong> ${r || '—'}</p><p>आप इसे अपनी प्रोफ़ाइल से हटाकर सही जानकारी के साथ फिर से पोस्ट कर सकते हैं।</p>`;

  const button = `<p style="margin:24px 0"><a href="${profileUrl}" style="background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">View my posts / मेरी पोस्ट देखें</a></p>`;
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.6;max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:20px;margin:0 0 16px">${siteConfig.name}</h1>
${en}${button}
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
<div lang="hi">${hi}</div>
<p style="font-size:12px;color:#64748b;margin-top:32px">You received this because you posted on ${siteConfig.name}. · यह ईमेल आपको इसलिए मिला क्योंकि आपने ${siteConfig.name} पर पोस्ट किया।</p>
</body></html>`;

  const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const text = [
    strip(en.replace(/<\/p>/g, '\n\n')),
    `View my posts: ${profileUrl}`,
    '—',
    strip(hi.replace(/<\/p>/g, '\n\n')),
  ].join('\n');

  return { subject, html, text };
}

/**
 * Email each poster about the review decision. Posts whose poster has no email
 * (phone-only accounts) are skipped. Never throws.
 */
export async function notifyPostsReviewed(ids: string[], decision: 'approve' | 'reject', reason: string | null): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;
  try {
    const { data: items, error } = await supabaseAdmin.from('items').select('id,title,type,user_id,user_name,user_email').in('id', ids);
    if (error) throw error;
    const userIds = Array.from(new Set((items as any[]).map((i) => String(i.user_id)).filter(Boolean)));
    const { data: users } = userIds.length
      ? await supabaseAdmin.from('users').select('id,name,email').in('id', userIds)
      : { data: [] as any[] };
    const byId = new Map(((users ?? []) as any[]).map((u) => [String(u.id), u]));

    for (const i of items as any[]) {
      const u = byId.get(String(i.user_id));
      // Prefer the account's current email; fall back to the one stored on the post.
      const email = (u?.email || i.user_email || '').trim();
      if (!email) {
        skipped++;
        continue;
      }
      const msg = reviewEmail({ id: i.id, title: i.title, type: i.type, userName: u?.name || i.user_name, email }, decision, reason);
      const res = await sendEmail({ to: email, ...msg });
      if (res.sent) sent++;
      else skipped++;
    }
  } catch (e) {
    console.error('[notify review]', e);
  }
  return { sent, skipped };
}
