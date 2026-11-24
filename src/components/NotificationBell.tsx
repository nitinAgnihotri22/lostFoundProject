'use client';
// Bell with unread count + notifications panel (boost alerts, match alerts, boost updates).
// Polls the unread count every minute; opening the panel marks everything read.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Loader2, Rocket, Search, Settings, Sparkles, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { AppNotification } from '@/types';
import { useI18n } from '@/i18n/LanguageProvider';

const ICON: Record<AppNotification['kind'], React.ElementType> = {
  boost_alert: Rocket,
  boost_update: Rocket,
  match: Sparkles,
  match_digest: Search,
};

export default function NotificationBell({ onOpenItem }: { onOpenItem?: (itemId: string) => void }) {
  const { t, lang } = useI18n();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    api.notifications.unread().then(setUnread).catch(() => {});
  }, []);

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, 60_000);
    const onFocus = () => document.visibilityState === 'visible' && refreshCount();
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api.notifications
      .list()
      .then((d) => {
        if (cancelled) return;
        setItems(d.notifications);
        if (d.unread) api.notifications.markRead().then(() => setUnread(0)).catch(() => {});
      })
      .catch(() => !cancelled && setItems([]));
    const onDown = (e: MouseEvent) => rootRef.current && !rootRef.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const when = (iso: string) => {
    const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
    const rtf = new Intl.RelativeTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { numeric: 'auto' });
    if (mins < 60) return rtf.format(-Math.max(0, mins), 'minute');
    if (mins < 1440) return rtf.format(-Math.round(mins / 60), 'hour');
    return rtf.format(-Math.round(mins / 1440), 'day');
  };

  const choose = (n: AppNotification) => {
    setOpen(false);
    if (n.itemId && onOpenItem) onOpenItem(n.itemId);
    else if (n.url) window.location.href = n.url;
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? t('notif.openN', { count: unread }) : t('notif.open')}
        title={t('notif.title')}
        className="relative p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {unread > 0 && (
          <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[0.625rem] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('notif.title')}
          className="fixed sm:absolute inset-x-2 sm:inset-x-auto top-16 sm:top-full sm:right-0 sm:mt-2 sm:w-[380px] max-h-[min(70vh,560px)] flex flex-col bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-black text-gray-900">{t('notif.title')}</h2>
            <div className="flex items-center gap-1">
              <Link href="/alerts" onClick={() => setOpen(false)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-blue-700 hover:bg-blue-50">
                <Settings className="w-3.5 h-3.5" aria-hidden="true" /> {t('notif.settings')}
              </Link>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('notif.close')} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto overscroll-contain">
            {items === null ? (
              <div className="flex justify-center py-10 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : items.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Bell className="w-8 h-8 mx-auto text-gray-300 mb-2" aria-hidden="true" />
                <p className="text-sm font-bold text-gray-800">{t('notif.empty')}</p>
                <p className="text-xs text-gray-500 mt-1">{t('notif.emptyHint')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {items.map((n) => {
                  const Icon = ICON[n.kind] ?? Bell;
                  return (
                    <li key={n.id}>
                      <button type="button" onClick={() => choose(n)} className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 transition ${n.read ? '' : 'bg-blue-50/50'}`}>
                        <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${n.kind === 'match' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                          <Icon className="w-4 h-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-gray-900 line-clamp-2">{n.title}</span>
                          <span className="block text-xs text-gray-600 whitespace-pre-line line-clamp-3 mt-0.5">{n.body}</span>
                          <span className="block text-[0.6875rem] text-gray-400 mt-1">{when(n.createdAt)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
