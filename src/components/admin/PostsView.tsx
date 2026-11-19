'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Eye, EyeOff, ImageOff, MapPin, Search, Trash2, X, XCircle } from 'lucide-react';
import { adminApi, AdminApiError, fmtDate, qs, timeAgo } from '@/lib/admin/client';
import { searchPlaces, type PlaceResult } from '@/lib/geo';
import type { Claim, Item } from '@/types';
import { Badge, Button, Card, Empty, ErrorBox, Field, inputClass, Modal, PageHeader, Pagination, Spinner, useDebounced, useLoader, useToast } from './ui';
import { useAdmin } from './AdminShell';
import { useReviewActions } from './reviewActions';

interface AdminPost extends Item {
  isHidden: boolean;
  hiddenAt?: string;
  hiddenSource?: string;
  claimCount: number;
  poster: { id: string; name: string; email?: string; status: 'active' | 'disabled' | 'deleted'; postCount?: number; rejectedCount?: number };
  distanceKm?: number;
  reviewedAt?: string;
  reviewedByName?: string;
  reviewNoteRaw?: string;
}
export type { AdminPost };

export const REVIEW_BADGE = {
  pending: { label: 'Awaiting review', tone: 'amber' },
  approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
} as const;
interface PageData { rows: AdminPost[]; total: number; page: number; pageSize: number }

export interface PostsInitial {
  search?: string;
  city?: string;
  type?: string;
  status?: string;
  visibility?: string;
  review?: string;
  userId?: string;
}

const HIDE_REASONS = [
  'Spam or advertising',
  'Offensive or inappropriate content',
  'Prohibited or illegal item',
  'Personal information exposed in the post',
  'Duplicate post',
  'Suspected fraud or scam',
];

const STATUS_TONE = { active: 'green', claimed: 'purple', resolved: 'gray' } as const;
const STATUS_LABEL = { active: 'Open', claimed: 'Claimed', resolved: 'Closed' } as const;

function HideDialog({ count, onCancel, onConfirm, busy }: { count: number; onCancel: () => void; onConfirm: (reason: string) => void; busy: boolean }) {
  const [preset, setPreset] = useState(HIDE_REASONS[0]);
  const [custom, setCustom] = useState('');
  const reason = preset === 'other' ? custom.trim() : preset;
  return (
    <Modal
      title={count === 1 ? 'Hide this post' : `Hide ${count} posts`}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={!reason} onClick={() => onConfirm(reason)}>
            <EyeOff className="w-4 h-4" /> Hide from website
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600 mb-4">
        Hidden posts disappear from the website straight away: no listing, no detail page, no new claims or chats. The poster still sees the post in their
        profile, marked “Removed by moderator”, with the reason below. You can show it again at any time.
      </p>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-800 mb-2">Reason</legend>
        {[...HIDE_REASONS, 'other'].map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm text-slate-800">
            <input type="radio" name="hide-reason" value={r} checked={preset === r} onChange={() => setPreset(r)} className="accent-slate-900" />
            {r === 'other' ? 'Other…' : r}
          </label>
        ))}
      </fieldset>
      {preset === 'other' && (
        <div className="mt-3">
          <Field label="Your reason" required hint="The poster sees this.">
            {(p) => <input {...p} value={custom} maxLength={300} onChange={(e) => setCustom(e.target.value)} className={inputClass} />}
          </Field>
        </div>
      )}
    </Modal>
  );
}

function PlacePicker({ value, onChange }: { value: PlaceResult | null; onChange: (p: PlaceResult | null) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(q, 400);
  useEffect(() => {
    if (debounced.trim().length < 2) return setResults([]);
    const ctl = new AbortController();
    searchPlaces(debounced, ctl.signal).then(setResults).catch(() => {});
    return () => ctl.abort();
  }, [debounced]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
        <MapPin className="w-4 h-4 text-blue-700 shrink-0" />
        <span className="truncate flex-1" title={value.address}>{value.city}{value.subtitle ? `, ${value.subtitle}` : ''}</span>
        <button type="button" onClick={() => onChange(null)} aria-label="Clear place" className="text-slate-500 hover:text-slate-900"><X className="w-4 h-4" /></button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search a city, area or landmark…"
        aria-label="Place to search near"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="place-results"
        aria-autocomplete="list"
        className={inputClass}
      />
      {open && results.length > 0 && (
        <ul id="place-results" role="listbox" className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.map((r) => (
            <li key={r.id} role="option" aria-selected="false">
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(r); setQ(''); setOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-slate-50">
                <span className="block text-sm font-semibold text-slate-900">{r.city}</span>
                <span className="block text-xs text-slate-500 truncate">{r.subtitle}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PostDetail({
  id, onClose, onHide, onShow, onDelete, onApprove, onReject,
}: {
  id: string;
  onClose: () => void;
  onHide?: (p: AdminPost) => void;
  onShow?: (p: AdminPost) => void;
  onDelete?: (p: AdminPost) => void;
  onApprove?: (p: AdminPost) => void;
  onReject?: (p: AdminPost) => void;
}) {
  const { can } = useAdmin();
  const { data, error, loading } = useLoader(() => adminApi<{ post: AdminPost; claims: Claim[] }>(`/posts/${encodeURIComponent(id)}`), [id]);
  const p = data?.post;
  return (
    <Modal
      wide
      title={p ? p.title : 'Post'}
      onClose={onClose}
      footer={
        p && (
          <>
            {can('posts.delete') && onDelete && (
              <Button variant="ghost" className="text-red-700 mr-auto" onClick={() => onDelete(p)}>
                <Trash2 className="w-4 h-4" /> Delete permanently
              </Button>
            )}
            {can('posts.moderate') && onShow && onHide &&
              (p.isHidden ? (
                <Button variant="secondary" onClick={() => onShow(p)}><Eye className="w-4 h-4" /> Show on website</Button>
              ) : (
                <Button variant="secondary" className="text-red-700" onClick={() => onHide(p)}><EyeOff className="w-4 h-4" /> Hide from website</Button>
              ))}
            {can('posts.review') && onReject && p.reviewStatus === 'pending' && (
              <Button variant="danger" onClick={() => onReject(p)}><XCircle className="w-4 h-4" /> Reject</Button>
            )}
            {can('posts.review') && onApprove && p.reviewStatus !== 'approved' && (
              <Button variant="success" onClick={() => onApprove(p)}><CheckCircle2 className="w-4 h-4" /> Approve – go live</Button>
            )}
          </>
        )
      }
    >
      {loading && <Spinner />}
      {error && <ErrorBox error={error} />}
      {p && (
        <div className="space-y-5 text-sm">
          {p.reviewStatus && p.reviewStatus !== 'approved' && (
            <div className={`rounded-lg border px-3 py-2 ${p.reviewStatus === 'pending' ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-red-200 bg-red-50 text-red-900'}`}>
              {p.reviewStatus === 'pending' ? (
                <p><strong>Awaiting review.</strong> Not on the website until a checker or super admin approves it.</p>
              ) : (
                <p><strong>Rejected</strong>{p.reviewedByName ? ` by ${p.reviewedByName}` : ''}{p.reviewedAt ? ` · ${fmtDate(p.reviewedAt)}` : ''}. Reason: {p.reviewNoteRaw || '—'}</p>
              )}
            </div>
          )}
          {p.reviewStatus === 'approved' && p.reviewedAt && (
            <p className="text-xs text-slate-500">Approved{p.reviewedByName ? ` by ${p.reviewedByName}` : ''} · {fmtDate(p.reviewedAt)}</p>
          )}
          {p.isHidden && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-900">
              <p className="font-semibold">Hidden from the website {p.hiddenAt ? `· ${fmtDate(p.hiddenAt)}` : ''}</p>
              <p>Reason: {p.hiddenReason || '—'}{p.hiddenSource === 'user_disabled' ? ' (comes back automatically if the poster is re-enabled)' : ''}</p>
            </div>
          )}
          {p.images.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {p.images.map((src) => (
                <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-36 w-36 object-cover rounded-lg border border-slate-200" />
                </a>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={p.type === 'found' ? 'blue' : 'amber'}>{p.type}</Badge>
            <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
            <Badge>{p.category}</Badge>
            {p.reward ? <Badge tone="green">Reward ₹{p.reward.toLocaleString('en-IN')}</Badge> : null}
          </div>
          <p className="whitespace-pre-wrap text-slate-800">{p.description}</p>
          <dl className="grid sm:grid-cols-[9rem_1fr] gap-x-4 gap-y-2">
            <dt className="font-semibold text-slate-600">Location</dt>
            <dd>
              {p.location.address}{' '}
              <a href={`https://www.openstreetmap.org/?mlat=${p.location.lat}&mlon=${p.location.lng}#map=16/${p.location.lat}/${p.location.lng}`} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">map</a>
            </dd>
            <dt className="font-semibold text-slate-600">{p.type === 'found' ? 'Found on' : 'Lost on'}</dt>
            <dd>{fmtDate(p.occurredAt)}</dd>
            <dt className="font-semibold text-slate-600">Posted</dt>
            <dd>{fmtDate(p.createdAt)}</dd>
            <dt className="font-semibold text-slate-600">Poster</dt>
            <dd>
              <Link href={`/admin/users?search=${encodeURIComponent(p.poster.email ?? p.poster.name)}`} className="text-blue-700 underline">{p.poster.name}</Link>
              {p.poster.email && <span className="text-slate-500"> · {p.poster.email}</span>}
              {p.userPhone && <span className="text-slate-500"> · {p.userPhone}</span>}
              {p.poster.status === 'disabled' && <> <Badge tone="red">disabled</Badge></>}
              {p.poster.postCount !== undefined && (
                <span className="block text-xs text-slate-500">
                  {p.poster.postCount} post{p.poster.postCount === 1 ? '' : 's'} in total{p.poster.rejectedCount ? ` · ${p.poster.rejectedCount} rejected before` : ''}
                </span>
              )}
            </dd>
            {p.verificationQuestions && (
              <>
                <dt className="font-semibold text-slate-600">Proof questions</dt>
                <dd><ol className="list-decimal pl-5">{p.verificationQuestions.map((q) => <li key={q}>{q}</li>)}</ol></dd>
              </>
            )}
          </dl>
          <div>
            <h3 className="font-bold text-slate-900 mb-2">Claims ({data.claims.length})</h3>
            {data.claims.length === 0 ? (
              <p className="text-slate-500">No claims.</p>
            ) : (
              <ul className="space-y-2">
                {data.claims.map((c) => (
                  <li key={c.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{c.claimantName} <span className="font-normal text-slate-500">· {c.claimantEmail}</span></span>
                      <Badge tone={c.status === 'approved' ? 'green' : c.status === 'rejected' ? 'red' : 'amber'}>{c.status}</Badge>
                    </div>
                    <ol className="mt-2 list-decimal pl-5 text-slate-700">
                      <li>{c.proof1}</li>
                      <li>{c.proof2}</li>
                      <li>{c.proof3}</li>
                    </ol>
                    {c.rejectionReason && <p className="mt-1 text-xs text-slate-500">Rejected: {c.rejectionReason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function PostsView({ initial }: { initial: PostsInitial }) {
  const { can } = useAdmin();
  const toast = useToast();
  const [search, setSearch] = useState(initial.search ?? '');
  const [locMode, setLocMode] = useState<'all' | 'city' | 'near'>(initial.city ? 'city' : 'all');
  const [city, setCity] = useState(initial.city ?? '');
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [radius, setRadius] = useState(10);
  const [type, setType] = useState(initial.type ?? '');
  const [status, setStatus] = useState(initial.status ?? '');
  const [visibility, setVisibility] = useState(initial.visibility ?? '');
  const [review, setReview] = useState(initial.review ?? '');
  const [userId, setUserId] = useState(initial.userId ?? '');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [hideTarget, setHideTarget] = useState<string[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminPost | null>(null);
  const [busy, setBusy] = useState(false);
  const debouncedSearch = useDebounced(search);
  const reviewer = useReviewActions(() => {
    setDetailId(null);
    reload();
  });

  const cities = useLoader(() => adminApi<{ city: string; count: number }[]>('/posts/cities'), []);
  const query = useMemo(
    () =>
      qs({
        search: debouncedSearch.trim(),
        city: locMode === 'city' ? city : '',
        lat: locMode === 'near' && place ? place.lat : undefined,
        lng: locMode === 'near' && place ? place.lng : undefined,
        radiusKm: locMode === 'near' && place ? radius : undefined,
        type,
        status,
        visibility,
        review,
        userId,
        page,
      }),
    [debouncedSearch, locMode, city, place, radius, type, status, visibility, review, userId, page]
  );
  const firstQuery = useRef(true);
  useEffect(() => {
    // Any filter change goes back to page 1.
    if (firstQuery.current) firstQuery.current = false;
    else setPage(1);
  }, [debouncedSearch, locMode, city, place, radius, type, status, visibility, review, userId]);

  const { data, error, loading, reload } = useLoader(() => adminApi<PageData>(`/posts${query}`), [query]);
  useEffect(() => setSelected(new Set()), [query]);

  const rows = data?.rows ?? [];
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const setHidden = async (ids: string[], hide: boolean, reason?: string) => {
    setBusy(true);
    try {
      const { changed } = await adminApi<{ changed: number }>('/posts', { method: 'PATCH', json: { ids, action: hide ? 'hide' : 'show', reason } });
      toast(hide ? `${changed} post${changed === 1 ? '' : 's'} hidden from the website` : `${changed} post${changed === 1 ? '' : 's'} visible again`);
      setHideTarget(null);
      setSelected(new Set());
      setDetailId(null);
      reload();
    } catch (e) {
      toast(e instanceof AdminApiError ? e.message : 'Could not update posts', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminApi(`/posts/${encodeURIComponent(deleteTarget.id)}`, { method: 'DELETE' });
      toast('Post deleted permanently');
      setDeleteTarget(null);
      setDetailId(null);
      reload();
    } catch (e) {
      toast(e instanceof AdminApiError ? e.message : 'Could not delete', 'error');
    } finally {
      setBusy(false);
    }
  };

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const select = (value: string, onChange: (v: string) => void, label: string, options: [string, string][]) => (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  return (
    <>
      <PageHeader title="Posts" description="Every lost and found post, including hidden ones. Filter by location, then hide anything that shouldn’t be on the website." />

      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, description, address, poster…" aria-label="Search posts" className={`${inputClass} pl-9`} />
          </div>
          {select(type, setType, 'Type', [['', 'Found & lost'], ['found', 'Found'], ['lost', 'Lost']])}
          {select(visibility, setVisibility, 'Visibility', [['', 'Visible & hidden'], ['visible', 'Visible on website'], ['hidden', 'Hidden by admin']])}
          {select(status, setStatus, 'Status', [['', 'Any status'], ['active', 'Open'], ['claimed', 'Claimed'], ['resolved', 'Closed']])}
          {select(review, setReview, 'Review', [['', 'Any review state'], ['pending', 'Awaiting review'], ['approved', 'Approved'], ['rejected', 'Rejected']])}
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm" role="group" aria-label="Location filter">
            {([['all', 'All locations'], ['city', 'City'], ['near', 'Near a place']] as const).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={locMode === v} onClick={() => setLocMode(v)} className={`flex-1 rounded-md px-2 py-1.5 font-semibold ${locMode === v ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
                {l}
              </button>
            ))}
          </div>
          {locMode === 'city' && (
            <select aria-label="City" value={city} onChange={(e) => setCity(e.target.value)} className={`${inputClass} xl:col-span-2`}>
              <option value="">Choose a city…</option>
              <option value="__none__">No city recorded</option>
              {city && city !== '__none__' && !cities.data?.some((c) => c.city === city) && <option value={city}>{city}</option>}
              {cities.data?.map((c) => <option key={c.city} value={c.city}>{c.city} ({c.count})</option>)}
            </select>
          )}
          {locMode === 'near' && (
            <>
              <div className="xl:col-span-1"><PlacePicker value={place} onChange={setPlace} /></div>
              {select(String(radius), (v) => setRadius(Number(v)), 'Radius', [['2', 'Within 2 km'], ['5', 'Within 5 km'], ['10', 'Within 10 km'], ['25', 'Within 25 km'], ['50', 'Within 50 km'], ['100', 'Within 100 km']])}
            </>
          )}
        </div>
        {userId && (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            Showing posts by one user only. <button type="button" onClick={() => setUserId('')} className="font-semibold text-blue-700 underline">Show everyone’s</button>
          </p>
        )}
      </Card>

      {selected.size > 0 && can('posts.moderate') && (
        <div className="sticky top-16 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm">
          <span className="font-semibold mr-auto">{selected.size} selected</span>
          <Button size="sm" variant="secondary" onClick={() => setHidden(selectedRows.filter((r) => r.isHidden).map((r) => r.id), false)} disabled={!selectedRows.some((r) => r.isHidden)} loading={busy}>
            <Eye className="w-4 h-4" /> Show
          </Button>
          <Button size="sm" variant="danger" onClick={() => setHideTarget(selectedRows.filter((r) => !r.isHidden).map((r) => r.id))} disabled={!selectedRows.some((r) => !r.isHidden)}>
            <EyeOff className="w-4 h-4" /> Hide
          </Button>
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {error && <ErrorBox error={error} onRetry={reload} />}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden" aria-busy={loading}>
        {loading && !data ? (
          <Spinner />
        ) : locMode === 'near' && !place ? (
          <Empty title="Pick a place" body="Search for a city, area or landmark to see posts around it." />
        ) : rows.length === 0 ? (
          <Empty title="No posts match these filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Posts</caption>
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  {can('posts.moderate') && (
                    <th scope="col" className="w-10 px-4 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all on this page" className="accent-slate-900" /></th>
                  )}
                  <th scope="col" className="px-4 py-3">Post</th>
                  <th scope="col" className="px-4 py-3">Location</th>
                  <th scope="col" className="px-4 py-3">Poster</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => (
                  <tr key={p.id} className={p.isHidden ? 'bg-red-50/40' : undefined}>
                    {can('posts.moderate') && (
                      <td className="px-4 py-3"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.title}`} className="accent-slate-900" /></td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-[16rem]">
                        {p.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.images[0]} alt="" className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0" />
                        ) : (
                          <span className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><ImageOff className="w-4 h-4 text-slate-400" /></span>
                        )}
                        <div className="min-w-0">
                          <button type="button" onClick={() => setDetailId(p.id)} className="font-semibold text-slate-900 hover:text-blue-700 text-left line-clamp-1">{p.title}</button>
                          <p className="text-xs text-slate-500">
                            <Badge tone={p.type === 'found' ? 'blue' : 'amber'}>{p.type}</Badge> {p.category} · {timeAgo(p.createdAt)}
                            {p.claimCount > 0 && ` · ${p.claimCount} claim${p.claimCount === 1 ? '' : 's'}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[16rem]">
                      <p className="font-medium text-slate-800 truncate">{p.location.city || '—'}</p>
                      <p className="text-xs text-slate-500 truncate" title={p.location.address}>
                        {p.distanceKm !== undefined ? `${p.distanceKm} km away · ` : ''}{p.location.address}
                      </p>
                    </td>
                    <td className="px-4 py-3 max-w-[14rem]">
                      <p className="font-medium text-slate-800 truncate">{p.poster.name}</p>
                      <p className="text-xs text-slate-500 truncate">{p.poster.email}</p>
                      {p.poster.status !== 'active' && <Badge tone="red">{p.poster.status}</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                        {p.reviewStatus && p.reviewStatus !== 'approved' && <Badge tone={REVIEW_BADGE[p.reviewStatus].tone}>{REVIEW_BADGE[p.reviewStatus].label}</Badge>}
                        {p.isHidden ? <Badge tone="red" title={p.hiddenReason}>Hidden</Badge> : p.reviewStatus === 'approved' || !p.reviewStatus ? <Badge tone="green">Visible</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setDetailId(p.id)}>View</Button>
                      {can('posts.moderate') &&
                        (p.isHidden ? (
                          <Button size="sm" variant="secondary" onClick={() => setHidden([p.id], false)} loading={busy}><Eye className="w-3.5 h-3.5" /> Show</Button>
                        ) : (
                          <Button size="sm" variant="secondary" className="text-red-700" onClick={() => setHideTarget([p.id])}><EyeOff className="w-3.5 h-3.5" /> Hide</Button>
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

      {detailId && (
        <PostDetail
          id={detailId}
          onClose={() => setDetailId(null)}
          onHide={(p) => setHideTarget([p.id])}
          onShow={(p) => setHidden([p.id], false)}
          onDelete={(p) => setDeleteTarget(p)}
          onApprove={(p) => reviewer.approve([p.id])}
          onReject={(p) => reviewer.reject([p.id])}
        />
      )}
      {reviewer.dialog}
      {hideTarget && <HideDialog count={hideTarget.length} busy={busy} onCancel={() => setHideTarget(null)} onConfirm={(r) => setHidden(hideTarget, true, r)} />}
      {deleteTarget && (
        <Modal
          title="Delete post permanently?"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="danger" loading={busy} onClick={doDelete}><Trash2 className="w-4 h-4" /> Delete</Button>
            </>
          }
        >
          <p className="text-sm text-slate-700">
            “<strong>{deleteTarget.title}</strong>” and all its claims and chats will be deleted. This can’t be undone. To take it off the website but keep the
            record, use <strong>Hide</strong> instead.
          </p>
        </Modal>
      )}
      <p className="sr-only" aria-live="polite">{data ? `${data.total} posts` : ''}</p>
    </>
  );
}
