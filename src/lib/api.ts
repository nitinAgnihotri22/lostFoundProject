// Browser client for the LostFound REST API.
// Every call sends the httpOnly session cookie; protected calls that come back
// 401 fire `lf:unauthorized` so the page can sign the user out gracefully.
import { trackRequest } from '@/lib/loading';
import { Claim, ClaimWithItem, Conversation, Item, ItemDetail, Message, ProfileData } from '@/types';

export const UNAUTHORIZED_EVENT = 'lf:unauthorized';

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public data?: unknown, public field?: string) {
    super(message);
  }
}

type Opts = RequestInit & {
  /** Skip the full-screen loader (used for background polling). */
  silent?: boolean;
  loadingMessage?: string;
};

async function request<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const { silent, loadingMessage, headers, ...init } = opts;
  const run = async () => {
    const res = await fetch(path, {
      credentials: 'include',
      ...init,
      headers: {
        ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(headers || {}),
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      }
      throw new ApiError(json.error || `Request failed (${res.status})`, res.status, json.code, json.data, json.field);
    }
    return json as T;
  };
  return silent ? run() : trackRequest(run, loadingMessage ?? 'loading.default');
}

const json = (body: unknown) => JSON.stringify(body);

export interface CreateItemInput {
  type: 'found' | 'lost';
  title: string;
  description: string;
  category: string;
  images: string[];
  location: { lat: number; lng: number; address: string; city?: string };
  occurredAt: string;
  verificationQuestions?: [string, string, string];
  reward?: number;
  userPhone?: string;
}

export const api = {
  items: {
    /** Active items for the home screen. The caller's own posts are excluded when signed in. */
    list: async (opts: { silent?: boolean } = {}): Promise<Item[]> =>
      (await request('/api/items?excludeMine=1', { silent: opts.silent, loadingMessage: 'loading.items' })).data,
    mine: async (): Promise<Item[]> => (await request('/api/items?mine=1', { loadingMessage: 'loading.myItems' })).data,
    get: async (id: string, silent = true): Promise<ItemDetail> =>
      (await request(`/api/items/${encodeURIComponent(id)}`, { silent, loadingMessage: 'loading.item' })).data,
    create: async (input: CreateItemInput): Promise<Item> =>
      (await request('/api/items', { method: 'POST', body: json(input), loadingMessage: 'loading.posting' })).data,
    setStatus: async (id: string, status: 'resolved' | 'active'): Promise<Item> =>
      (await request(`/api/items/${encodeURIComponent(id)}`, { method: 'PATCH', body: json({ status }), loadingMessage: 'loading.updatingItem' })).data,
    remove: async (id: string): Promise<void> => {
      await request(`/api/items/${encodeURIComponent(id)}`, { method: 'DELETE', loadingMessage: 'loading.deletingItem' });
    },
  },

  uploads: {
    photo: async (file: File): Promise<string> => {
      const form = new FormData();
      form.append('file', file);
      return (await request('/api/uploads', { method: 'POST', body: form, loadingMessage: 'loading.uploading' })).data.url;
    },
  },

  claims: {
    list: async (): Promise<{ mine: ClaimWithItem[]; received: ClaimWithItem[] }> =>
      (await request('/api/claims', { loadingMessage: 'loading.claims' })).data,
    create: async (input: { itemId: string; proof1: string; proof2: string; proof3: string; phone?: string }): Promise<Claim> =>
      (await request('/api/claims', { method: 'POST', body: json(input), loadingMessage: 'loading.submittingClaim' })).data,
    review: async (id: string, status: 'approved' | 'rejected', reason?: string): Promise<{ claim: Claim; autoRejected: number }> => {
      const res = await request(`/api/claims/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: json({ status, reason }),
        loadingMessage: status === 'approved' ? 'loading.approving' : 'loading.rejecting',
      });
      return { claim: res.data, autoRejected: res.autoRejected ?? 0 };
    },
  },

  chat: {
    conversations: async (silent = false): Promise<{ data: Conversation[]; unreadTotal: number }> =>
      request('/api/conversations', { silent, loadingMessage: 'loading.messages' }),
    start: async (input: { itemId: string; recipientId?: string; message?: string }): Promise<Conversation> =>
      (await request('/api/conversations', { method: 'POST', body: json(input), loadingMessage: 'loading.openingChat' })).data,
    messages: async (conversationId: string, after?: string, silent = true): Promise<{ conversation: Conversation; messages: Message[] }> =>
      (await request(`/api/conversations/${encodeURIComponent(conversationId)}/messages${after ? `?after=${encodeURIComponent(after)}` : ''}`, { silent })).data,
    send: async (conversationId: string, body: string): Promise<Message> =>
      (await request(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, { method: 'POST', body: json({ body }), silent: true })).data,
  },

  profile: {
    get: async (silent = false): Promise<ProfileData> =>
      (await request('/api/profile', { silent, loadingMessage: 'loading.profile' })).data,
  },

  contact: {
    /** Contact Us form. `website` is the honeypot field and must stay empty. */
    send: async (input: ContactInput): Promise<{ reference: string }> =>
      (await request('/api/contact', { method: 'POST', body: json(input), loadingMessage: 'loading.sendingMessage' })).data,
  },
};

export interface ContactInput {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  consent: boolean;
  website?: string;
}
