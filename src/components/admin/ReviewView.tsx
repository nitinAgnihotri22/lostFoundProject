'use client';
// Maker-checker review queue: every new website post waits here until a
// checker or super admin approves it. Oldest first, so nobody waits too long.
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ImageOff, MapPin, XCircle } from 'lucide-react';
import { adminApi, fmtDate, qs, timeAgo } from '@/lib/admin/client';
import { Badge, Button, cx, Empty, ErrorBox, PageHeader, Pagination, Spinner, useLoader } from './ui';
import { PostDetail, REVIEW_BADGE, type AdminPost } from './PostsView';
import { useReviewActions } from './reviewActions';

type Tab = 'pending' | 'rejected' | 'approved';
const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'pending', label: 'Awaiting review', hint: 'New posts, oldest first. Nothing here is on the website yet.' },
  { id: 'rejected', label: 'Rejected', hint: 'Posts that were turned down. You can still approve one if it was rejected by mistake.' },
  { id: 'approved', label: 'Recently approved', hint: 'Live posts, most recently posted first.' },
];

export default function ReviewView() {
  const [tab, setTab] = useState<Tab>('pending');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const query = useMemo(() => qs({ review: tab, order: tab === 'pending' ? 'oldest' : undefined, page, pageSize: 20 }), [tab, page]);
  const { data, error, loading, reload } = useLoader(
    () => adminApi<{ rows: AdminPost[]; total: number; page: number; pageSize: number }>(`/posts${query}`),
    [query]
  );
  const actions = useReviewActions(() => {
    setSelected(new Set());
    setDetailId(null);
    reload();
    window.dispatchEvent(new Event('lf-admin:review-changed'));
  });
  useEffect(() => setSelected(new Set()), [query]);

  const rows = data?.rows ?? [];
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <>
      <PageHeader
        title="Review queue"
        description="Maker-checker: every new post from the website waits here. It goes live only after a checker or super admin approves it."
      />

      <div role="tablist" aria-label="Review state" className="mb-3 inline-flex flex-wrap gap-1 rounded-xl bg-white border border-slate-200 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => { setTab(t.id); setPage(1); }}
            className={cx('px-3 py-1.5 rounded-lg text-sm font-semibold', tab === t.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100')}
          >
            {t.label}
            {t.id === 'pending' && tab === 'pending' && data ? ` (${data.total})` : ''}
          </button>
        ))}
      </div>
      <p className="mb-4 text-sm text-slate-600">{current.hint}</p>

      {tab !== 'approved' && rows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <label className="inline-flex items-center gap-2 font-semibold text-slate-700">
            <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} className="accent-slate-900" />
            Select all on this page
          </label>
          {selected.size > 0 && (
            <>
              <span className="text-slate-500">· {selected.size} selected</span>
              <Button size="sm" variant="success" loading={actions.busy} onClick={() => actions.approve(Array.from(selected))}><CheckCircle2 className="w-4 h-4" /> Approve selected</Button>
              {tab === 'pending' && <Button size="sm" variant="danger" onClick={() => actions.reject(Array.from(selected))}><XCircle className="w-4 h-4" /> Reject selected</Button>}
            </>
          )}
        </div>
      )}

      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && !data ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl">
          <Empty title={tab === 'pending' ? 'All caught up' : 'Nothing here'} body={tab === 'pending' ? 'No posts are waiting for review.' : undefined} />
        </div>
      ) : (
        <ul className="space-y-3" aria-busy={loading}>
          {rows.map((p) => (
            <li key={p.id} className={cx('bg-white border rounded-xl p-4', selected.has(p.id) ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200')}>
              <div className="flex gap-4">
                {tab !== 'approved' && (
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.title}`} className="mt-1 accent-slate-900 shrink-0" />
                )}
                <div className="flex gap-2 shrink-0">
                  {p.images.length ? (
                    p.images.slice(0, 2).map((src) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={src} src={src} alt="" className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover border border-slate-200" />
                    ))
                  ) : (
                    <span className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-slate-100 flex flex-col items-center justify-center text-xs text-slate-500 gap-1">
                      <ImageOff className="w-5 h-5" /> No photo
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={p.type === 'found' ? 'blue' : 'amber'}>{p.type}</Badge>
                    <Badge>{p.category}</Badge>
                    {p.reviewStatus && <Badge tone={REVIEW_BADGE[p.reviewStatus].tone}>{REVIEW_BADGE[p.reviewStatus].label}</Badge>}
                    {p.isHidden && <Badge tone="red">Hidden</Badge>}
                    <span className="text-xs text-slate-500">posted {timeAgo(p.createdAt)}</span>
                  </div>
                  <button type="button" onClick={() => setDetailId(p.id)} className="mt-1 block text-left font-bold text-slate-900 hover:text-blue-700">{p.title}</button>
                  <p className="mt-0.5 text-sm text-slate-700 line-clamp-2">{p.description}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 truncate"><MapPin className="w-3.5 h-3.5 shrink-0" /> {p.location.address}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    By <span className="font-semibold text-slate-700">{p.poster.name}</span>{p.poster.email ? ` · ${p.poster.email}` : ''}
                    {p.poster.postCount !== undefined && ` · ${p.poster.postCount} post${p.poster.postCount === 1 ? '' : 's'}`}
                    {p.poster.rejectedCount ? <span className="text-red-700 font-semibold"> · {p.poster.rejectedCount} rejected before</span> : null}
                    {p.poster.status === 'disabled' && <span className="text-red-700 font-semibold"> · account disabled</span>}
                  </p>
                  {p.reviewStatus === 'rejected' && (
                    <p className="mt-1 text-xs text-red-800">Rejected{p.reviewedByName ? ` by ${p.reviewedByName}` : ''} {fmtDate(p.reviewedAt)}: {p.reviewNoteRaw}</p>
                  )}
                  {p.reviewStatus === 'approved' && p.reviewedAt && (
                    <p className="mt-1 text-xs text-emerald-800">Approved{p.reviewedByName ? ` by ${p.reviewedByName}` : ''} {fmtDate(p.reviewedAt)}</p>
                  )}
                </div>
                <div className="hidden sm:flex flex-col gap-2 shrink-0">
                  {p.reviewStatus !== 'approved' && (
                    <Button size="sm" variant="success" loading={actions.busy} onClick={() => actions.approve([p.id])}><CheckCircle2 className="w-4 h-4" /> Approve</Button>
                  )}
                  {p.reviewStatus === 'pending' && (
                    <Button size="sm" variant="secondary" className="text-red-700" onClick={() => actions.reject([p.id])}><XCircle className="w-4 h-4" /> Reject</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setDetailId(p.id)}>Full details</Button>
                </div>
              </div>
              {/* Phones: actions under the card */}
              <div className="sm:hidden mt-3 flex gap-2">
                {p.reviewStatus !== 'approved' && <Button size="sm" variant="success" className="flex-1" onClick={() => actions.approve([p.id])}>Approve</Button>}
                {p.reviewStatus === 'pending' && <Button size="sm" variant="secondary" className="flex-1 text-red-700" onClick={() => actions.reject([p.id])}>Reject</Button>}
                <Button size="sm" variant="ghost" onClick={() => setDetailId(p.id)}>Details</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && (
        <div className="mt-3 bg-white border border-slate-200 rounded-xl">
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      )}

      {detailId && (
        <PostDetail id={detailId} onClose={() => setDetailId(null)} onApprove={(p) => actions.approve([p.id])} onReject={(p) => actions.reject([p.id])} />
      )}
      {actions.dialog}
    </>
  );
}
