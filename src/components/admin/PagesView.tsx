'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bold, ExternalLink, Heading2, Link2, List, RotateCcw, Upload } from 'lucide-react';
import { adminApi, AdminApiError, fmtDate } from '@/lib/admin/client';
import { MARKDOWN_MAX_LENGTH } from '@/lib/markdown';
import type { SiteSettings } from '@/lib/siteConfig';
import Markdown from '@/components/Markdown';
import { Badge, Button, Card, cx, ErrorBox, Field, inputClass, Modal, PageHeader, Spinner, useLoader, useToast } from './ui';

type Slug = 'privacy' | 'terms' | 'about' | 'contact';
type Lang = 'en' | 'hi';
type Tab = Slug | 'company';

const TABS: { id: Tab; label: string; path?: string }[] = [
  { id: 'privacy', label: 'Privacy Policy', path: '/privacy' },
  { id: 'terms', label: 'Terms & Conditions', path: '/terms' },
  { id: 'about', label: 'About Us', path: '/about' },
  { id: 'contact', label: 'Contact Us', path: '/contact' },
  { id: 'company', label: 'Company details' },
];

interface PageData {
  slug: Slug;
  lang: Lang;
  custom: { title: string | null; body: string; updatedAt: string; updatedBy: string | null } | null;
  defaultTitle: string;
  defaultBody: string;
  help: string;
}

/** Warn before leaving the browser tab with unsaved edits. */
function useUnloadWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
}

function PageEditor({ slug, lang, path, onDirty }: { slug: Slug; lang: Lang; path: string; onDirty: (d: boolean) => void }) {
  const toast = useToast();
  const { data, error, loading, reload } = useLoader(() => adminApi<PageData>(`/pages/${slug}?lang=${lang}`), [slug, lang]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const savedTitle = data?.custom?.title ?? '';
  const savedBody = data?.custom?.body ?? data?.defaultBody ?? '';
  useEffect(() => {
    if (!data) return;
    setTitle(data.custom?.title ?? '');
    setBody(data.custom?.body ?? data.defaultBody);
    setFieldError(null);
  }, [data]);
  const dirty = !!data && (title !== savedTitle || body !== savedBody);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useUnloadWarning(dirty);

  /** Wrap the selection (or insert at the cursor) in the textarea. */
  const insert = (before: string, after = '', placeholder = '') => {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = body.slice(s, e) || placeholder;
    const next = body.slice(0, s) + before + selected + after + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  };
  const linePrefix = (prefix: string) => {
    const el = ta.current;
    if (!el) return;
    const start = body.lastIndexOf('\n', el.selectionStart - 1) + 1;
    setBody(body.slice(0, start) + prefix + body.slice(start));
    requestAnimationFrame(() => el.focus());
  };

  const loadFile = async (file: File) => {
    if (file.size > 500_000) return toast('That file is too large (max 500 KB).', 'error');
    const text = await file.text();
    setBody(text.replace(/\r\n?/g, '\n'));
    toast(`Loaded ${file.name} – review it, then Publish`);
  };

  const publish = async () => {
    setBusy(true);
    setFieldError(null);
    try {
      await adminApi(`/pages/${slug}`, { method: 'PUT', json: { lang, title, body } });
      toast('Published – the page is live');
      reload();
    } catch (e) {
      if (e instanceof AdminApiError && e.field) setFieldError(e.message);
      else toast(e instanceof Error ? e.message : 'Could not publish', 'error');
    } finally {
      setBusy(false);
    }
  };

  const revert = async () => {
    setBusy(true);
    try {
      await adminApi(`/pages/${slug}?lang=${lang}`, { method: 'DELETE' });
      toast('Back to the built-in text');
      setConfirmRevert(false);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not revert', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {data.custom ? (
          <Badge tone="green">Custom text live · updated {fmtDate(data.custom.updatedAt)}</Badge>
        ) : (
          <Badge>Showing the built-in text</Badge>
        )}
        {dirty && <Badge tone="amber">Unsaved changes</Badge>}
        <a href={path} target="_blank" rel="noopener" className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline">
          View live page <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      <p className="text-sm text-slate-600">{data.help}</p>

      <Field label="Page title" hint={`Leave empty to use “${data.defaultTitle}”.`}>
        {(p) => <input {...p} value={title} maxLength={120} placeholder={data.defaultTitle} onChange={(e) => setTitle(e.target.value)} className={inputClass} lang={lang} />}
      </Field>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <label htmlFor="page-body" className="text-sm font-semibold text-slate-800">Page text</label>
          <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Formatting">
            <Button size="sm" variant="ghost" onClick={() => linePrefix('## ')} aria-label="Section heading" title="Section heading (## )"><Heading2 className="w-4 h-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => insert('**', '**', 'bold text')} aria-label="Bold" title="Bold (**text**)"><Bold className="w-4 h-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => linePrefix('- ')} aria-label="Bullet" title="Bullet (- )"><List className="w-4 h-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => insert('[', '](https://)', 'link text')} aria-label="Link" title="Link ([text](https://…))"><Link2 className="w-4 h-4" /></Button>
            <span className="w-px h-5 bg-slate-200 mx-1" />
            <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4" /> Upload .md / .txt</Button>
            <input ref={fileRef} type="file" accept=".md,.markdown,.txt,text/plain,text/markdown" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ''; }} />
            <Button size="sm" variant={preview ? 'primary' : 'secondary'} aria-pressed={preview} onClick={() => setPreview((p) => !p)}>Preview</Button>
          </div>
        </div>
        <div className={cx('grid gap-4', preview && 'xl:grid-cols-2')}>
          <textarea
            id="page-body"
            ref={ta}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={24}
            lang={lang}
            maxLength={MARKDOWN_MAX_LENGTH}
            aria-describedby="page-body-help"
            aria-invalid={!!fieldError || undefined}
            className={`${inputClass} font-mono text-[0.8125rem] leading-relaxed`}
            spellCheck
          />
          {preview && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 max-h-[38rem] overflow-y-auto" aria-label="Preview" lang={lang}>
              <h1 className="text-2xl font-black text-slate-900 mb-4">{title || data.defaultTitle}</h1>
              <Markdown source={body} />
            </div>
          )}
        </div>
        {fieldError && <p className="mt-1 text-xs font-semibold text-red-700">{fieldError}</p>}
        <p id="page-body-help" className="mt-1 text-xs text-slate-500">
          <code>## Heading</code> starts a section · blank line between paragraphs · <code>- item</code> for bullets · <code>**bold**</code> ·{' '}
          <code>[text](https://…)</code> for links. {body.length.toLocaleString('en-IN')} / {MARKDOWN_MAX_LENGTH.toLocaleString('en-IN')} characters.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" loading={busy} onClick={publish} disabled={!dirty && !!data.custom}>Publish {lang === 'hi' ? 'Hindi' : 'English'} version</Button>
        {dirty && <Button onClick={() => { setTitle(savedTitle); setBody(savedBody); }}>Discard changes</Button>}
        {body !== data.defaultBody && <Button variant="ghost" onClick={() => setBody(data.defaultBody)}>Start from built-in text</Button>}
        {data.custom && (
          <Button variant="ghost" className="text-red-700 ml-auto" onClick={() => setConfirmRevert(true)}>
            <RotateCcw className="w-4 h-4" /> Remove custom text
          </Button>
        )}
      </div>

      {confirmRevert && (
        <Modal
          title="Remove the custom text?"
          onClose={() => setConfirmRevert(false)}
          footer={<><Button onClick={() => setConfirmRevert(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={revert}>Remove</Button></>}
        >
          <p className="text-sm text-slate-700">The {lang === 'hi' ? 'Hindi' : 'English'} page goes back to the built-in text straight away. Your custom text is deleted.</p>
        </Modal>
      )}
    </div>
  );
}

// -------------------------------------------------------------------
// Company details (site_settings)
// -------------------------------------------------------------------
type Path = string;
const get = (o: any, path: Path) => path.split('.').reduce((v, k) => v?.[k], o) ?? '';
const set = (o: any, path: Path, value: string) => {
  const copy = JSON.parse(JSON.stringify(o));
  const keys = path.split('.');
  let cur = copy;
  for (const k of keys.slice(0, -1)) cur = cur[k];
  cur[keys[keys.length - 1]] = value;
  return copy;
};

const GROUPS: { title: string; fields: [Path, string, string?][] }[] = [
  {
    title: 'Company',
    fields: [
      ['company.legalName', 'Legal name'],
      ['company.cin', 'CIN', 'Corporate Identification Number'],
      ['company.gstin', 'GSTIN'],
    ],
  },
  {
    title: 'Registered address',
    fields: [
      ['company.address.line1', 'Address line 1'],
      ['company.address.line2', 'Address line 2'],
      ['company.address.city', 'City'],
      ['company.address.state', 'State'],
      ['company.address.postalCode', 'PIN code'],
      ['company.address.country', 'Country'],
    ],
  },
  {
    title: 'Support contact (Contact Us page)',
    fields: [
      ['contact.email', 'Support email'],
      ['contact.phone', 'Support phone'],
      ['contact.hours.en', 'Support hours (English)'],
      ['contact.hours.hi', 'Support hours (Hindi)'],
      ['accessibilityContactEmail', 'Accessibility email'],
    ],
  },
  {
    title: 'Grievance Officer (IT Rules 2021 / DPDP Act 2023)',
    fields: [
      ['grievanceOfficer.name', 'Name'],
      ['grievanceOfficer.email', 'Email'],
      ['grievanceOfficer.phone', 'Phone'],
    ],
  },
  {
    title: 'Legal',
    fields: [
      ['jurisdiction.en', 'Courts with jurisdiction (English)', 'e.g. Pune, Maharashtra'],
      ['jurisdiction.hi', 'Courts with jurisdiction (Hindi)'],
      ['legalLastUpdated', '“Last updated” date for the built-in Privacy/Terms', 'YYYY-MM-DD. Custom page text shows its own publish date.'],
    ],
  },
];

function CompanyEditor({ onDirty }: { onDirty: (d: boolean) => void }) {
  const toast = useToast();
  const { data, error, loading, reload } = useLoader(
    () => adminApi<{ settings: SiteSettings; defaults: SiteSettings; customized: boolean; updatedAt: string | null }>('/settings'),
    []
  );
  const [form, setForm] = useState<SiteSettings | null>(null);
  const [fieldErr, setFieldErr] = useState<{ field: string; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => { if (data) setForm(data.settings); }, [data]);
  const dirty = !!data && !!form && JSON.stringify(form) !== JSON.stringify(data.settings);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useUnloadWarning(dirty);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFieldErr(null);
    try {
      await adminApi('/settings', { method: 'PUT', json: { settings: form } });
      toast('Company details saved – live on the website');
      reload();
    } catch (err) {
      if (err instanceof AdminApiError && err.field) setFieldErr({ field: err.field, msg: err.message });
      else toast(err instanceof Error ? err.message : 'Could not save', 'error');
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    setBusy(true);
    try {
      await adminApi('/settings', { method: 'DELETE' });
      toast('Back to the built-in details');
      setConfirmReset(false);
      reload();
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data || !form) return null;

  return (
    <form onSubmit={save} noValidate className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {data.customized ? <Badge tone="green">Saved details live · {fmtDate(data.updatedAt)}</Badge> : <Badge tone="amber">Built-in placeholder details – the site shows a “placeholder” notice until you save</Badge>}
        {dirty && <Badge tone="amber">Unsaved changes</Badge>}
      </div>
      <p className="text-sm text-slate-600">Used on Contact Us, About Us, the Privacy Policy, the Terms and the footer.</p>
      {GROUPS.map((g) => (
        <Card key={g.title} title={g.title}>
          <div className="grid gap-4 sm:grid-cols-2">
            {g.fields.map(([path, label, hint]) => (
              <Field key={path} label={label} hint={hint} error={fieldErr?.field === path ? fieldErr.msg : null}>
                {(p) => (
                  <input
                    {...p}
                    type={path === 'legalLastUpdated' ? 'date' : path.toLowerCase().includes('email') ? 'email' : 'text'}
                    lang={path.endsWith('.hi') ? 'hi' : undefined}
                    value={get(form, path)}
                    maxLength={500}
                    placeholder={get(data.defaults, path)}
                    onChange={(e) => setForm(set(form, path, e.target.value))}
                    className={inputClass}
                  />
                )}
              </Field>
            ))}
          </div>
        </Card>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" loading={busy} disabled={!dirty && data.customized}>Save company details</Button>
        {dirty && <Button onClick={() => setForm(data.settings)}>Discard changes</Button>}
        {data.customized && <Button variant="ghost" className="text-red-700 ml-auto" onClick={() => setConfirmReset(true)}><RotateCcw className="w-4 h-4" /> Reset to built-in</Button>}
      </div>
      {confirmReset && (
        <Modal title="Reset company details?" onClose={() => setConfirmReset(false)} footer={<><Button onClick={() => setConfirmReset(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={reset}>Reset</Button></>}>
          <p className="text-sm text-slate-700">The website goes back to the placeholder details in the code. Your saved details are deleted.</p>
        </Modal>
      )}
    </form>
  );
}

export default function PagesView() {
  const [tab, setTab] = useState<Tab>('privacy');
  const [lang, setLang] = useState<Lang>('en');
  const [dirty, setDirty] = useState(false);
  const guard = (fn: () => void) => () => {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    setDirty(false);
    fn();
  };
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <>
      <PageHeader title="Pages & company details" description="Edit the text of the static pages in English and Hindi. Changes go live as soon as you publish." />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Page" className="flex flex-wrap gap-1 rounded-xl bg-white border border-slate-200 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={guard(() => setTab(t.id))}
              className={cx('px-3 py-1.5 rounded-lg text-sm font-semibold', tab === t.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100')}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab !== 'company' && (
          <div role="group" aria-label="Language" className="flex rounded-xl bg-white border border-slate-200 p-1">
            {(['en', 'hi'] as const).map((l) => (
              <button key={l} type="button" aria-pressed={lang === l} onClick={guard(() => setLang(l))} className={cx('px-3 py-1.5 rounded-lg text-sm font-semibold', lang === l ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100')}>
                {l === 'en' ? 'English' : 'हिन्दी (Hindi)'}
              </button>
            ))}
          </div>
        )}
      </div>
      <div role="tabpanel" aria-label={current.label}>
        {tab === 'company' ? (
          <CompanyEditor onDirty={setDirty} />
        ) : (
          <PageEditor key={`${tab}-${lang}`} slug={tab} lang={lang} path={current.path!} onDirty={setDirty} />
        )}
      </div>
    </>
  );
}
