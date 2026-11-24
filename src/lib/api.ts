// Browser client for the LostFound REST API.
// Every call sends the httpOnly session cookie; protected calls that come back
// 401 fire `lf:unauthorized` so the page can sign the user out gracefully.
import { trackRequest } from '@/lib/loading';
import { AppNotification, Boost, Claim, ClaimWithItem, Conversation, Item, ItemDetail, MatchSummary, Message, ProfileData, SavedSearch } from '@/types';
import type { BoostPackage, PlanId, PlanLimits } from '@/lib/plans';

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
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail: { code: json.code } }));
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

  notifications: {
    unread: async (): Promise<number> => (await request('/api/notifications?countOnly=1', { silent: true })).data.unread,
    list: async (): Promise<{ unread: number; notifications: AppNotification[] }> => (await request('/api/notifications', { silent: true })).data,
    markRead: async (ids?: string[]): Promise<void> => {
      await request('/api/notifications', { method: 'PATCH', body: json({ ids }), silent: true });
    },
    prefs: async (): Promise<PrefsData> => (await request('/api/notifications/prefs', { silent: true })).data,
    savePrefs: async (patch: Partial<Omit<AlertPrefs, 'area'>> & { area?: { lat: number; lng: number; label: string } | null }): Promise<AlertPrefs> =>
      (await request('/api/notifications/prefs', { method: 'PUT', body: json(patch), loadingMessage: 'loading.saving' })).data.prefs,
  },

  boosts: {
    forItem: async (itemId: string): Promise<BoostInfo> => (await request(`/api/boosts?itemId=${encodeURIComponent(itemId)}`, { silent: true })).data,
    start: async (itemId: string, pkg: BoostPackage): Promise<{ boost: Boost; needsReview: boolean }> =>
      (await request('/api/boosts', { method: 'POST', body: json({ itemId, package: pkg }), loadingMessage: 'loading.boosting' })).data,
    stop: async (boostId: string): Promise<void> => {
      await request(`/api/boosts/${encodeURIComponent(boostId)}`, { method: 'DELETE', loadingMessage: 'loading.saving' });
    },
  },

  alerts: {
    get: async (): Promise<AlertsData> => (await request('/api/saved-searches', { loadingMessage: 'loading.alerts' })).data,
    create: async (input: SavedSearchInput): Promise<{ search: SavedSearch; existingMatches: number }> =>
      (await request('/api/saved-searches', { method: 'POST', body: json(input), loadingMessage: 'loading.saving' })).data,
    update: async (id: string, patch: Partial<SavedSearchInput> & { active?: boolean }): Promise<SavedSearch> =>
      (await request(`/api/saved-searches/${encodeURIComponent(id)}`, { method: 'PATCH', body: json(patch), loadingMessage: 'loading.saving' })).data.search,
    remove: async (id: string): Promise<void> => {
      await request(`/api/saved-searches/${encodeURIComponent(id)}`, { method: 'DELETE', loadingMessage: 'loading.saving' });
    },
  },

  premium: {
    activate: async (): Promise<void> => {
      await request('/api/premium', { method: 'POST', loadingMessage: 'loading.saving' });
    },
    cancel: async (): Promise<void> => {
      await request('/api/premium', { method: 'DELETE', loadingMessage: 'loading.saving' });
    },
  },
};

export interface AlertPrefs {
  nearbyAlerts: boolean;
  nearbyDailyLimit: 1 | 2;
  area: { lat: number; lng: number; label: string; updatedAt: string } | null;
  matchEmail: boolean;
  matchPush: boolean;
  quietStart: number;
  quietEnd: number;
}

export interface PrefsData {
  prefs: AlertPrefs;
  pushDevices: number;
  pushAvailable: boolean;
  hasEmail: boolean;
}

export interface BoostInfo {
  boosts: Boost[];
  reach: Record<BoostPackage, number>;
  quota: { used: number; limit: number };
  textProblem: { code: string; message: string } | null;
  paymentsEnabled: boolean;
}

export interface SavedSearchInput {
  label: string;
  category: string | null;
  keywords: string;
  location: { lat: number; lng: number; address: string };
  radiusKm: number;
  lostOn: string | null;
}

export interface AlertsData {
  searches: SavedSearch[];
  matches: MatchSummary[];
  plan: PlanId;
  limits: PlanLimits;
  subscription: { id: string; since: string; periodEnd: string | null; source: string } | null;
}

export interface ContactInput {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  consent: boolean;
  website?: string;
}
