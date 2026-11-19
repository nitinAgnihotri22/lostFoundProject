'use client';
// "Create user" for super admins. Three account types:
//   - Sub admin     → admin panel: moderates posts, users and messages
//   - Checker       → admin panel: approves / rejects new posts (maker-checker)
//   - Website user  → a normal LostFound account (can't sign in to /admin)
import React, { useState } from 'react';
import { ClipboardCheck, Copy, RefreshCw, ShieldCheck, User } from 'lucide-react';
import { adminApi, AdminApiError, generatePassword } from '@/lib/admin/client';
import { Button, Field, inputClass, Modal, useToast } from './ui';

export type NewUserType = 'sub_admin' | 'checker' | 'website_user';
const isAdminType = (t: NewUserType) => t === 'sub_admin' || t === 'checker';

export default function CreateUserDialog({ defaultType, onClose, onCreated }: { defaultType: NewUserType; onClose: () => void; onCreated: (type: NewUserType) => void }) {
  const toast = useToast();
  const [type, setType] = useState<NewUserType>(defaultType);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ email: string; password: string; type: NewUserType } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      if (isAdminType(type)) await adminApi('/admins', { method: 'POST', json: { name, email, password, role: type } });
      else await adminApi('/users', { method: 'POST', json: { name, email, password, phone: phone || undefined } });
      setDone({ email: email.trim().toLowerCase(), password, type });
      onCreated(type);
    } catch (err) {
      if (err instanceof AdminApiError && err.field) setErrors({ [err.field]: err.message });
      else toast(err instanceof Error ? err.message : 'Could not create the account', 'error');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied');
    } catch {
      toast('Copy failed – select the text and copy it manually', 'error');
    }
  };

  if (done) {
    const where = isAdminType(done.type) ? `${window.location.origin}/admin/login` : window.location.origin;
    const note = `LostFound ${done.type === 'checker' ? 'checker' : done.type === 'sub_admin' ? 'admin' : ''} account\nSign in at: ${where}\nEmail: ${done.email}\nTemporary password: ${done.password}`;
    return (
      <Modal title="Account created" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
        <p className="text-sm text-slate-700">
          Share these details privately (not by public chat). {isAdminType(done.type) ? 'They’ll be asked to choose a new password the first time they sign in.' : 'They can sign in on the website straight away.'}
        </p>
        <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-sm text-slate-900 font-mono">{note}</pre>
        <Button className="mt-3" onClick={() => copy(note)}><Copy className="w-4 h-4" /> Copy details</Button>
        <p className="mt-3 text-xs text-slate-500">This password isn’t shown again.</p>
      </Modal>
    );
  }

  return (
    <Modal
      title="Create user"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="create-user-form" loading={busy}>Create {type === 'sub_admin' ? 'sub admin' : type === 'checker' ? 'checker' : 'website user'}</Button>
        </>
      }
    >
      <form id="create-user-form" onSubmit={submit} noValidate className="space-y-4">
        <fieldset>
          <legend className="text-sm font-semibold text-slate-800 mb-2">Account type</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {([
              ['sub_admin', 'Sub admin', 'Admin panel. Hides posts, manages website users and messages.', ShieldCheck],
              ['checker', 'Checker', 'Admin panel. Approves or rejects new posts before they go live.', ClipboardCheck],
              ['website_user', 'Website user', 'A normal LostFound account for the public website.', User],
            ] as const).map(([value, label, desc, Icon]) => (
              <label key={value} className={`flex gap-3 rounded-xl border p-3 cursor-pointer ${type === value ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-300 hover:bg-slate-50'}`}>
                <input type="radio" name="user-type" value={value} checked={type === value} onChange={() => setType(value)} className="sr-only" />
                <Icon className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
                <span>
                  <span className="block text-sm font-bold text-slate-900">{label}</span>
                  <span className="block text-xs text-slate-600">{desc}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Full name" required error={errors.name}>
          {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" className={inputClass} />}
        </Field>
        <Field label="Email" required error={errors.email}>
          {(p) => <input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" className={inputClass} />}
        </Field>
        {type === 'website_user' && (
          <Field label="Phone" error={errors.phone}>
            {(p) => <input {...p} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />}
          </Field>
        )}
        <Field
          label="Temporary password"
          required
          error={errors.password || errors.newPassword}
          hint={isAdminType(type) ? 'At least 10 characters with letters and numbers. They must change it at first sign-in.' : 'At least 8 characters.'}
        >
          {(p) => (
            <div className="flex gap-2">
              <input {...p} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={`${inputClass} font-mono`} />
              <Button onClick={() => setPassword(generatePassword())} aria-label="Generate a new password"><RefreshCw className="w-4 h-4" /></Button>
            </div>
          )}
        </Field>
      </form>
    </Modal>
  );
}
