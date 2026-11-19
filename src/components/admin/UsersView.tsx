'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Ban, CheckCircle2, Search, UserPlus } from 'lucide-react';
import { adminApi, AdminApiError, fmtDate, qs, timeAgo } from '@/lib/admin/client';
import { Badge, Button, Empty, ErrorBox, Field, inputClass, Modal, PageHeader, Pagination, Spinner, useDebounced, useLoader, useToast } from './ui';
import { useAdmin } from './AdminShell';
import CreateUserDialog from './CreateUserDialog';

interface WebUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  signIn: 'google' | 'email' | 'phone';
  phoneVerified: boolean;
  status: 'active' | 'disabled';
  disabledAt?: string;
  disabledReason?: string;
  createdByAdmin: boolean;
  lastLoginAt?: string;
  createdAt: string;
  postCount: number;
  claimCount: number;
}
interface PageData { rows: WebUser[]; total: number; page: number; pageSize: number }

const DISABLE_REASONS = ['Spam or fake posts', 'Abusive behaviour towards other users', 'Fraudulent claims', 'Impersonation', 'Requested by the user'];

function DisableDialog({ user, onClose, onDone }: { user: WebUser; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [preset, setPreset] = useState(DISABLE_REASONS[0]);
  const [custom, setCustom] = useState('');
  const [hidePosts, setHidePosts] = useState(true);
  const [busy, setBusy] = useState(false);
  const reason = preset === 'other' ? custom.trim() : preset;

  const submit = async () => {
    setBusy(true);
    try {
      const res = await adminApi<{ postsChanged: number }>(`/users/${encodeURIComponent(user.id)}`, { method: 'PATCH', json: { action: 'disable', reason, hidePosts } });
      toast(`${user.name} disabled${res.postsChanged ? ` · ${res.postsChanged} post${res.postsChanged === 1 ? '' : 's'} hidden` : ''}`);
      onDone();
    } catch (e) {
      toast(e instanceof AdminApiError ? e.message : 'Could not disable', 'error');
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Disable ${user.name}?`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={!reason} onClick={submit}><Ban className="w-4 h-4" /> Disable account</Button>
        </>
      }
    >
      <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1 mb-4">
        <li>They can’t sign in to the website.</li>
        <li>If they’re signed in now, they’re signed out on their next action.</li>
        <li>You can re-enable the account at any time.</li>
      </ul>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-800 mb-2">Reason (for the activity log)</legend>
        {[...DISABLE_REASONS, 'other'].map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm">
            <input type="radio" name="disable-reason" checked={preset === r} onChange={() => setPreset(r)} className="accent-slate-900" />
            {r === 'other' ? 'Other…' : r}
          </label>
        ))}
      </fieldset>
      {preset === 'other' && (
        <div className="mt-3">
          <Field label="Your reason" required>{(p) => <input {...p} value={custom} maxLength={300} onChange={(e) => setCustom(e.target.value)} className={inputClass} />}</Field>
        </div>
      )}
      <label className="mt-4 flex items-start gap-2 text-sm text-slate-800">
        <input type="checkbox" checked={hidePosts} onChange={(e) => setHidePosts(e.target.checked)} className="mt-0.5 accent-slate-900" />
        <span>
          Also hide their {user.postCount} post{user.postCount === 1 ? '' : 's'} from the website
          <span className="block text-xs text-slate-500">They come back automatically if you re-enable the account.</span>
        </span>
      </label>
    </Modal>
  );
}

export default function UsersView({ initial }: { initial: { search?: string; status?: string; create?: boolean } }) {
  const { can } = useAdmin();
  const toast = useToast();
  const [search, setSearch] = useState(initial.search ?? '');
  const [status, setStatus] = useState(initial.status ?? '');
  const [page, setPage] = useState(1);
  const [disableTarget, setDisableTarget] = useState<WebUser | null>(null);
  const [creating, setCreating] = useState(!!initial.create && can('users.create'));
  const [busyId, setBusyId] = useState<string | null>(null);
  const debounced = useDebounced(search);
  const query = useMemo(() => qs({ search: debounced.trim(), status, page }), [debounced, status, page]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else setPage(1);
  }, [debounced, status]);

  const { data, error, loading, reload } = useLoader(() => adminApi<PageData>(`/users${query}`), [query]);

  const enable = async (u: WebUser) => {
    setBusyId(u.id);
    try {
      const res = await adminApi<{ postsChanged: number }>(`/users/${encodeURIComponent(u.id)}`, { method: 'PATCH', json: { action: 'enable' } });
      toast(`${u.name} can sign in again${res.postsChanged ? ` · ${res.postsChanged} post${res.postsChanged === 1 ? '' : 's'} restored` : ''}`);
      reload();
    } catch (e) {
      toast(e instanceof AdminApiError ? e.message : 'Could not enable', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Website users"
        description="People with a LostFound account. A disabled user can’t sign in or use the website."
        actions={can('users.create') && <Button variant="primary" onClick={() => setCreating(true)}><UserPlus className="w-4 h-4" /> Create user</Button>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_14rem]">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or phone…" aria-label="Search users" className={`${inputClass} pl-9`} />
        </div>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
          <option value="">Active & disabled</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {error && <ErrorBox error={error} onRetry={reload} />}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden" aria-busy={loading}>
        {loading && !data ? (
          <Spinner />
        ) : !data || data.rows.length === 0 ? (
          <Empty title="No users found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Website users</caption>
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">User</th>
                  <th scope="col" className="px-4 py-3">Sign-in</th>
                  <th scope="col" className="px-4 py-3">Activity</th>
                  <th scope="col" className="px-4 py-3">Joined</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((u) => (
                  <tr key={u.id} className={u.status === 'disabled' ? 'bg-red-50/40' : undefined}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-[14rem]">
                        {u.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatar} alt="" className="w-9 h-9 rounded-full bg-slate-100 shrink-0" />
                        ) : (
                          <span className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{u.name}</p>
                          <p className="text-xs text-slate-500 truncate">{u.email ?? 'no email'}{u.phone ? ` · ${u.phone}${u.phoneVerified ? ' ✓' : ''}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{u.signIn === 'google' ? 'Google' : u.signIn === 'phone' ? 'Phone OTP' : 'Email'}</Badge>
                      {u.createdByAdmin && <span className="ml-1"><Badge tone="purple">admin-created</Badge></span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={`/admin/posts?userId=${encodeURIComponent(u.id)}`} className="text-blue-700 hover:underline">{u.postCount} post{u.postCount === 1 ? '' : 's'}</Link>
                      <span className="text-slate-500"> · {u.claimCount} claim{u.claimCount === 1 ? '' : 's'}</span>
                      <p className="text-xs text-slate-500">Last sign-in {timeAgo(u.lastLoginAt)}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{fmtDate(u.createdAt, false)}</td>
                    <td className="px-4 py-3">
                      {u.status === 'disabled' ? (
                        <div>
                          <Badge tone="red">Disabled</Badge>
                          <p className="text-xs text-slate-500 mt-1 max-w-[14rem]" title={u.disabledReason}>{u.disabledReason} · {fmtDate(u.disabledAt, false)}</p>
                        </div>
                      ) : (
                        <Badge tone="green">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {can('users.moderate') &&
                        (u.status === 'disabled' ? (
                          <Button size="sm" variant="secondary" loading={busyId === u.id} onClick={() => enable(u)}><CheckCircle2 className="w-3.5 h-3.5" /> Enable</Button>
                        ) : (
                          <Button size="sm" variant="secondary" className="text-red-700" onClick={() => setDisableTarget(u)}><Ban className="w-3.5 h-3.5" /> Disable</Button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </section>

      {disableTarget && <DisableDialog user={disableTarget} onClose={() => setDisableTarget(null)} onDone={() => { setDisableTarget(null); reload(); }} />}
      {creating && <CreateUserDialog defaultType="website_user" onClose={() => setCreating(false)} onCreated={(t) => t === 'website_user' && reload()} />}
    </>
  );
}
