// Transactional email (server only), sent through Resend's HTTP API – no SDK needed.
// -------------------------------------------------------------------
// Env:
//   RESEND_API_KEY  – from https://resend.com (Dashboard → API Keys)
//   EMAIL_FROM      – e.g. "LostFound <no-reply@yourdomain.com>" (domain verified in Resend)
//   EMAIL_REPLY_TO  – optional, e.g. your support address
// Without RESEND_API_KEY nothing is sent; the email is logged and skipped, so
// the feature that triggered it keeps working.
// -------------------------------------------------------------------

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type EmailResult = { sent: true; id?: string } | { sent: false; reason: string };

export const emailConfigured = () => !!process.env.RESEND_API_KEY;

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email] RESEND_API_KEY not set – skipped "${msg.subject}" to ${msg.to}`);
    return { sent: false, reason: 'not_configured' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'LostFound <onboarding@resend.dev>',
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[email] send failed', res.status, body?.message ?? body);
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true, id: body?.id };
  } catch (e) {
    console.error('[email] send error', e);
    return { sent: false, reason: 'network' };
  }
}

/** Escape text for HTML email bodies. */
export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
