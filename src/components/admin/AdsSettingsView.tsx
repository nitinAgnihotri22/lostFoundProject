'use client';
// /admin/ads – Google AdSense + Google Analytics settings (super admin).
import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { adminApi, AdminApiError, fmtDate } from '@/lib/admin/client';
import { AD_SLOT_INFO, AD_SLOT_KEYS, type AdsSettings } from '@/lib/monetization';
import { Badge, Button, Card, ErrorBox, Field, inputClass, PageHeader, Spinner, useLoader, useToast } from './ui';

interface Data {
  saved: AdsSettings;
  effective: AdsSettings;
  updatedAt: string | null;
  env: { adsenseClient: string | null; gaId: string | null };
}

function Toggle({ id, checked, onChange, label, desc }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <label htmlFor={id} className="flex items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        <span className="block text-xs text-slate-600">{desc}</span>
      </span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 w-5 h-5 accent-slate-900 shrink-0" />
    </label>
  );
}

function Check({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {done ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-label="Done" /> : <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-label="To do" />}
      <span className={done ? 'text-slate-600' : 'text-slate-900'}>{children}</span>
    </li>
  );
}

export default function AdsSettingsView() {
  const toast = useToast();
  const { data, error, loading, reload } = useLoader(() => adminApi<Data>('/ads'), []);
  const [form, setForm] = useState<AdsSettings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data.saved);
  }, [data]);

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (loading || !data || !form) return <Spinner />;

  const set = <K extends keyof AdsSettings>(k: K, v: AdsSettings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const dirty = JSON.stringify(form) !== JSON.stringify(data.saved);
  const client = form.client || data.env.adsenseClient || '';
  const slotsSet = AD_SLOT_KEYS.filter((k) => form.slots[k]).length;

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      await adminApi('/ads', { method: 'PUT', json: { settings: form } });
      toast('Ads settings saved. The website picks them up within a minute.');
      reload();
    } catch (e) {
      if (e instanceof AdminApiError && e.field) setErrors({ [e.field]: e.message });
      toast(e instanceof Error ? e.message : 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Ads settings"
        description="Google AdSense on the public item list and item details, and optional Google Analytics. Ads load only for visitors who allow advertising cookies, and never on claims, chat, profile, sign-in or the admin panel."
        actions={
          <>
            <Button onClick={() => setForm(data.saved)} disabled={!dirty || saving}>Undo changes</Button>
            <Button variant="primary" onClick={save} loading={saving} disabled={!dirty}>Save</Button>
          </>
        }
      />

      <div className="grid gap-5">
        <Card title="Status" actions={data.effective.enabled && data.effective.client ? <Badge tone="green">Ads on</Badge> : <Badge>Ads off</Badge>}>
          <ul className="space-y-2 text-sm">
            <Check done={!!client}>AdSense publisher id added{client ? <> – <code className="text-xs">{client}</code>{!form.client && data.env.adsenseClient ? ' (from NEXT_PUBLIC_ADSENSE_CLIENT)' : ''}</> : ''}</Check>
            <Check done={!!data.effective.client}>
              <a href="/ads.txt" target="_blank" rel="noopener" className="underline">/ads.txt</a> is served automatically from the publisher id
            </Check>
            <Check done={slotsSet === AD_SLOT_KEYS.length}>Ad unit ids filled in ({slotsSet} of {AD_SLOT_KEYS.length})</Check>
            <Check done={!form.testMode}>Test mode off (turn off only after AdSense has approved the site)</Check>
            <Check done={form.enabled}>Ads switched on</Check>
          </ul>
          {data.updatedAt && <p className="mt-3 text-xs text-slate-500">Last saved {fmtDate(data.updatedAt)}</p>}
        </Card>

        <Card title="Google AdSense">
          <div className="divide-y divide-slate-100">
            <Toggle id="ads-enabled" checked={form.enabled} onChange={(v) => set('enabled', v)} label="Show ads on the website" desc="Master switch. Turn off any time – ads disappear within a minute, no deploy needed." />
            <Toggle id="ads-test" checked={form.testMode} onChange={(v) => set('testMode', v)} label="Test mode" desc="Google shows test ads that don’t earn or count clicks. Keep on until AdSense approves the site, and on staging." />
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mt-3">
            <Field label="Publisher id" hint={data.env.adsenseClient && !form.client ? `Empty = use ${data.env.adsenseClient} from the env.` : 'AdSense → Account → Settings → Account information. Starts with ca-pub-.'} error={errors.client}>
              {(p) => <input {...p} className={inputClass} placeholder="ca-pub-1234567890123456" value={form.client} onChange={(e) => set('client', e.target.value.trim())} />}
            </Field>
            <Field label="Visitors who never see ads (%)" hint="The no-ads test group. Compare claim rates on the Analytics page; set 0 to end the test." error={errors.holdoutPercent}>
              {(p) => <input {...p} type="number" min={0} max={50} className={inputClass} value={form.holdoutPercent} onChange={(e) => set('holdoutPercent', Number(e.target.value))} />}
            </Field>
          </div>
        </Card>

        <Card title="Ad units">
          <p className="text-sm text-slate-600 mb-4">
            Create one ad unit per slot in AdSense (Ads → By ad unit) and paste its <strong>data-ad-slot</strong> number here. A slot left empty shows nothing.
            Turn <strong>Auto ads off</strong> in AdSense, so Google doesn’t add ads to other pages.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {AD_SLOT_KEYS.map((k) => (
              <Field key={k} label={AD_SLOT_INFO[k].label} hint={`${AD_SLOT_INFO[k].where} ${AD_SLOT_INFO[k].size}.`} error={errors[`slots.${k}`]}>
                {(p) => (
                  <input
                    {...p}
                    inputMode="numeric"
                    className={inputClass}
                    placeholder="1234567890"
                    value={form.slots[k]}
                    onChange={(e) => set('slots', { ...form.slots, [k]: e.target.value.trim() })}
                  />
                )}
              </Field>
            ))}
            <Field label="In-feed layout key" hint="Shown in the in-feed unit’s code as data-ad-layout-key. Needed for the grid slot." error={errors.infeedLayoutKey}>
              {(p) => <input {...p} className={inputClass} placeholder="-fb+5w+4e-db+86" value={form.infeedLayoutKey} onChange={(e) => set('infeedLayoutKey', e.target.value.trim())} />}
            </Field>
            <Field label="In-feed ad after every N items" hint="Grid view only. 4–30; the plan suggests 8." error={errors.infeedEvery}>
              {(p) => <input {...p} type="number" min={4} max={30} className={inputClass} value={form.infeedEvery} onChange={(e) => set('infeedEvery', Number(e.target.value))} />}
            </Field>
          </div>
        </Card>

        <Card title="Google Analytics 4 (optional)">
          <p className="text-sm text-slate-600 mb-4">
            The admin Analytics page works without it. Add a GA4 measurement id if you also want Google’s reports; it loads only for visitors who allow analytics cookies.
          </p>
          <div className="max-w-sm">
            <Field label="Measurement id" hint={data.env.gaId && !form.gaMeasurementId ? `Empty = use ${data.env.gaId} from the env.` : 'Google Analytics → Admin → Data streams → your web stream.'} error={errors.gaMeasurementId}>
              {(p) => <input {...p} className={inputClass} placeholder="G-ABC123XYZ9" value={form.gaMeasurementId} onChange={(e) => set('gaMeasurementId', e.target.value.trim().toUpperCase())} />}
            </Field>
          </div>
        </Card>

        <Card title="Before you switch ads on">
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-700">
            <li>Apply at <a className="underline inline-flex items-center gap-0.5" href="https://adsense.google.com" target="_blank" rel="noopener">adsense.google.com <ExternalLink className="w-3 h-3" /></a> with the live domain. Privacy, Terms, About and Contact pages are already live.</li>
            <li>Paste the publisher id above and save – Google checks <code>/ads.txt</code> and the site during review.</li>
            <li>In AdSense → Brand safety → Blocking controls, block gambling, dating, loans and “recover your lost item” style advertisers.</li>
            <li>In AdSense → Privacy &amp; messaging, turn on Google’s consent message for EU/UK visitors (Google requires a certified consent tool there).</li>
            <li>After approval: create the ad units, paste their ids, turn test mode off and switch ads on.</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
