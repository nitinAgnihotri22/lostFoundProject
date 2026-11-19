'use client';

import React, { useMemo, useState } from 'react';
import { adminApi, fmtDate, qs } from '@/lib/admin/client';
import { Empty, ErrorBox, inputClass, PageHeader, Pagination, Spinner, useLoader } from './ui';

interface Entry {
  id: string;
  admin_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  'admin.login': 'Signed in',
  'admin.locked': 'Locked out after failed sign-ins',
  'admin.create': 'Created a sub admin',
  'admin.disable': 'Disabled an admin',
  'admin.enable': 'Enabled an admin',
  'admin.unlock': 'Unlocked an admin',
  'admin.reset_password': 'Reset an admin’s password',
  'admin.cli_create': 'Super admin created from the command line',
  'admin.cli_reset': 'Super admin reset from the command line',
  'account.password_change': 'Changed own password',
  'account.update': 'Updated own profile',
  'account.signout_all': 'Signed out everywhere',
  'post.hide': 'Hid post(s)',
  'post.show': 'Showed post(s) again',
  'post.delete': 'Deleted a post',
  'post.approve': 'Approved post(s) – now live',
  'post.reject': 'Rejected post(s)',
  'email.review_notice': 'Emailed posters about a review decision',
  'admin.set_role': 'Changed an admin’s role',
  'user.create': 'Created a website user',
  'user.disable': 'Disabled a website user',
  'user.enable': 'Enabled a website user',
  'message.update': 'Updated a contact message',
  'page.publish': 'Published page text',
  'page.revert': 'Removed custom page text',
  'settings.update': 'Saved company details',
  'settings.reset': 'Reset company details',
};

const FILTERS: [string, string][] = [
  ['', 'All activity'],
  ['post.', 'Posts'],
  ['user.', 'Website users'],
  ['admin.', 'Admin accounts & sign-ins'],
  ['account.', 'Own account changes'],
  ['page.', 'Pages'],
  ['settings.', 'Company details'],
  ['message.', 'Contact messages'],
];

function summary(e: Entry): string {
  const d = e.details ?? {};
  const bits: string[] = [];
  for (const k of ['decision', 'sent', 'skipped', 'email', 'title', 'reason', 'reference', 'status', 'changed', 'postsHidden', 'postsRestored', 'length']) {
    if (d[k] !== undefined && d[k] !== null && d[k] !== '') bits.push(`${k}: ${String(d[k])}`);
  }
  if (Array.isArray(d.ids) && d.ids.length > 1) bits.push(`${d.ids.length} posts`);
  if (e.target_type === 'page' && e.target_id) bits.unshift(e.target_id.replace(':', ' · '));
  return bits.join(' · ');
}

export default function AuditView() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const query = useMemo(() => qs({ action, page }), [action, page]);
  const { data, error, loading, reload } = useLoader(() => adminApi<{ rows: Entry[]; total: number; page: number; pageSize: number }>(`/audit${query}`), [query]);

  return (
    <>
      <PageHeader title="Activity log" description="Everything admins have done in this panel, newest first." />
      <div className="mb-4 max-w-xs">
        <select aria-label="Filter activity" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className={inputClass}>
          {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {error && <ErrorBox error={error} onRetry={reload} />}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden" aria-busy={loading}>
        {loading && !data ? (
          <Spinner />
        ) : !data || data.rows.length === 0 ? (
          <Empty title="No activity yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Admin activity</caption>
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">When</th>
                  <th scope="col" className="px-4 py-3">Admin</th>
                  <th scope="col" className="px-4 py-3">Action</th>
                  <th scope="col" className="px-4 py-3">Details</th>
                  <th scope="col" className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{fmtDate(e.created_at)}</td>
                    <td className="px-4 py-2.5 text-slate-800">{e.admin_email ?? '—'}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{ACTION_LABEL[e.action] ?? e.action}</td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-md"><span className="line-clamp-2" title={JSON.stringify(e.details ?? {})}>{summary(e) || '—'}</span></td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{e.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </section>
    </>
  );
}
