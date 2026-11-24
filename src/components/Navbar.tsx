'use client';

import React from 'react';
import Link from 'next/link';
import { User, ItemType } from '@/types';
import { Plus, Compass, LogOut, MessageCircle } from 'lucide-react';
import { useI18n } from '@/i18n/LanguageProvider';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationBell from './NotificationBell';

interface NavbarProps {
  currentUser: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenReport: (type: ItemType) => void;
  unreadCount?: number;
  onOpenMessages?: () => void;
  /** Rendered next to the logo (the homepage puts its location picker here). */
  locationSlot?: React.ReactNode;
  /** Open an item from a notification without leaving the page. */
  onOpenItem?: (itemId: string) => void;
}

export default function Navbar({
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenReport,
  unreadCount = 0,
  onOpenMessages,
  locationSlot,
  onOpenItem,
}: NavbarProps) {
  const { t } = useI18n();
  const signedIn = !!currentUser;
  return (
    <>
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-xs">
      {/* Row 1: logo, (desktop) location, actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-3 lg:gap-4 min-w-0">
          <Link href="/" aria-label={t('nav.home')} className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Compass className="w-6 h-6 animate-pulse" aria-hidden="true" />
            </div>
            {/* Brand name: hidden on phones to leave room for the buttons */}
            <div className="hidden sm:flex items-center">
              <span className="text-xl font-black tracking-tight text-gray-900">
                Lost<span className="text-blue-600">Found</span>
              </span>
              <span className="hidden xl:inline-block ml-2 text-[0.625rem] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {t('nav.community')}
              </span>
            </div>
          </Link>

          {locationSlot && <div className="hidden lg:block min-w-0 max-w-[280px] pl-4 border-l border-gray-200">{locationSlot}</div>}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* On phones the language switch sits in row 2 (when there is one) */}
          <div className={locationSlot ? 'hidden sm:block' : undefined}>
            <LanguageSwitcher compact />
          </div>

          {/* Report Found Item */}
          <button
            onClick={() => onOpenReport('found')}
            aria-label={t('nav.reportFound')}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow transition"
          >
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="hidden md:inline">{t('nav.reportFound')}</span>
            {/* Phones: short label, or icon only once signed in (more buttons to fit) */}
            <span className={signedIn ? 'hidden sm:inline md:hidden' : 'md:hidden'}>{t('nav.reportFoundShort')}</span>
          </button>

          {/* Notifications (boost alerts, match alerts) */}
          {currentUser && <NotificationBell onOpenItem={onOpenItem} />}

          {/* Messages */}
          {currentUser && onOpenMessages && (
            <button
              onClick={onOpenMessages}
              title={t('nav.messages')}
              aria-label={unreadCount > 0 ? `${t('nav.messages')} (${unreadCount})` : t('nav.messages')}
              className="relative flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap bg-blue-50 hover:bg-blue-100 text-blue-700 transition"
            >
              <MessageCircle className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
              <span className="hidden lg:inline">{t('nav.messages')}</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 sm:static bg-red-500 text-white text-[0.625rem] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
              )}
            </button>
          )}

          {/* User Profile / Auth */}
          <div className="pl-1.5 sm:pl-2 border-l border-gray-200 flex items-center gap-1 sm:gap-2">
            {currentUser ? (
              <>
                <Link href="/profile" title={t('nav.viewProfile')} aria-label={t('nav.viewProfile')} className="flex items-center gap-2 rounded-xl hover:bg-gray-50 p-0.5 lg:pr-1.5 transition">
                  <img
                    src={currentUser.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.name)}`}
                    alt=""
                    className="w-9 h-9 rounded-full border-2 border-blue-600 object-cover shrink-0"
                  />
                  <div className="hidden lg:block text-left">
                    <div className="text-xs font-bold text-gray-800 leading-tight truncate max-w-[120px]">{currentUser.name}</div>
                    <div className="text-[0.6875rem] text-gray-500 truncate max-w-[120px]">{currentUser.email ?? currentUser.phone}</div>
                  </div>
                </Link>
                <button
                  onClick={onLogout}
                  title={t('nav.logOut')}
                  aria-label={t('nav.logOut')}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                </button>
              </>
            ) : (
              <button
                onClick={onOpenAuth}
                className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
              >
                {t('nav.signIn')}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>

      {/* Row 2 (phones and tablets): location picker full width, plus the language switch on phones.
          Not sticky, so it scrolls away and leaves more room for the items. */}
      {locationSlot && (
        <div className="lg:hidden relative z-30 bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">{locationSlot}</div>
            <div className="sm:hidden shrink-0">
              <LanguageSwitcher compact />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
