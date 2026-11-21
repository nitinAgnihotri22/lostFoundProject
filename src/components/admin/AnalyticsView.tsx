'use client';
// /admin/analytics – first-party analytics and the ads A/B test.
import React, { useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/admin/client';
import { EVENT_LABEL, type AnalyticsEvent } from '@/lib/monetization';
import { Badge, Card, cx, ErrorBox, PageHeader, Spinner, useLoader } from './ui';
import { useAdmin } from './AdminShell';

interface Group {
  visitorDays: number;
  pageViews: number;
  itemViews: number;
  claimStarted: number;
  claimsMade: number;
  adImpressions: number;
  claimStartRate: number | null;
  claimsPer1000Views: number | null;
}
interface Data {
  days: number;
  totals: Record<AnalyticsEvent, number>;
  visitorDays: number;
  perDay: ({ day: string } & Record<'page_view' | 'item_view' | 'item_posted' | 'claim_made' | 'ad_impression', number>)[];
  abTest: { ads: Group; holdout: Group; enoughData: boolean; holdoutPercent: number | null; adsEnabled: boolean };
  gaConfigured: boolean;
}

const n = (v: number) => v.toLocaleString('en-IN');
const pct = (v: number | null, digits = 1) => (v == null ? '–' : v.toFixed(digits));
const SERIES = ['page_view', 'item_view', 'item_posted', 'claim_made', 'ad_impression'] as const;
type Series = (typeof SERIES)[number];

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900 tabular-nums">{n(value)}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function DailyChart({ data, series }: { data: Data['perDay']; series: Series }) {
  const max = Math.max(1, ...data.map((d) => d[series]));
  const total = data.reduce((s, d) => s + d[series], 0);
  const fmt = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return (
    <figure>
      <div className="flex items-end gap-[2px] h-44" role="img" aria-label={`${EVENT_LABEL[series]} per day, ${n(total)} in total`}>
        {data.map((d) => (
          <div key={d.day} className="flex-1 h-full flex flex-col justify-end" title={`${fmt(d.day)}: ${n(d[series])}`}>
            <div className="w-full bg-blue-600 rounded-t-sm min-h-[1px]" style={{ height: `${(d[series] / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-slate-500">
        <span>{fmt(data[0]?.day)}</span>
        <span>Peak {n(max === 1 && total === 0 ? 0 : max)} a day</span>
        <span>Today</span>
      </div>
    </figure>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = Math.max(1, steps[0]?.value ?? 0);
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        return (
          <li key={s.label}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-slate-800">{s.label}</span>
              <span className="tabular-nums text-slate-900 font-semibold">
                {n(s.value)}
                {prev != null && <span className="ml-2 text-xs font-normal text-slate-500">{prev ? `${((s.value / prev) * 100).toFixed(1)}% of previous` : '–'}</span>}
              </span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${(s.value / top) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function AbTest({ ab }: { ab: Data['abTest'] }) {
  const rows: { label: string; a: string; h: string; key?: boolean }[] = [
    { label: 'Visitor-days', a: n(ab.ads.visitorDays), h: n(ab.holdout.visitorDays) },
    { label: 'Page views', a: n(ab.ads.pageViews), h: n(ab.holdout.pageViews) },
    { label: 'Item views', a: n(ab.ads.itemViews), h: n(ab.holdout.itemViews) },
    { label: 'Claim forms opened per 100 item views', a: pct(ab.ads.claimStartRate), h: pct(ab.holdout.claimStartRate), key: true },
    { label: 'Claims made per 1,000 page views', a: pct(ab.ads.claimsPer1000Views), h: pct(ab.holdout.claimsPer1000Views), key: true },
    { label: 'Ad impressions', a: n(ab.ads.adImpressions), h: '0' },
  ];
  const a = ab.ads.claimStartRate;
  const h = ab.holdout.claimStartRate;
  const drop = a != null && h != null && h > 0 ? ((h - a) / h) * 100 : null;

  let verdict: React.ReactNode;
  if (!ab.adsEnabled && !ab.ads.pageViews) verdict = <>Ads are off, so there is nothing to compare yet. Switch them on in <Link className="underline" href="/admin/ads">Ads settings</Link>.</>;
  else if (!ab.holdoutPercent) verdict = 'The no-ads group is set to 0%, so there is no comparison group. Set it to 10% in Ads settings to measure.';
  else if (!ab.enoughData) verdict = 'Not enough data yet: wait until each group has at least 300 item views before reading the difference.';
  else if (drop != null && drop > 10) verdict = <><strong>Visitors who see ads open {drop.toFixed(0)}% fewer claim forms.</strong> The plan says to remove the in-feed slot first, then re-check.</>;
  else verdict = 'No meaningful drop in claims from ads so far.';

  return (
    <>
      <p className="text-sm text-slate-700 mb-3">{verdict}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th scope="col" className="py-2 pr-4 font-semibold">Measure</th>
              <th scope="col" className="py-2 pr-4 font-semibold text-right">With ads</th>
              <th scope="col" className="py-2 font-semibold text-right">No ads ({ab.holdoutPercent ?? 0}% of visitors)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-slate-100 last:border-0">
                <th scope="row" className={cx('py-2 pr-4 text-left', r.key ? 'font-semibold text-slate-900' : 'font-normal text-slate-700')}>{r.label}</th>
                <td className="py-2 pr-4 text-right tabular-nums">{r.a}</td>
                <td className="py-2 text-right tabular-nums">{r.h}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Both groups only include visitors who allowed advertising cookies; the no-ads group is chosen at random per browser.
      </p>
    </>
  );
}

export default function AnalyticsView() {
  const { can } = useAdmin();
  const [days, setDays] = useState(30);
  const [series, setSeries] = useState<Series>('page_view');
  const { data, error, loading, reload } = useLoader(() => adminApi<Data>(`/analytics?days=${days}`), [days]);

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Analytics"
        description="Visits and actions on the website, and whether ads affect claims. Page and item views count only visitors who allowed analytics cookies; posts and claims count everyone."
        actions={
          <div role="group" aria-label="Date range" className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days === d}
                onClick={() => setDays(d)}
                className={cx('px-3 py-1.5 text-sm font-semibold rounded-md', days === d ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100')}
              >
                {d} days
              </button>
            ))}
          </div>
        }
      />

      {error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : loading || !data ? (
        <Spinner />
      ) : (
        <div className="grid gap-5">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <Tile label="Page views" value={data.totals.page_view} sub={`${n(data.visitorDays)} visitor-days`} />
            <Tile label="Item views" value={data.totals.item_view} />
            <Tile label="Items posted" value={data.totals.item_posted} sub={`${n(data.totals.post_approved)} approved, ${n(data.totals.post_rejected)} rejected`} />
            <Tile label="Claims made" value={data.totals.claim_made} />
            <Tile label="Claims approved" value={data.totals.claim_approved} />
            <Tile label="Ad impressions" value={data.totals.ad_impression} />
          </div>

          <Card
            title="Per day"
            actions={
              <select aria-label="Measure" value={series} onChange={(e) => setSeries(e.target.value as Series)} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm">
                {SERIES.map((s) => <option key={s} value={s}>{EVENT_LABEL[s]}</option>)}
              </select>
            }
          >
            <DailyChart data={data.perDay} series={series} />
          </Card>

          <div className="grid lg:grid-cols-2 gap-5">
            <Card title="From viewing to returning">
              <Funnel
                steps={[
                  { label: 'Item views', value: data.totals.item_view },
                  { label: 'Claim forms opened', value: data.totals.claim_started },
                  { label: 'Claims made', value: data.totals.claim_made },
                  { label: 'Claims approved', value: data.totals.claim_approved },
                ]}
              />
              <p className="mt-3 text-xs text-slate-500">Views and opened forms count only visitors who allowed analytics, so the first two steps undercount.</p>
            </Card>
            <Card title="Ads A/B test: do ads lower claims?" actions={data.abTest.adsEnabled ? <Badge tone="green">Ads on</Badge> : <Badge>Ads off</Badge>}>
              <AbTest ab={data.abTest} />
            </Card>
          </div>

          <p className="text-xs text-slate-500">
            Ad earnings are in your AdSense account (page RPM, revenue).{' '}
            {data.gaConfigured ? 'Google Analytics is also collecting data.' : can('ads.manage') ? <>Google Analytics is not set up – optional, in <Link className="underline" href="/admin/ads">Ads settings</Link>.</> : null}
          </p>
        </div>
      )}
    </div>
  );
}
