'use client';

import React, { useState } from 'react';
import { AlertTriangle, LogOut } from 'lucide-react';
import { adminApi, AdminApiError, fmtDate } from '@/lib/admin/client';
import { ADMIN_ROLE_LABEL, PASSWORD_MIN, passwordProblem } from '@/lib/admin/permissions';
import { Button, Card, Field, inputClass, Modal, PageHeader, useToast } from './ui';
import { useAdmin } from './AdminShell';

export default function AccountView() {
  const { admin } = useAdmin();
  const toast = useToast();
  const [name, setName] = useState(admin.name);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'name' | 'pw' | 'all' | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('name');
    try {
      await adminApi('/account', { method: 'PATCH', json: { name } });
      toast('Name updated');
      window.location.reload();
    } catch (err) {
      setErrors({ name: err instanceof Error ? err.message : 'Could not save' });
      setBusy(null);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!current) errs.currentPassword = 'Enter your current password.';
    const problem = passwordProblem(next);
    if (problem) errs.newPassword = problem;
    else if (next !== again) errs.again = 'The passwords don’t match.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy('pw');
    try {
      await adminApi('/account', { method: 'PATCH', json: { currentPassword: current, newPassword: next } });
      toast('Password changed. Other sessions have been signed out.');
      // Reload so the layout picks up the cleared "must change password" flag.
      window.location.href = admin.mustChangePassword ? '/admin' : '/admin/account';
    } catch (err) {
      if (err instanceof AdminApiError && err.field) setErrors({ [err.field]: err.message });
      else toast(err instanceof Error ? err.message : 'Could not change password', 'error');
      setBusy(null);
    }
  };

  const signOutAll = async () => {
    setBusy('all');
    try {
      await adminApi('/account', { method: 'POST', json: { action: 'signout_all' } });
    } finally {
      window.location.href = '/admin/login';
    }
  };

  return (
    <>
      <PageHeader title="My account" description={`${ADMIN_ROLE_LABEL[admin.role]} · ${admin.email} · last sign-in ${fmtDate(admin.lastLoginAt)}`} />

      {admin.mustChangePassword && (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p><strong>Choose your own password to continue.</strong> Your account was set up with a temporary password; the rest of the admin panel unlocks once you change it.</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 max-w-5xl">
        <Card title="Change password">
          <form onSubmit={changePassword} noValidate className="space-y-4">
            <input type="email" autoComplete="username" value={admin.email} readOnly hidden />
            <Field label="Current password" required error={errors.currentPassword}>
              {(p) => <input {...p} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />}
            </Field>
            <Field label="New password" required error={errors.newPassword} hint={`At least ${PASSWORD_MIN} characters, with letters and numbers.`}>
              {(p) => <input {...p} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />}
            </Field>
            <Field label="Repeat new password" required error={errors.again}>
              {(p) => <input {...p} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={inputClass} />}
            </Field>
            <Button type="submit" variant="primary" loading={busy === 'pw'}>Change password</Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card title="Profile">
            <form onSubmit={saveName} noValidate className="space-y-4">
              <Field label="Name" error={errors.name}>
                {(p) => <input {...p} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className={inputClass} disabled={admin.mustChangePassword} />}
              </Field>
              <Button type="submit" loading={busy === 'name'} disabled={name.trim() === admin.name || admin.mustChangePassword}>Save name</Button>
            </form>
          </Card>
          <Card title="Sessions">
            <p className="text-sm text-slate-600 mb-3">
              Admin sessions last 8 hours. If you signed in on a shared or lost device, sign out everywhere.
            </p>
            <Button variant="secondary" className="text-red-700" onClick={() => setConfirmAll(true)}><LogOut className="w-4 h-4" /> Sign out everywhere</Button>
          </Card>
        </div>
      </div>

      {confirmAll && (
        <Modal title="Sign out everywhere?" onClose={() => setConfirmAll(false)} footer={<><Button onClick={() => setConfirmAll(false)}>Cancel</Button><Button variant="danger" loading={busy === 'all'} onClick={signOutAll}>Sign out everywhere</Button></>}>
          <p className="text-sm text-slate-700">Every admin session for your account ends, including this one. You’ll need to sign in again.</p>
        </Modal>
      )}
    </>
  );
}
