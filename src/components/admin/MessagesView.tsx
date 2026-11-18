'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, Search } from 'lucide-react';
import { adminApi, AdminApiError, fmtDate, qs, timeAgo } from '@/lib/admin/client';
import { Badge, Button, Empty, ErrorBox, Field, inputClass, Modal, PageHeader, Pagination, Spinner, useDebounced, useLoader, useToast } from './ui';
import { useAdmin } from './AdminShell';

interface Msg {
  id: string;
  reference: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  lang: string;
  user_id: string | null;
  page_url: string | null;
  status: 'new' | 'in_progress' | 'resolved' | 'spam';
  admin_note: string | null;
  created_at: string;
  updated_at: string | null;
}
interface PageData { rows: Msg[]; total: number; page: number; pageSize: number }

const STATUS: Record<Msg['status'], { label: string; tone: 'amber' | 'blue' | 'green' | 'gray' }> = {
  new: { label: 'New', tone: 'amber' },
  in_progress: { label: 'In progress', tone: 'blue' },
  resolved: { label: 'Resolved', tone: 'green' },
  spam: { label: 'Spam', tone: 'gray' },
};
const SUBJECTS: Record<string, string> = {
  general: 'General question',
  listing: 'A listing',
  claim: 'A claim',
  account: 'My account',
  accessibility: 'Accessibility',
  partnership: 'Partnership',
  other: 'Other',
};

function MessageDialog({ msg, onClose, onSaved }: { msg: Msg; onClose: () => void; onSaved: (m: Msg) => void }) {
  const { can } = useAdmin();
  const toast = useToast();
  const [status, setStatus] = useState<Msg['status']>(msg.status === 'new' ? 'in_progress' : msg.status);
  const [note, setNote] = useState(msg.admin_note ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const m = await adminApi<Msg>(`/messages/${encodeURIComponent(msg.id)}`, { method: 'PATCH', json: { status, note } });
      toast('Message updated');
      onSaved(m);
    } catch (e) {
      toast(e instanceof AdminApiError ? e.message : 'Could not save', 'error');
      setBusy(false);
    }
  };
  const replySubject = encodeURIComponent(`Re: your LostFound message ${msg.reference}`);
  return (
    <Modal
      wide
      title={`${SUBJECTS[msg.subject] ?? msg.subject} · ${msg.reference}`}
      onClose={onClose}
      footer={
        <>
          <a href={`mailto:${msg.email}?subject=${replySubject}`} className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-800 border border-slate-300 bg-white hover:bg-slate-50">
            <Mail className="w-4 h-4" /> Reply by email
          </a>
          <Button onClick={onClose}>Close</Button>
          {can('messages.manage') && <Button variant="primary" loading={busy} onClick={save}>Save</Button>}
        </>
      }
    >
      <dl className="grid sm:grid-cols-[8rem_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="font-semibold text-slate-600">From</dt>
        <dd>{msg.name} · <a className="text-blue-700 underline" href={`mailto:${msg.email}`}>{msg.email}</a>{msg.phone ? ` · ${msg.phone}` : ''}</dd>
        <dt className="font-semibold text-slate-600">Received</dt>
        <dd>{fmtDate(msg.created_at)}</dd>
        <dt className="font-semibold text-slate-600">Language</dt>
        <dd>{msg.lang === 'hi' ? 'Hindi' : 'English'}{msg.user_id ? ' · signed-in user' : ' · not signed in'}</dd>
        {msg.page_url && (<><dt className="font-semibold text-slate-600">Sent from</dt><dd className="break-all">{msg.page_url}</dd></>)}
      </dl>
      <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-900 whitespace-pre-wrap break-words">{msg.message}</div>
      {can('messages.manage') && (
        <div className="mt-4 grid gap-4 sm:grid-cols-[12rem_1fr]">
          <Field label="Status">
            {(p) => (
              <select {...p} value={status} onChange={(e) => setStatus(e.target.value as Msg['status'])} className={inputClass}>
                {Object.entries(STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
              </select>
            )}
          </Field>
          <Field label="Internal note" hint="Only admins see this.">
            {(p) => <textarea {...p} rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />}
          </Field>
        </div>
      )}
    </Modal>
  );
}

export default function MessagesView({ initial }: { initial: { status?: string } }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(initial.status ?? '');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Msg | null>(null);
  const debounced = useDebounced(search);
  const query = useMemo(() => qs({ search: debounced.trim(), status, page }), [debounced, status, page]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else setPage(1);
  }, [debounced, status]);
  const { data, error, loading, reload } = useLoader(() => adminApi<PageData>(`/messages${query}`), [query]);

  return (
    <>
      <PageHeader title="Contact messages" description="Everything sent through the Contact Us form." />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_14rem]">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, reference or text…" aria-label="Search messages" className={`${inputClass} pl-9`} />
        </div>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
        </select>
      </div>
      {error && <ErrorBox error={error} onRetry={reload} />}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden" aria-busy={loading}>
        {loading && !data ? (
          <Spinner />
        ) : !data || data.rows.length === 0 ? (
          <Empty title="No messages" body={status || search ? 'Try different filters.' : 'Messages from the Contact Us page will appear here.'} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.rows.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => setOpen(m)} className="w-full text-left px-4 py-3 hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`text-sm ${m.status === 'new' ? 'font-bold' : 'font-semibold'} text-slate-900`}>
                      {m.name} <span className="font-normal text-slate-500">· {m.email}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      <Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge>
                      {timeAgo(m.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-700">
                    <span className="font-medium">{SUBJECTS[m.subject] ?? m.subject}</span> · <span className="font-mono text-xs">{m.reference}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500 line-clamp-1">{m.message}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </section>
      {open && (
        <MessageDialog
          msg={open}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            reload();
          }}
        />
      )}
    </>
  );
}
