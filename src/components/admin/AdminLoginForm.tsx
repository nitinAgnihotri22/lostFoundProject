'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { AdminApiError, adminApi } from '@/lib/admin/client';
import { Button, inputClass } from './ui';

export default function AdminLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your admin email and password.');
      return;
    }
    setBusy(true);
    try {
      await adminApi('/auth/login', { method: 'POST', json: { email: email.trim(), password } });
      const next = new URLSearchParams(window.location.search).get('next');
      // Only ever continue to an admin page (no open redirect).
      window.location.href = next && /^\/admin(\/|$)/.test(next) && !next.startsWith('/admin/login') ? next : '/admin';
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Could not sign in. Please try again.');
      setBusy(false);
    }
  };

  return (
    <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div>
            <p className="text-lg font-black text-slate-900 leading-tight">LostFound Admin</p>
            <p className="text-xs text-slate-500">Staff only</p>
          </div>
        </div>

        <form onSubmit={submit} noValidate className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <h1 className="text-xl font-black text-slate-900">Sign in</h1>
          <p className="text-sm text-slate-600">
            Use your admin account. Website accounts can’t sign in here.
          </p>

          {error && (
            <p role="alert" className="text-sm font-semibold text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="admin-email" className="block text-sm font-semibold text-slate-800 mb-1">Email</label>
            <input id="admin-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label htmlFor="admin-password" className="block text-sm font-semibold text-slate-800 mb-1">Password</label>
            <div className="relative">
              <input
                id="admin-password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-10`}
                required
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
                aria-pressed={show}
                className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-800"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" variant="primary" loading={busy} className="w-full">
            <Lock className="w-4 h-4" /> Sign in
          </Button>
          <p className="text-xs text-slate-500">After 5 wrong passwords the account is locked for 15 minutes.</p>
        </form>
      </div>
    </main>
  );
}
