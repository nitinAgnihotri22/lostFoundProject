'use client';

import React from 'react';
import Link from 'next/link';
import { User, ItemType } from '@/types';
import { Search, Plus, MapPin, Compass, LogOut, User as UserIcon } from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenReport: (type: ItemType) => void;
}

export default function Navbar({
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenReport,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Compass className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-gray-900">
              Lost<span className="text-blue-600">Found</span>
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              Community GPS
            </span>
          </div>
        </Link>

        {/* Center / Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Report Found Item Button */}
          <button
            onClick={() => onOpenReport('found')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow transition"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Report</span> Found Item
          </button>

          {/* Report Lost Item Button */}
          <button
            onClick={() => onOpenReport('lost')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm hover:shadow transition"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Report</span> Lost Item
          </button>

          {/* User Profile / Auth */}
          <div className="pl-2 border-l border-gray-200 flex items-center gap-2">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <Link href="/profile" title="View your profile" className="flex items-center gap-2 rounded-xl hover:bg-gray-50 p-0.5 pr-1.5 transition">
                <img
                  src={currentUser.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.name)}`}
                  alt={currentUser.name}
                  className="w-9 h-9 rounded-full border-2 border-blue-600 object-cover"
                />
                <div className="hidden md:block text-left">
                  <div className="text-xs font-bold text-gray-800 leading-tight">{currentUser.name}</div>
                  <div className="text-[11px] text-gray-500 truncate max-w-[120px]">{currentUser.email}</div>
                </div>
                </Link>
                <button
                  onClick={onLogout}
                  title="Log out"
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

