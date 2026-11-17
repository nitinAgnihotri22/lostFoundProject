'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, MessageCircle, Send, X } from 'lucide-react';
import { Conversation, Message, User } from '@/types';
import { api, ApiError } from '@/lib/api';
import { useI18n } from '@/i18n/LanguageProvider';
import { LOCALE_TAG } from '@/i18n/config';
import type { TKey } from '@/i18n/translate';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  /** Open straight into this conversation (e.g. after "Message poster"). */
  initialConversationId?: string | null;
  onUnreadChange?: (unreadTotal: number) => void;
  onOpenItem?: (itemId: string) => void;
}

const POLL_LIST_MS = 10_000;
const POLL_THREAD_MS = 4_000;

const avatarFor = (name: string, avatar?: string) =>
  avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;

const timeLabel = (iso: string | undefined, locale: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
};

const STATUS_LABEL: Record<string, TKey> = {
  active: 'common.statusActive',
  claimed: 'common.statusClaimed',
  resolved: 'common.statusResolved',
};

const ITEM_STATUS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  claimed: 'bg-blue-100 text-blue-800',
  resolved: 'bg-gray-200 text-gray-700',
};

export default function ChatPanel({ isOpen, onClose, currentUser, initialConversationId, onUnreadChange, onOpenItem }: ChatPanelProps) {
  const { t, lang } = useI18n();
  const locale = LOCALE_TAG[lang];
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAtRef = useRef<string | undefined>(undefined);

  // Jump to the requested conversation whenever the panel opens.
  useEffect(() => {
    if (isOpen) setActiveId(initialConversationId ?? null);
  }, [isOpen, initialConversationId]);

  const loadList = useCallback(async () => {
    try {
      const res = await api.chat.conversations(true);
      setConversations(res.data);
      onUnreadChange?.(res.unreadTotal);
      setError(null);
    } catch (e) {
      setError(
        e instanceof ApiError && (e.status === 503 || e.status === 500)
          ? 'chat.unavailable'
          : (e as Error).message
      );
    }
  }, [onUnreadChange]);

  // Conversation list: load on open, then poll.
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    let active = true;
    setLoadingList(true);
    loadList().finally(() => active && setLoadingList(false));
    const timer = setInterval(loadList, POLL_LIST_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isOpen, currentUser, loadList]);

  // Active thread: load, then poll for messages newer than the last one we have.
  useEffect(() => {
    if (!isOpen || !activeId) {
      setMessages([]);
      lastAtRef.current = undefined;
      return;
    }
    let active = true;
    setLoadingThread(true);
    const fetchMessages = async (initial: boolean) => {
      try {
        const res = await api.chat.messages(activeId, initial ? undefined : lastAtRef.current, true);
        if (!active) return;
        setMessages((prev) => {
          if (initial) return res.messages;
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...res.messages.filter((m) => !seen.has(m.id))];
        });
        if (res.messages.length) lastAtRef.current = res.messages[res.messages.length - 1].createdAt;
        setConversations((prev) => {
          const exists = prev.some((c) => c.id === activeId);
          const updated = prev.map((c) => (c.id === activeId ? { ...c, unreadCount: 0 } : c));
          return exists ? updated : [res.conversation, ...updated];
        });
        setError(null);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active && initial) setLoadingThread(false);
      }
    };
    fetchMessages(true);
    const timer = setInterval(() => fetchMessages(false), POLL_THREAD_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isOpen, activeId]);

  // Keep the navbar badge in sync with what the panel knows.
  useEffect(() => {
    if (isOpen) onUnreadChange?.(conversations.reduce((n, c) => n + c.unreadCount, 0));
  }, [conversations, isOpen, onUnreadChange]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, activeId]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    try {
      const m = await api.chat.send(activeId, text);
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      lastAtRef.current = m.createdAt;
      setDraft('');
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId ? { ...c, lastMessageAt: m.createdAt, lastMessagePreview: m.body, lastSenderId: m.senderId } : c
        )
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : t('chat.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  if (!isOpen || !currentUser) return null;

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-title"
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-full md:w-[780px] bg-white shadow-2xl flex flex-col"
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 sm:px-5 h-14 border-b border-gray-100 bg-gray-50/70 shrink-0">
          <h2 id="chat-title" className="flex items-center gap-2 font-black text-gray-900">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            {t('chat.title')}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition" aria-label={t('chat.close')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div role="alert" className="px-4 py-2 bg-red-50 border-b border-red-100 text-xs font-semibold text-red-800">
            {error === 'chat.unavailable' ? t('chat.unavailable') : error}
          </div>
        )}

        <div className="flex-1 min-h-0 flex">
          {/* Conversation list */}
          <aside className={`${activeId ? 'hidden md:flex' : 'flex'} w-full md:w-72 md:border-r border-gray-100 flex-col min-h-0`}>
            {loadingList && conversations.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-gray-500">
                <MessageCircle className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-sm font-bold text-gray-700">{t('chat.none')}</p>
                <p className="text-xs mt-1">{t('chat.noneHint')}</p>
              </div>
            ) : (
              <ul className="flex-1 overflow-y-auto divide-y divide-gray-100">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setActiveId(c.id)}
                      aria-current={c.id === activeId ? 'true' : undefined}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-blue-50/60 transition ${
                        c.id === activeId ? 'bg-blue-50' : ''
                      }`}
                    >
                      <img src={avatarFor(c.participant.name, c.participant.avatar)} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 border border-gray-200" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-gray-900 truncate">{c.participant.name}</span>
                          <span className="text-[0.6875rem] text-gray-400 shrink-0">{timeLabel(c.lastMessageAt ?? c.createdAt, locale)}</span>
                        </div>
                        <div className="text-[0.6875rem] text-blue-700 font-semibold truncate">{c.item?.title ?? t('chat.itemRemoved')}</div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <span className={`text-xs truncate ${c.unreadCount ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                            {c.lastSenderId === currentUser.id ? t('chat.you') : ''}
                            {c.lastMessagePreview ?? t('chat.sayHello')}
                          </span>
                          {c.unreadCount > 0 && (
                            <span aria-label={t('chat.unreadN', { count: c.unreadCount })} className="shrink-0 bg-blue-600 text-white text-[0.625rem] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {/* Thread */}
          <section className={`${activeId ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 min-h-0`}>
            {!activeId ? (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-500">{t('chat.select')}</div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
                  <button onClick={() => setActiveId(null)} className="md:hidden p-1.5 -ml-1 text-gray-500 hover:bg-gray-100 rounded-full" aria-label={t('chat.backToList')}>
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  {active && (
                    <>
                      <img src={avatarFor(active.participant.name, active.participant.avatar)} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-200" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-900 truncate">{active.participant.name}</div>
                        {active.item && (
                          <button
                            onClick={() => onOpenItem?.(active.item!.id)}
                            className="text-[0.6875rem] text-blue-700 font-semibold hover:underline truncate max-w-full flex items-center gap-1.5"
                          >
                            <span className="truncate">
                              {active.item.type === 'found' ? t('chat.foundLabel', { title: active.item.title }) : t('chat.lostLabel', { title: active.item.title })}
                            </span>
                            <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[0.625rem] font-bold uppercase ${ITEM_STATUS[active.item.status]}`}>
                              {STATUS_LABEL[active.item.status] ? t(STATUS_LABEL[active.item.status]) : active.item.status}
                            </span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-slate-50/60" role="log" aria-live="polite">
                  {loadingThread ? (
                    <div className="h-full flex items-center justify-center text-gray-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-xs text-gray-500 mt-8">
                      {t('chat.empty')}
                    </p>
                  ) : (
                    messages.map((m) => {
                      const mine = m.senderId === currentUser.id;
                      return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words shadow-xs ${
                              mine ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
                            }`}
                          >
                            {m.body}
                            <div className={`text-[0.625rem] mt-1 ${mine ? 'text-blue-100' : 'text-gray-400'}`}>
                              {timeLabel(m.createdAt, locale)}
                              {mine && m.readAt ? t('chat.read') : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send();
                  }}
                  className="p-3 border-t border-gray-100 flex items-end gap-2 shrink-0"
                >
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={1}
                    maxLength={2000}
                    placeholder={t('chat.placeholder')}
                    aria-label={t('chat.messageLabel')}
                    className="flex-1 resize-none text-sm border border-gray-300 rounded-xl px-3 py-2 max-h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || sending}
                    className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
                    aria-label={t('common.send')}
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
