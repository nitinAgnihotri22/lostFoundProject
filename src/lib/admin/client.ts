'use client';
// Browser helper for /api/admin/*. Uses the lf_admin cookie only – the
// website's session cookie has no effect on these endpoints.

export class AdminApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public field?: string) {
    super(message);
  }
}

export async function adminApi<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api/admin${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(headers || {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (typeof window !== 'undefined') {
      if (res.status === 401 && body.code === 'ADMIN_UNAUTHENTICATED') {
        window.location.href = `/admin/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      } else if (body.code === 'PASSWORD_CHANGE_REQUIRED' && !window.location.pathname.startsWith('/admin/account')) {
        window.location.href = '/admin/account';
      }
    }
    throw new AdminApiError(body.error || `Request failed (${res.status})`, res.status, body.code, body.field);
  }
  return (body.data ?? body) as T;
}

export const qs = (params: Record<string, string | number | undefined | null | false>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const fmtDate = (iso?: string | null, withTime = true) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    : '—';

export const timeAgo = (iso?: string | null) => {
  if (!iso) return '—';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(iso, false);
};

/** A random password that satisfies the admin rules (10+ chars, letters + numbers). */
export function generatePassword(length = 14): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const all = letters + digits;
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => all[b % all.length]);
  chars[0] = letters[bytes[0] % letters.length];
  chars[1] = digits[bytes[1] % digits.length];
  return chars.join('');
}
