'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, EyeOff, Inbox, MapPin, Package, UserPlus, Users } from 'lucide-react';
import { adminApi, timeAgo } from '@/lib/admin/client';
import { Badge, Card, ErrorBox, PageHeader, Spinner, useLoader } from './ui';
import { useAdmin } from './AdminShell';

interface Stats {
  users: { total: number; disabled: number; newThisWeek: number };
  items: { total: number; live: number; hidden: number; closed: number; newThisWeek: number; found: number; lost: number };
  claims: { pending: number; approved: number };
  review: { pending: number };
  messages: { new: number };
  recentItems: { id: string; title: string; type: string; city: string | null; address: string; status: string; is_hidden: boolean; review_status?: string; created_at: string; user_name: string }[];
  recentUsers: { id: string; name: string; email: string; status: string; created_at: string; role_source: string }[];
  topCities: { city: string; count: number }[];
  perDay: { day: string; found: number; lost: number }[];
}

const n = (v: number) => v.toLocaleString('en-IN');

function Stat({ label, value, sub, icon: Icon, href, tone = 'slate' }: { label: string; value: number; sub?: string; icon: React.ElementType; href?: string; tone?: 'slate' | 'amber' | 'red' }) {
  const body = (
    <div className="bg-white border border-slate-200 rounded-xl p-4 h-full hover:border-slate-300 transition">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <Icon className={tone === 'red' ? 'w-4 h-4 text-red-600' : tone === 'amber' ? 'w-4 h-4 text-amber-600' : 'w-4 h-4 text-slate-400'} />
      </div>
      <p className="mt-2 text-3xl font-black text-slate-900 tabular-nums">{n(value)}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
  return href ? <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl">{body}</Link> : body;
}

function PostsChart({ data }: { data: Stats['perDay'] }) {
  const max = Math.max(1, ...data.map((d) => d.found + d.lost));
  const total = data.reduce((s, d) => s + d.found + d.lost, 0);
  return (
    <figure>
      <div className="flex items-end gap-1.5 h-40" role="img" aria-label={`Posts per day for the last 14 days, ${total} in total`}>
        {data.map((d) => {
          const label = new Date(d.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          return (
            <div key={d.day} className="flex-1 flex flex-col justify-end h-full group relative" title={`${label}: ${d.found} found, ${d.lost} lost`}>
              <div className="w-full bg-amber-400 rounded-t-sm" style={{ height: `${(d.lost / max) * 100}%` }} />
              <div className={`w-full bg-blue-600 ${d.lost ? '' : 'rounded-t-sm'}`} style={{ height: `${(d.found / max) * 100}%` }} />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-xs text-slate-500">
        <span>{new Date(data[0]?.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
        <span>Today</span>
      </div>
      <figcaption className="mt-3 flex gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-600" /> Found</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Lost</span>
      </figcaption>
    </figure>
  );
}

export default function DashboardView() {
  const { admin, can } = useAdmin();
  const { data, error, loading, reload } = useLoader(() => adminApi<Stats>('/stats'), []);

  return (
    <>
      <PageHeader title={`Hello, ${admin.name.split(' ')[0]}`} description="What’s happening on LostFound right now." />
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && (
        <div className="space-y-6">
          {data.review.pending > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <span><strong>{n(data.review.pending)} post{data.review.pending === 1 ? '' : 's'}</strong> waiting for review – not visible on the website yet.</span>
              {can('posts.review') ? (
                <Link href="/admin/review" className="font-bold underline">Open review queue</Link>
              ) : (
                <span className="text-xs">A checker or super admin needs to approve them.</span>
              )}
            </div>
          )}
          <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
            <Stat label="Live posts" value={data.items.live} sub={`${n(data.items.newThisWeek)} new this week · ${n(data.items.total)} total`} icon={Package} href="/admin/posts?visibility=visible&status=active" />
            <Stat label="Hidden posts" value={data.items.hidden} sub="Removed from the website" icon={EyeOff} href="/admin/posts?visibility=hidden" tone={data.items.hidden ? 'amber' : 'slate'} />
            <Stat label="Website users" value={data.users.total} sub={`${n(data.users.newThisWeek)} joined this week`} icon={Users} href={can('users.view') ? '/admin/users' : undefined} />
            <Stat label="Disabled users" value={data.users.disabled} icon={AlertTriangle} href={can('users.view') ? '/admin/users?status=disabled' : undefined} tone={data.users.disabled ? 'red' : 'slate'} />
            <Stat label="Pending claims" value={data.claims.pending} sub={`${n(data.claims.approved)} approved so far`} icon={Package} />
            <Stat label="Found / lost" value={data.items.found} sub={`${n(data.items.found)} found · ${n(data.items.lost)} lost`} icon={MapPin} />
            <Stat label="Closed posts" value={data.items.closed} sub="Returned or closed by the poster" icon={Package} />
            {can('messages.view') && (
              <Stat label="New messages" value={data.messages.new} sub="Contact Us inbox" icon={Inbox} href="/admin/messages?status=new" tone={data.messages.new ? 'amber' : 'slate'} />
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Posts in the last 14 days" className="lg:col-span-2">
              <PostsChart data={data.perDay} />
            </Card>
            <Card title="Top locations" actions={<Link href="/admin/posts" className="text-xs font-semibold text-blue-700 hover:underline">All posts</Link>}>
              {data.topCities.length === 0 ? (
                <p className="text-sm text-slate-500">No posts yet.</p>
              ) : (
                <ol className="space-y-2">
                  {data.topCities.map((c) => (
                    <li key={c.city}>
                      <Link href={`/admin/posts?city=${encodeURIComponent(c.city)}`} className="flex items-center justify-between gap-3 text-sm hover:text-blue-700">
                        <span className="flex items-center gap-2 min-w-0"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{c.city}</span></span>
                        <span className="font-semibold tabular-nums">{n(c.count)}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Latest posts">
              <ul className="divide-y divide-slate-100 -my-2">
                {data.recentItems.map((i) => (
                  <li key={i.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/admin/posts?search=${encodeURIComponent(i.title)}`} className="text-sm font-semibold text-slate-900 hover:text-blue-700 truncate block">{i.title}</Link>
                      <p className="text-xs text-slate-500 truncate">{i.city || i.address} · {i.user_name} · {timeAgo(i.created_at)}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Badge tone={i.type === 'found' ? 'blue' : 'amber'}>{i.type}</Badge>
                      {i.review_status === 'pending' && <Badge tone="amber">in review</Badge>}
                      {i.review_status === 'rejected' && <Badge tone="red">rejected</Badge>}
                      {i.is_hidden && <Badge tone="red">hidden</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Newest users">
              <ul className="divide-y divide-slate-100 -my-2">
                {data.recentUsers.map((u) => (
                  <li key={u.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/admin/users?search=${encodeURIComponent(u.email)}`} className="text-sm font-semibold text-slate-900 hover:text-blue-700 truncate block">{u.name}</Link>
                      <p className="text-xs text-slate-500 truncate">{u.email} · {timeAgo(u.created_at)}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Badge>{u.role_source === 'google' ? 'Google' : 'Email'}</Badge>
                      {u.status === 'disabled' && <Badge tone="red">disabled</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
              {can('users.create') && (
                <Link href="/admin/users?create=1" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline">
                  <UserPlus className="w-3.5 h-3.5" /> Create a user
                </Link>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
