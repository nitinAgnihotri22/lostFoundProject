'use client';
// Phone OTP sign-in / sign-up (inside AuthModal).
//   1. phone   – enter number → Supabase sends an SMS code
//   2. otp     – enter code → Supabase verifies → /api/auth/phone
//                existing account → signed in; new number → step 3
//   3. profile – name (required) + email (optional) → /api/auth/phone/complete
//                email used by another account → "email linked" popup
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import type { User } from '@/types';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { trackRequest } from '@/lib/loading';
import { AuthError, completePhoneSignup, signInWithVerifiedPhone } from '@/lib/authClient';
import { useI18n } from '@/i18n/LanguageProvider';

const COUNTRIES = [
  { code: '+91', label: 'IN +91' },
  { code: '+1', label: 'US/CA +1' },
  { code: '+44', label: 'UK +44' },
  { code: '+971', label: 'AE +971' },
  { code: '+65', label: 'SG +65' },
  { code: '+61', label: 'AU +61' },
];
const RESEND_SECONDS = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Step = 'phone' | 'otp' | 'profile';

export default function PhoneAuth({ onSignedIn, onUseEmailAccount }: { onSignedIn: (u: User) => void; onUseEmailAccount: (email: string) => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('phone');
  const [country, setCountry] = useState('+91');
  const [national, setNational] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [signupToken, setSignupToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [linkedEmail, setLinkedEmail] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const e164 = `${country}${national.replace(/[^0-9]/g, '').replace(/^0+/, '')}`;

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const digits = national.replace(/[^0-9]/g, '').replace(/^0+/, '');
    if (digits.length < 6 || digits.length > 14 || (country === '+91' && digits.length !== 10)) {
      setError(t('auth.validPhone'));
      return;
    }
    setBusy(true);
    const { error: err } = await trackRequest(supabaseBrowser.auth.signInWithOtp({ phone: e164 }), 'loading.sendingOtp');
    setBusy(false);
    if (err) {
      console.error('OTP send failed:', err);
      const msg = String(err.message || '');
      setError(/provider|unsupported|not enabled/i.test(msg) ? t('auth.phoneNotConfigured') : /rate|seconds|too many/i.test(msg) ? t('auth.otpTooMany') : t('auth.otpSendFailed'));
      return;
    }
    setCode('');
    setStep('otp');
    setResendIn(RESEND_SECONDS);
    requestAnimationFrame(() => codeRef.current?.focus());
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const token = code.replace(/\s/g, '');
    if (!/^\d{4,8}$/.test(token)) {
      setError(t('auth.validOtp'));
      return;
    }
    setBusy(true);
    try {
      const { data, error: err } = await trackRequest(supabaseBrowser.auth.verifyOtp({ phone: e164, token, type: 'sms' }), 'loading.verifyingOtp');
      if (err || !data.session) {
        setError(t('auth.otpInvalid'));
        return;
      }
      const res = await signInWithVerifiedPhone(data.session.access_token);
      if (res.kind === 'signed_in') onSignedIn(res.user);
      else {
        setSignupToken(res.signupToken);
        setStep('profile');
      }
    } catch (err) {
      setError(err instanceof AuthError && err.code === 'ACCOUNT_DISABLED' ? t('errors.accountDisabled') : err instanceof Error ? err.message : t('common.somethingWrong'));
    } finally {
      // Our own 24h session is what counts; drop Supabase's copy.
      await supabaseBrowser.auth.signOut({ scope: 'local' }).catch(() => {});
      setBusy(false);
    }
  };

  const createAccount = async (opts: { withoutEmail?: boolean } = {}) => {
    setError(null);
    const n = name.trim();
    const em = opts.withoutEmail ? '' : email.trim();
    if (n.length < 2) {
      setError(t('auth.nameRequired'));
      return;
    }
    if (em && !EMAIL_RE.test(em)) {
      setError(t('contact.errEmail'));
      emailRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const user = await completePhoneSignup({ signupToken, name: n, email: em || undefined });
      onSignedIn(user);
    } catch (err) {
      if (err instanceof AuthError && err.code === 'EMAIL_LINKED') setLinkedEmail(em);
      else if (err instanceof AuthError && err.code === 'SIGNUP_EXPIRED') {
        setStep('phone');
        setError(t('auth.signupExpired'));
      } else setError(err instanceof Error ? err.message : t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const primary = 'w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl disabled:opacity-60';

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold">{error}</div>
      )}

      {step === 'phone' && (
        <form onSubmit={sendCode} noValidate className="space-y-3">
          <label htmlFor="otp-phone" className="block text-xs font-bold text-gray-700">{t('auth.phoneNumber')}</label>
          <div className="flex gap-2">
            <select aria-label={t('auth.countryCode')} value={country} onChange={(e) => setCountry(e.target.value)} className="border border-gray-300 rounded-xl px-2 py-2 text-sm bg-white">
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            <input id="otp-phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="98765 43210" value={national} onChange={(e) => setNational(e.target.value)} className={input} required />
          </div>
          <button type="submit" disabled={busy} className={primary}>{busy ? t('auth.sending') : t('auth.sendOtp')}</button>
          <p className="text-[0.6875rem] text-gray-500">{t('auth.otpNote')}</p>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={verify} noValidate className="space-y-3">
          <p className="text-sm text-gray-700">{t('auth.otpSentTo', { phone: e164 })}</p>
          <label htmlFor="otp-code" className="block text-xs font-bold text-gray-700">{t('auth.otp')}</label>
          <input
            id="otp-code"
            ref={codeRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
            className={`${input} tracking-[0.5em] text-center text-lg font-bold`}
            required
          />
          <button type="submit" disabled={busy} className={primary}>{busy ? t('auth.verifying') : t('auth.verifyOtp')}</button>
          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={() => { setStep('phone'); setError(null); }} className="inline-flex items-center gap-1 font-bold text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-3.5 h-3.5" /> {t('auth.changeNumber')}
            </button>
            {resendIn > 0 ? (
              <span className="text-gray-500" aria-live="polite">{t('auth.resendIn', { s: resendIn })}</span>
            ) : (
              <button type="button" onClick={() => sendCode()} disabled={busy} className="font-bold text-blue-600 hover:underline">{t('auth.resend')}</button>
            )}
          </div>
        </form>
      )}

      {step === 'profile' && (
        <form onSubmit={(e) => { e.preventDefault(); createAccount(); }} noValidate className="space-y-3">
          <div>
            <p className="text-sm font-bold text-gray-900">{t('auth.profileTitle')}</p>
            <p className="text-xs text-gray-600">{t('auth.profileIntro', { phone: e164 })}</p>
          </div>
          <div>
            <label htmlFor="otp-name" className="block text-xs font-bold text-gray-700 mb-1">{t('auth.name')} <span className="text-red-700" aria-hidden="true">*</span></label>
            <input id="otp-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={input} required maxLength={100} />
          </div>
          <div>
            <label htmlFor="otp-email" className="block text-xs font-bold text-gray-700 mb-1">{t('auth.emailOptional')}</label>
            <input id="otp-email" ref={emailRef} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby="otp-email-hint" className={input} />
            <p id="otp-email-hint" className="mt-1 text-[0.6875rem] text-gray-500">{t('auth.emailOptionalHint')}</p>
          </div>
          <button type="submit" disabled={busy} className={primary}>{busy ? t('common.pleaseWait') : t('auth.createAccount')}</button>
        </form>
      )}

      {linkedEmail && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50">
          <div role="alertdialog" aria-modal="true" aria-labelledby="linked-title" aria-describedby="linked-body" className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-3">
              <Mail className="w-5 h-5" />
            </div>
            <h3 id="linked-title" className="text-lg font-black text-gray-900">{t('auth.emailLinkedTitle')}</h3>
            <p id="linked-body" className="mt-1 text-sm text-gray-700">{t('auth.emailLinkedBody', { email: linkedEmail })}</p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => { setLinkedEmail(null); setEmail(''); requestAnimationFrame(() => emailRef.current?.focus()); }}
                className={primary}
              >
                {t('auth.useDifferentEmail')}
              </button>
              <button type="button" onClick={() => { setLinkedEmail(null); setEmail(''); createAccount({ withoutEmail: true }); }} className="w-full py-2.5 border border-gray-300 rounded-xl text-sm font-bold text-gray-800 hover:bg-gray-50">
                {t('auth.continueWithoutEmail')}
              </button>
              <button type="button" onClick={() => { const em = linkedEmail; setLinkedEmail(null); onUseEmailAccount(em); }} className="w-full py-2 text-sm font-bold text-blue-700 hover:underline">
                {t('auth.signInThatAccount')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
