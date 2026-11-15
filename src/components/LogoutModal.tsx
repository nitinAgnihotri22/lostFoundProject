'use client';
import React, { useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';

interface LogoutModalProps {
  isOpen: boolean;
  userName?: string;
  onCancel: () => void;
  /** Performs the logout; the popup shows a spinner until it resolves. */
  onConfirm: () => Promise<void>;
}

export default function LogoutModal({ isOpen, userName, onCancel, onConfirm }: LogoutModalProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsLoggingOut(true);
    try {
      await onConfirm();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={() => !isLoggingOut && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
          {isLoggingOut ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogOut className="w-6 h-6" />}
        </div>
        <h3 id="logout-title" className="text-lg font-black text-gray-900">
          {isLoggingOut ? 'Logging out…' : 'Log out?'}
        </h3>
        <p className="text-xs text-gray-500 mt-1 mb-5">
          {isLoggingOut
            ? 'Ending your session, please wait.'
            : `${userName ? `${userName}, you` : 'You'}'ll need to sign in again to report items or submit claims.`}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoggingOut}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoggingOut}
            autoFocus
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isLoggingOut && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoggingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </div>
    </div>
  );
}
