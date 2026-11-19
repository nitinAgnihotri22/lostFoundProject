'use client';

import React from 'react';
import Link from 'next/link';
import { User, ItemType } from '@/types';
import { Plus, Compass, LogOut, MessageCircle } from 'lucide-react';
import { useI18n } from '@/i18n/LanguageProvider';
import LanguageSwitcher from './LanguageSwitcher';

interface NavbarProps {
  currentUser: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenReport: (type: ItemType) => void;
  unreadCount?: number;
  onOpenMessages?: () => void;
  /** Rendered next to the logo (the homepage puts its location picker here). */
  locationSlot?: React.ReactNode;
}

export default function Navbar({
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenReport,
  unreadCount = 0,
  onOpenMessages,
  locationSlot,
}: NavbarProps) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo + location */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <Link href="/" aria-label={t('nav.home')} className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Compass className="w-6 h-6 animate-pulse" aria-hidden="true" />
          </div>
          <div className={locationSlot ? 'hidden md:block' : undefined}>
            <span className="text-xl font-black tracking-tight text-gray-900">
              Lost<span className="text-blue-600">Found</span>
            </span>
            <span className="hidden sm:inline-block ml-2 text-[0.625rem] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {t('nav.community')}
            </span>
          </div>
        </Link>

        {locationSlot && <div className="min-w-0 sm:pl-4 sm:border-l sm:border-gray-200">{locationSlot}</div>}
        </div>

        {/* Center / Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block">
            <LanguageSwitcher compact />
          </div>

          {/* Report Found Item Button */}
          <button
            onClick={() => onOpenReport('found')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow transition"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('nav.reportFound')}</span>
            <span className="sm:hidden">{t('nav.reportFoundShort')}</span>
          </button>

          {/* Messages */}
          {currentUser && onOpenMessages && (
            <button
              onClick={onOpenMessages}
              title={t('nav.messages')}
              aria-label={unreadCount > 0 ? `${t('nav.messages')} (${unreadCount})` : t('nav.messages')}
              className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 transition"
            >
              <MessageCircle className="w-4 h-4 text-blue-600" aria-hidden="true" />
              <span className="hidden md:inline">{t('nav.messages')}</span>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[0.625rem] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
              )}
            </button>
          )}

          {/* User Profile / Auth */}
          <div className="pl-2 border-l border-gray-200 flex items-center gap-2">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <Link href="/profile" title={t('nav.viewProfile')} className="flex items-center gap-2 rounded-xl hover:bg-gray-50 p-0.5 pr-1.5 transition">
                <img
                  src={currentUser.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.name)}`}
                  alt=""
                  className="w-9 h-9 rounded-full border-2 border-blue-600 object-cover"
                />
                <div className="hidden md:block text-left">
                  <div className="text-xs font-bold text-gray-800 leading-tight">{currentUser.name}</div>
                  <div className="text-[0.6875rem] text-gray-500 truncate max-w-[120px]">{currentUser.email ?? currentUser.phone}</div>
                </div>
                </Link>
                <button
                  onClick={onLogout}
                  title={t('nav.logOut')}
                  aria-label={t('nav.logOut')}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
              >
                {t('nav.signIn')}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

