'use client';
// /admin/boosts – boosts (free during launch). Checkers / super admins approve a
// person's first boost; sub admins / super admins can stop a running boost.
import React, { useState } from 'react';
import { Play, Rocket } from 'lucide-react';
import { adminApi, AdminApiError, fmtDate, qs } from '@/lib/admin/client';
import { BOOST_PACKAGES } from '@/lib/plans';
import { Badge, Button, Card, Empty, ErrorBox, Field, inputClass, Modal, PageHeader, Pagination, Spinner, useLoader, useToast } from './ui';
import { useAdmin } from './AdminShell';

interface Row {
  id: string;
  package: 'local' | 'area' | 'city';
  radiusKm: number;
  status: 'pending_review' | 'active' | 'completed' | 'cancelled' | 'rejected';
  reviewNote?: string;
  startsAt?: string;
  endsAt?: string;
  roundsTotal: number;
  roundsSent: number;
  recipientsCount: number;
  viewsCount: number;
  createdAt: string;
  item: { id: string; title: string; description: string; category: string; type: string; image: string | null; place: string; live: boolean } | null;
  user: { id: string; name: string; contact: string; joinedAt: string } | null;
}
interface Data { rows: Row[]; total: number; page: number; pageSize: number; pendingCount: number }

const TABS: { id: string; label: string }[] = [
  { id: 'pending_review', label: 'Waiting for review' },
  { id: 'active', label: 'Running' },
  { id: 'completed', label: 'Finished' },
  { id: '', label: 'All' },
];
const STATUS: Record<Row['status'], { label: string; tone: 'amber' | 'green' | 'gray' | 'red' | 'blue' }> = {
  pending_review: { label: 'Waiting for review', tone: 'amber' },
  active: { label: 'Running', tone: 'green' },
  completed: { label: 'Finished', tone: 'gray' },
  cancelled: { label: 'Stopped', tone: 'gray' },
  rejected: { label: 'Rejected', tone: 'red' },
};
const REJECT_REASONS = [
  'The post looks like spam or an advert.',
  'The text contains contact details, links or prices.',
  'The photos or description don’t show a real lost or found item.',
];

export default function BoostsView() {
  const { can } = useAdmin();
  const toast = useToast();
  const [tab, setTab] = useState('pending_review');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [reason, setReason] = useState('');
  const [running, setRunning] = useState(false);
  const { data, error, loading, reload } = useLoader(() => adminApi<Data>(`/boosts${qs({ status: tab, page })}`), [tab, page]);

  const act = async (row: Row, action: 'approve' | 'reject' | 'cancel', why?: string) => {
    if (action === 'cancel' && !confirm('Stop this boost? It is unpinned at once; alerts already sent stay sent.')) return;
    setBusy(row.id);
    try {
      await adminApi('/boosts', { method: 'PATCH', json: { id: row.id, action, reason: why } });
      toast(action === 'approve' ? 'Boost approved – alerts are going out.' : action === 'reject' ? 'Boost rejected. The poster was told why.' : 'Boost stopped.');
      setRejecting(null);
      setReason('');
      reload();
    } catch (e) {
      toast(e instanceof AdminApiError ? e.message : 'Could not update the boost', 'error');
    } finally {
      setBusy(null);
    }
  };

  const runJobs = async () => {
    setRunning(true);
    try {
      const r = await adminApi<any>('/jobs', { method: 'POST' });
      toast(r.error ? `Jobs: ${r.error}` : `Jobs ran: ${r.boosts?.alerted ?? 0} people alerted, ${r.delivered?.delivered ?? 0} notifications delivered.`, r.error ? 'error' : 'success');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not run jobs', 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Boosts"
        description="People boost a post to pin it to the top and alert others nearby (free during launch). Each person’s first boost waits here for a quick check."
        actions={can('boosts.manage') ? <Button onClick={runJobs} loading={running}><Play className="w-4 h-4" /> Run alert jobs now</Button> : undefined}
      />

      <div role="tablist" aria-label="Boost status" className="flex flex-wrap gap-1 mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => { setTab(t.id); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tab === t.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
          >
            {t.label}
            {t.id === 'pending_review' && !!data?.pendingCount && <span className="ml-1.5 px-1.5 rounded-full bg-amber-400 text-amber-950 text-xs">{data.pendingCount}</span>}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : loading || !data ? (
        <Spinner />
      ) : data.rows.length === 0 ? (
        <Card><Empty title={tab === 'pending_review' ? 'Nothing waiting for review' : 'No boosts here yet'} /></Card>
      ) : (
        <>
          <ul className="space-y-3">
            {data.rows.map((r) => (
              <li key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-4">
                {r.item?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.item.image} alt="" className="w-full md:w-28 h-40 md:h-28 rounded-lg object-cover bg-slate-100 shrink-0" />
                ) : (
                  <div className="w-full md:w-28 h-28 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Rocket className="w-6 h-6 text-slate-400" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                    <Badge tone="blue">{r.package[0].toUpperCase() + r.package.slice(1)} · {r.radiusKm} km · {BOOST_PACKAGES[r.package].durationHours / 24 >= 1 ? `${BOOST_PACKAGES[r.package].durationHours / 24} d` : `${BOOST_PACKAGES[r.package].durationHours} h`}</Badge>
                    {r.item && !r.item.live && <Badge tone="red">Post not live</Badge>}
                  </div>
                  <p className="mt-1.5 font-bold text-slate-900">{r.item?.title ?? 'Deleted post'} <span className="font-normal text-slate-500 text-sm">· {r.item?.type} · {r.item?.category} · {r.item?.place}</span></p>
                  {r.item && <p className="text-sm text-slate-600 line-clamp-2">{r.item.description}</p>}
                  <p className="mt-1 text-xs text-slate-500">
                    By {r.user?.name ?? '—'} ({r.user?.contact || 'no contact'}) · account since {fmtDate(r.user?.joinedAt, false)} · requested {fmtDate(r.createdAt)}
                  </p>
                  {r.startsAt && (
                    <p className="mt-1 text-xs text-slate-600">
                      {r.recipientsCount} alerted · {r.viewsCount} views · round {r.roundsSent}/{r.roundsTotal} · until {fmtDate(r.endsAt)}
                    </p>
                  )}
                  {r.status === 'rejected' && r.reviewNote && <p className="mt-1 text-xs text-red-700">Reason: {r.reviewNote}</p>}
                </div>
                <div className="flex md:flex-col gap-2 shrink-0">
                  {r.status === 'pending_review' && can('boosts.review') && (
                    <>
                      <Button variant="success" size="sm" loading={busy === r.id} onClick={() => act(r, 'approve')}>Approve</Button>
                      <Button variant="danger" size="sm" disabled={busy === r.id} onClick={() => { setRejecting(r); setReason(''); }}>Reject</Button>
                    </>
                  )}
                  {r.status === 'active' && can('boosts.manage') && (
                    <Button size="sm" loading={busy === r.id} onClick={() => act(r, 'cancel')}>Stop boost</Button>
                  )}
                  {r.item && <a href={`/?item=${encodeURIComponent(r.item.id)}`} target="_blank" rel="noopener" className="text-xs font-semibold text-blue-700 hover:underline text-center">View post</a>}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4"><Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} /></div>
        </>
      )}

      {rejecting && (
        <Modal
          title="Reject this boost"
          onClose={() => setRejecting(null)}
          footer={
            <>
              <Button onClick={() => setRejecting(null)}>Cancel</Button>
              <Button variant="danger" disabled={!reason.trim()} loading={busy === rejecting.id} onClick={() => act(rejecting, 'reject', reason.trim())}>Reject boost</Button>
            </>
          }
        >
          <p className="text-sm text-slate-600 mb-3">The poster sees this reason. Their post stays live; only the boost is refused.</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {REJECT_REASONS.map((r) => <button key={r} type="button" onClick={() => setReason(r)} className="px-2.5 py-1 rounded-full border border-slate-300 text-xs hover:bg-slate-50">{r}</button>)}
          </div>
          <Field label="Reason" required>
            {(p) => <textarea {...p} rows={3} maxLength={500} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
        </Modal>
      )}
    </div>
  );
}
