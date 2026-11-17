'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Send } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useI18n } from '@/i18n/LanguageProvider';
import type { TKey } from '@/i18n/translate';

const SUBJECTS: { value: string; label: TKey }[] = [
  { value: 'general', label: 'contact.subjectGeneral' },
  { value: 'listing', label: 'contact.subjectListing' },
  { value: 'claim', label: 'contact.subjectClaim' },
  { value: 'account', label: 'contact.subjectAccount' },
  { value: 'accessibility', label: 'contact.subjectAccessibility' },
  { value: 'partnership', label: 'contact.subjectPartnership' },
  { value: 'other', label: 'contact.subjectOther' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s\-()]{7,20}$/;
const MESSAGE_MAX = 2000;

type Field = 'name' | 'email' | 'phone' | 'message' | 'consent';
type Errors = Partial<Record<Field, TKey>>;

export default function ContactForm() {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('general');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<{ reference: string; name: string; email: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  const validate = (): Errors => {
    const e: Errors = {};
    const n = name.trim();
    if (n.length < 2 || n.length > 100) e.name = 'contact.errName';
    if (!EMAIL_RE.test(email.trim())) e.email = 'contact.errEmail';
    if (phone.trim() && !PHONE_RE.test(phone.trim())) e.phone = 'contact.errPhone';
    if (message.trim().length < 10) e.message = 'contact.errMessage';
    if (!consent) e.consent = 'contact.errConsent';
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError(null);
    const found = validate();
    setErrors(found);
    const first = (Object.keys(found) as Field[])[0];
    if (first) {
      // WCAG 3.3.1: move focus to the first field with an error.
      formRef.current?.querySelector<HTMLElement>(`#contact-${first}`)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const { reference } = await api.contact.send({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        subject,
        message: message.trim(),
        consent,
        website,
      });
      setSent({ reference, name: name.trim(), email: email.trim() });
      setTimeout(() => successRef.current?.focus(), 0);
    } catch (err) {
      if (err instanceof ApiError && err.field && ['name', 'email', 'phone', 'message', 'consent'].includes(err.field)) {
        const field = err.field as Field;
        setErrors({ [field]: `contact.err${field[0].toUpperCase()}${field.slice(1)}` as TKey });
        formRef.current?.querySelector<HTMLElement>(`#contact-${field}`)?.focus();
      } else {
        setServerError(err instanceof ApiError && err.code === 'RATE_LIMITED' ? err.message : t('contact.errGeneric'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setName('');
    setEmail('');
    setPhone('');
    setSubject('general');
    setMessage('');
    setConsent(false);
    setErrors({});
    setSent(null);
  };

  if (sent) {
    return (
      <div ref={successRef} tabIndex={-1} role="status" className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 focus:outline-none">
        <div className="flex items-center gap-2 text-emerald-800 font-black text-lg">
          <CheckCircle2 className="w-6 h-6" /> {t('contact.successTitle')}
        </div>
        <p className="mt-2 text-sm text-emerald-900">{t('contact.successBody', { name: sent.name, email: sent.email, ref: sent.reference })}</p>
        <button type="button" onClick={reset} className="mt-4 px-4 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-800 text-sm font-bold hover:bg-emerald-100">
          {t('contact.sendAnother')}
        </button>
      </div>
    );
  }

  const inputClass = (field: Field) =>
    `w-full text-sm px-3.5 py-2.5 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      errors[field] ? 'border-red-500' : 'border-gray-300'
    }`;
  const errorText = (field: Field) =>
    errors[field] ? (
      <p id={`contact-${field}-error`} className="mt-1 text-xs font-semibold text-red-700">
        {t(errors[field]!)}
      </p>
    ) : null;
  const describedBy = (field: Field, extra?: string) =>
    [errors[field] ? `contact-${field}-error` : '', extra ?? ''].filter(Boolean).join(' ') || undefined;
  const label = 'block text-sm font-bold text-gray-800 mb-1';
  const req = <span className="text-red-700" aria-hidden="true"> *</span>;

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4 bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
      <h2 className="text-lg font-black text-gray-900">{t('contact.formTitle')}</h2>
      <p className="text-xs text-gray-600">{t('contact.requiredNote')}</p>

      {serverError && (
        <p role="alert" className="text-sm font-semibold text-red-800 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {serverError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className={label}>{t('contact.name')}{req}</label>
          <input id="contact-name" type="text" autoComplete="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} aria-describedby={describedBy('name')} className={inputClass('name')} />
          {errorText('name')}
        </div>
        <div>
          <label htmlFor="contact-email" className={label}>{t('contact.emailLabel')}{req}</label>
          <input id="contact-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} aria-describedby={describedBy('email')} className={inputClass('email')} />
          {errorText('email')}
        </div>
        <div>
          <label htmlFor="contact-phone" className={label}>{t('contact.phoneLabel')}</label>
          <input id="contact-phone" type="tel" autoComplete="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!errors.phone} aria-describedby={describedBy('phone')} className={inputClass('phone')} />
          {errorText('phone')}
        </div>
        <div>
          <label htmlFor="contact-subject" className={label}>{t('contact.subject')}</label>
          <select id="contact-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={`${inputClass('name')} border-gray-300`}>
            {SUBJECTS.map((s) => (
              <option key={s.value} value={s.value}>{t(s.label)}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" className={label}>{t('contact.message')}{req}</label>
        <textarea id="contact-message" required rows={6} maxLength={MESSAGE_MAX} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('contact.messagePlaceholder')} aria-invalid={!!errors.message} aria-describedby={describedBy('message', 'contact-message-count')} className={inputClass('message')} />
        <div className="flex justify-between gap-2">
          {errorText('message') ?? <span />}
          <p id="contact-message-count" className="mt-1 text-xs text-gray-500">{t('contact.charsLeft', { count: MESSAGE_MAX - message.length })}</p>
        </div>
      </div>

      {/* Honeypot – hidden from people and assistive tech, bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      <div>
        <div className="flex items-start gap-2.5">
          <input id="contact-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={!!errors.consent} aria-describedby={describedBy('consent')} className="mt-1 w-4 h-4 accent-blue-700" />
          <label htmlFor="contact-consent" className="text-sm text-gray-700">
            {t('contact.consent')}{' '}
            <Link href="/privacy" className="text-blue-700 underline underline-offset-2">{t('footer.privacy')}</Link>
            {req}
          </label>
        </div>
        {errorText('consent')}
      </div>

      <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold disabled:opacity-60">
        <Send className="w-4 h-4" />
        {submitting ? t('contact.sending') : t('contact.submit')}
      </button>
    </form>
  );
}
