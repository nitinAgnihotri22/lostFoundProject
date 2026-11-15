'use client';
import { useSyncExternalStore } from 'react';
import { Loader2 } from 'lucide-react';
import { getLoadingMessage, getServerLoadingMessage, subscribeLoading } from '@/lib/loading';

/** Full-screen overlay shown while any tracked API request is in flight. */
export default function GlobalLoader() {
  const message = useSyncExternalStore(subscribeLoading, getLoadingMessage, getServerLoadingMessage);
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-fade-in"
    >
      <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-2xl border border-gray-100">
        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
        <span className="text-sm font-semibold text-gray-800">{message}</span>
      </div>
    </div>
  );
}
