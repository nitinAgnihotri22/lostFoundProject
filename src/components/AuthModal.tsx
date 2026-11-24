'use client';
import React, { useState } from 'react';
import { User } from '@/types';
import { setStoredUser } from '@/lib/itemService';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { AuthError, loginWithEmail, registerWithEmail } from '@/lib/authClient';
import { trackRequest } from '@/lib/loading';
import { X } from 'lucide-react';
import PhoneAuth from './PhoneAuth';
import { useI18n } from '@/i18n/LanguageProvider';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  promptMessage?: string | null;
}

type AuthMethod = 'email' | 'phone';

export default function AuthModal({
  isOpen,
  onClose,
  onLoginSuccess,
  promptMessage,
}: AuthModalProps) {
  const { t } = useI18n();
  const [method, setMethod] = useState<AuthMethod>('email');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Email form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const finish = (user: User) => {
    setStoredUser(user);
    onLoginSuccess(user);
    onClose();
  };

  // 1. Google – redirects to Google. On return, the callback handler in
  //    page.tsx calls /api/auth/login (or /api/auth/register for new users).
  const handleGoogleLogin = async () => {
    setError(null);
    const { error } = await trackRequest(
      supabaseBrowser.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
      }),
      'loading.redirectGoogle'
    );
    if (error) {
      console.error('Google login error:', error);
      setError(t('errors.googleFailed'));
    }
  };

  // 2. Email & Password – /api/auth/login or /api/auth/register
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError(t('auth.fillEmail'));
      return;
    }
    setIsSubmitting(true);
    try {
      const user = isRegister
        ? await registerWithEmail({ name: name.trim(), email: email.trim(), password })
        : await loginWithEmail(email.trim(), password);
      finish(user);
    } catch (err) {
      if (err instanceof AuthError && err.code === 'USER_NOT_FOUND') {
        setIsRegister(true);
        setError(t('auth.noAccountFound'));
      } else if (err instanceof AuthError && err.code === 'USE_PHONE') {
        setMethod('phone');
        setError(t('auth.usePhone'));
      } else if (err instanceof AuthError && err.code === 'ACCOUNT_DISABLED') {
        setError(t('errors.accountDisabled'));
      } else if (err instanceof AuthError && err.code === 'USER_EXISTS') {
        setIsRegister(false);
        setError(t('auth.exists'));
      } else {
        setError(err instanceof Error ? err.message : t('common.somethingWrong'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Main Auth Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
        <div role="dialog" aria-modal="true" aria-labelledby="auth-title" className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-y-auto overscroll-contain border border-gray-100 p-5 sm:p-8 my-auto max-h-[92vh] supports-[height:100dvh]:max-h-[92dvh] flex flex-col">
          <button onClick={onClose} aria-label={t('auth.close')} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
          <div className="text-center mb-5">
            <div aria-hidden="true" className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm font-black text-xl">LF</div>
            <h2 id="auth-title" className="text-2xl font-black text-gray-900">
              {isRegister ? t('auth.join') : t('auth.logInTitle')}
            </h2>
            {promptMessage ? (
              <div role="status" className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold">
                🔒 {promptMessage}
              </div>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                {t('auth.intro')}
              </p>
            )}
          </div>
          {error && (
            <div role="alert" className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold">
              {error}
            </div>
          )}
          {/* Google button */}
          <div className="mb-4">
            <button type="button" onClick={handleGoogleLogin} className="w-full py-2.5 px-4 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-3">
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z" />
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
              </svg>
              <span>{t('auth.google')}</span>
            </button>
          </div>
          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-gray-200 w-full"></div>
            <span className="bg-white px-3 text-[0.6875rem] font-semibold text-gray-400 uppercase tracking-wider">{t('auth.or')}</span>
            <div className="border-t border-gray-200 w-full"></div>
          </div>
          {/* Method tabs */}
          <div className="flex p-1 bg-gray-100 rounded-xl mb-4" role="group">
            <button type="button" aria-pressed={method === 'email'} onClick={() => setMethod('email')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${method === 'email' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}>
              {t('auth.email')}
            </button>
            <button type="button" aria-pressed={method === 'phone'} onClick={() => setMethod('phone')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${method === 'phone' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}>
              {t('auth.phone')}
            </button>
          </div>
          {/* Forms (simplified) */}
          {method === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {isRegister && (
                <input type="text" autoComplete="name" placeholder={t('auth.name')} aria-label={t('auth.name')} value={name} onChange={e => setName(e.target.value)} className="w-full border rounded px-3 py-2" required />
              )}
              <input type="email" autoComplete="email" placeholder={t('auth.email')} aria-label={t('auth.email')} value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded px-3 py-2" required />
              <input type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder={t('auth.password')} aria-label={t('auth.password')} minLength={isRegister ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded px-3 py-2" required />
              <button type="submit" disabled={isSubmitting} className="w-full py-2 bg-blue-600 text-white rounded disabled:opacity-60">
                {isSubmitting ? t('common.pleaseWait') : isRegister ? t('auth.signUp') : t('auth.logIn')}
              </button>
              <p className="text-center text-xs text-gray-500">
                {isRegister ? t('auth.haveAccount') : t('auth.noAccount')}{' '}
                <button type="button" onClick={() => { setIsRegister(!isRegister); setError(null); }} className="font-bold text-blue-600 hover:underline">
                  {isRegister ? t('auth.logInLink') : t('auth.signUpLink')}
                </button>
              </p>
            </form>
          )}
          {method === 'phone' && (
            <PhoneAuth
              onSignedIn={finish}
              onUseEmailAccount={(em) => {
                // "Email linked with another account" → sign in to that account instead.
                setMethod('email');
                setIsRegister(false);
                setEmail(em);
                setError(t('auth.signInWithEmailHint'));
              }}
            />
          )}
        </div>
      </div>

    </>
  );
}
