'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ClipboardCheck, ExternalLink, FileText, Inbox, LayoutDashboard, LogOut, Menu, Package, ScrollText, ShieldCheck, UserCog, Users, X,
} from 'lucide-react';
import { ADMIN_ROLE_LABEL, AdminProfile, Permission, can } from '@/lib/admin/permissions';
import { cx, ToastProvider } from './ui';

const AdminCtx = createContext<{ admin: AdminProfile; can: (p: Permission) => boolean } | null>(null);
export function useAdmin() {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error('useAdmin must be used inside AdminShell');
  return ctx;
}

const NAV: { href: string; label: string; icon: React.ElementType; perm: Permission | null }[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard.view' },
  { href: '/admin/review', label: 'Review queue', icon: ClipboardCheck, perm: 'posts.review' },
  { href: '/admin/posts', label: 'Posts', icon: Package, perm: 'posts.view' },
  { href: '/admin/users', label: 'Website users', icon: Users, perm: 'users.view' },
  { href: '/admin/messages', label: 'Contact messages', icon: Inbox, perm: 'messages.view' },
  { href: '/admin/pages', label: 'Pages & company', icon: FileText, perm: 'pages.manage' },
  { href: '/admin/admins', label: 'Admin users', icon: ShieldCheck, perm: 'admins.manage' },
  { href: '/admin/audit', label: 'Activity log', icon: ScrollText, perm: 'audit.view' },
  { href: '/admin/account', label: 'My account', icon: UserCog, perm: null },
];

export default function AdminShell({ admin, children }: { admin: AdminProfile; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const allowed = (p: Permission) => can(admin.role, p);

  // An admin whose password was set by someone else must choose their own first.
  useEffect(() => {
    if (admin.mustChangePassword && pathname !== '/admin/account') router.replace('/admin/account');
  }, [admin.mustChangePassword, pathname, router]);

  useEffect(() => setOpen(false), [pathname]);

  // Review-queue badge for checkers / super admins: refresh every minute and after each decision.
  const [pendingReview, setPendingReview] = useState<number | null>(null);
  const canReview = can(admin.role, 'posts.review') && !admin.mustChangePassword;
  useEffect(() => {
    if (!canReview) return;
    const load = () =>
      fetch('/api/admin/posts/review-count', { credentials: 'same-origin', cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j && setPendingReview(j.data.pending))
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener('lf-admin:review-changed', load);
    return () => {
      clearInterval(t);
      window.removeEventListener('lf-admin:review-changed', load);
    };
  }, [canReview, pathname]);

  const signOut = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    window.location.href = '/admin/login';
  };

  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));
  const items = NAV.filter((n) => !n.perm || allowed(n.perm));

  const nav = (
    <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {items.map(({ href, label, icon: Icon }) => {
        const disabled = admin.mustChangePassword && href !== '/admin/account';
        return disabled ? (
          <span key={href} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 cursor-not-allowed" aria-disabled="true">
            <Icon className="w-4 h-4" /> {label}
          </span>
        ) : (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? 'page' : undefined}
            className={cx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium',
              isActive(href) ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
            )}
          >
            <Icon className="w-4 h-4" /> {label}
            {href === '/admin/review' && !!pendingReview && (
              <span className="ml-auto min-w-[1.25rem] rounded-full bg-amber-400 px-1.5 text-center text-xs font-bold text-slate-900" aria-label={`${pendingReview} waiting`}>
                {pendingReview > 99 ? '99+' : pendingReview}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const sidebar = (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-white/10">
        <span className="w-8 h-8 rounded-lg bg-white text-slate-900 flex items-center justify-center">
          <ShieldCheck className="w-4 h-4" />
        </span>
        <span className="font-black">LostFound Admin</span>
      </div>
      {nav}
      <div className="px-3 py-3 border-t border-white/10 space-y-1">
        <a href="/" target="_blank" rel="noopener" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5 hover:text-white">
          <ExternalLink className="w-4 h-4" /> View website
        </a>
        <button type="button" onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5 hover:text-white">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <AdminCtx.Provider value={{ admin, can: allowed }}>
      <ToastProvider>
        <div className="flex-1 flex min-h-screen">
          <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">{sidebar}</aside>

          {open && (
            <div className="lg:hidden fixed inset-0 z-[900] flex">
              <div className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} aria-hidden="true" />
              <div className="relative w-72 max-w-[85vw] h-full">{sidebar}</div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="relative m-3 h-10 w-10 rounded-lg bg-white text-slate-900 flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          <div className="flex-1 min-w-0 flex flex-col">
            <header className="sticky top-0 z-[800] h-16 bg-white border-b border-slate-200 flex items-center justify-between gap-3 px-4 sm:px-6">
              <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="lg:hidden p-2 -ml-2 rounded-lg text-slate-700 hover:bg-slate-100">
                <Menu className="w-5 h-5" />
              </button>
              <div className="hidden lg:block" />
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900 leading-tight">{admin.name}</p>
                  <p className="text-xs text-slate-500">{ADMIN_ROLE_LABEL[admin.role]} · {admin.email}</p>
                </div>
                <span className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-bold" aria-hidden="true">
                  {admin.name.slice(0, 1).toUpperCase()}
                </span>
              </div>
            </header>
            <main id="main-content" tabIndex={-1} className="flex-1 px-4 sm:px-6 py-6 focus:outline-none">
              {children}
            </main>
          </div>
        </div>
      </ToastProvider>
    </AdminCtx.Provider>
  );
}
