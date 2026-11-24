'use client';

import React, { useState } from 'react';
import { Ban, CheckCircle2, Copy, KeyRound, LockOpen, UserPlus } from 'lucide-react';
import { adminApi, AdminApiError, fmtDate, generatePassword, timeAgo } from '@/lib/admin/client';
import { ADMIN_ROLE_LABEL, ASSIGNABLE_ROLES, AdminProfile, AdminRole } from '@/lib/admin/permissions';
import { Badge, Button, Card, ErrorBox, Modal, PageHeader, Spinner, useLoader, useToast } from './ui';
import { useAdmin } from './AdminShell';
import CreateUserDialog from './CreateUserDialog';

type AdminRow = AdminProfile & { createdByName: string | null; locked: boolean };

export default function AdminsView({ openCreate }: { openCreate?: boolean }) {
  const { admin: me } = useAdmin();
  const toast = useToast();
  const { data, error, loading, reload } = useLoader(() => adminApi<AdminRow[]>('/admins'), []);
  const [creating, setCreating] = useState(!!openCreate);
  const [confirm, setConfirm] = useState<{ row: AdminRow; action: 'disable' | 'reset_password' } | null>(null);
  const [newPassword, setNewPassword] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (row: AdminRow, action: 'disable' | 'enable' | 'unlock' | 'reset_password') => {
    setBusy(true);
    const password = action === 'reset_password' ? generatePassword() : undefined;
    try {
      await adminApi(`/admins/${encodeURIComponent(row.id)}`, { method: 'PATCH', json: { action, password } });
      setConfirm(null);
      if (password) setNewPassword({ email: row.email, password });
      else toast(action === 'disable' ? `${row.name} disabled and signed out` : action === 'enable' ? `${row.name} can sign in again` : `${row.name} unlocked`);
      reload();
    } catch (e) {
      toast(e instanceof AdminApiError ? e.message : 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const setRole = async (row: AdminRow, role: AdminRole) => {
    setBusy(true);
    try {
      await adminApi(`/admins/${encodeURIComponent(row.id)}`, { method: 'PATCH', json: { action: 'set_role', role } });
      toast(`${row.name} is now a ${ADMIN_ROLE_LABEL[role].toLowerCase()}`);
      reload();
    } catch (e) {
      toast(e instanceof AdminApiError ? e.message : 'Could not change role', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Admin users"
        description="People who can sign in to this admin panel. Checkers approve new posts before they go live; sub admins moderate posts, website users and messages; only super admins manage pages, admins and the activity log."
        actions={<Button variant="primary" onClick={() => setCreating(true)}><UserPlus className="w-4 h-4" /> Create user</Button>}
      />
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Admin users</caption>
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Admin</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Last sign-in</th>
                <th scope="col" className="px-4 py-3">Created</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((a) => {
                const editable = a.id !== me.id && a.role !== 'super_admin';
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{a.name}{a.id === me.id && <span className="text-slate-500 font-normal"> (you)</span>}</p>
                      <p className="text-xs text-slate-500">{a.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {editable ? (
                        <select
                          aria-label={`Role for ${a.name}`}
                          value={a.role}
                          disabled={busy}
                          onChange={(e) => setRole(a, e.target.value as AdminRole)}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
                        >
                          {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ADMIN_ROLE_LABEL[r]}</option>)}
                        </select>
                      ) : (
                        <Badge tone={a.role === 'super_admin' ? 'purple' : a.role === 'checker' ? 'green' : 'blue'}>{ADMIN_ROLE_LABEL[a.role]}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{a.lastLoginAt ? timeAgo(a.lastLoginAt) : 'Never'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {fmtDate(a.createdAt, false)}
                      {a.createdByName && <p className="text-xs text-slate-500">by {a.createdByName}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {a.status === 'active' ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>}
                        {a.locked && <Badge tone="amber">Locked</Badge>}
                        {a.mustChangePassword && <Badge tone="amber" title="Must choose a new password at next sign-in">Temp password</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {editable ? (
                        <div className="inline-flex gap-1">
                          {a.locked && <Button size="sm" variant="ghost" onClick={() => act(a, 'unlock')} disabled={busy}><LockOpen className="w-3.5 h-3.5" /> Unlock</Button>}
                          <Button size="sm" variant="ghost" onClick={() => setConfirm({ row: a, action: 'reset_password' })}><KeyRound className="w-3.5 h-3.5" /> Reset password</Button>
                          {a.status === 'active' ? (
                            <Button size="sm" variant="secondary" className="text-red-700" onClick={() => setConfirm({ row: a, action: 'disable' })}><Ban className="w-3.5 h-3.5" /> Disable</Button>
                          ) : (
                            <Button size="sm" variant="secondary" onClick={() => act(a, 'enable')} disabled={busy}><CheckCircle2 className="w-3.5 h-3.5" /> Enable</Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">{a.id === me.id ? 'Manage in My account' : '—'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <Card title="What each role can do" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th scope="col" className="py-2 pr-4">Area</th><th scope="col" className="py-2 pr-4">Super admin</th><th scope="col" className="py-2 pr-4">Checker</th><th scope="col" className="py-2">Sub admin</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                ['Dashboard', 'Yes', 'Yes', 'Yes'],
                ['Review queue: approve / reject new posts', 'Yes', 'Yes', 'No'],
                ['Posts: view', 'Yes', 'Yes', 'Yes'],
                ['Posts: hide and show', 'Yes', 'No', 'Yes'],
                ['Posts: delete permanently', 'Yes', 'No', 'No'],
                ['Website users: view, disable and enable', 'Yes', 'No', 'Yes'],
                ['Create users (sub admins, checkers, website users)', 'Yes', 'No', 'No'],
                ['Contact messages', 'Yes', 'No', 'Yes'],
                ['Pages & company details', 'Yes', 'No', 'No'],
                ['Admin users', 'Yes', 'No', 'No'],
                ['Boosts: approve first boosts', 'Yes', 'Yes', 'No'],
                ['Boosts: stop a boost', 'Yes', 'No', 'Yes'],
                ['Analytics', 'Yes', 'No', 'Yes'],
                ['Ads settings', 'Yes', 'No', 'No'],
                ['Activity log', 'Yes', 'No', 'No'],
              ].map(([area, s, c, sub]) => (
                <tr key={area}><td className="py-2 pr-4 text-slate-800">{area}</td><td className="py-2 pr-4">{s}</td><td className="py-2 pr-4">{c}</td><td className="py-2">{sub}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {creating && <CreateUserDialog defaultType="sub_admin" onClose={() => setCreating(false)} onCreated={(t) => t === 'sub_admin' && reload()} />}

      {confirm && (
        <Modal
          title={confirm.action === 'disable' ? `Disable ${confirm.row.name}?` : `Reset ${confirm.row.name}’s password?`}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <Button onClick={() => setConfirm(null)}>Cancel</Button>
              <Button variant={confirm.action === 'disable' ? 'danger' : 'primary'} loading={busy} onClick={() => act(confirm.row, confirm.action)}>
                {confirm.action === 'disable' ? 'Disable' : 'Reset password'}
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-700">
            {confirm.action === 'disable'
              ? 'They’re signed out everywhere straight away and can’t sign in until you enable the account again.'
              : 'A new temporary password is generated and shown once. They’re signed out everywhere and must choose their own password at next sign-in.'}
          </p>
        </Modal>
      )}

      {newPassword && (
        <Modal title="New temporary password" onClose={() => setNewPassword(null)} footer={<Button variant="primary" onClick={() => setNewPassword(null)}>Done</Button>}>
          <p className="text-sm text-slate-700">Share this privately with {newPassword.email}. It isn’t shown again.</p>
          <p className="mt-3 rounded-lg bg-slate-100 p-3 font-mono text-base text-slate-900 break-all">{newPassword.password}</p>
          <Button
            className="mt-3"
            onClick={() => navigator.clipboard.writeText(newPassword.password).then(() => toast('Copied'), () => toast('Copy failed', 'error'))}
          >
            <Copy className="w-4 h-4" /> Copy
          </Button>
        </Modal>
      )}
    </>
  );
}
