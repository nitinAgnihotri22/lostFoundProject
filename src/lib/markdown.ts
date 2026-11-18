// Minimal, safe Markdown for admin-edited pages (Privacy, Terms, About, Contact).
// -------------------------------------------------------------------
// Supported: "## Heading" (section, listed in the table of contents),
// "### Sub-heading", paragraphs, "- bullet" lists, "1. numbered" lists,
// **bold**, *italic* and [link text](https://…). Raw HTML is never rendered –
// everything is output as text by React, so admin input can't inject scripts.
// -------------------------------------------------------------------
import type { Block, Doc } from '@/content/types';

export type MdInline = string | { b: MdInline[] } | { i: MdInline[] } | { a: MdInline[]; href: string };

export type MdBlock =
  | { t: 'h2' | 'h3'; text: string; id: string }
  | { t: 'p'; inl: MdInline[] }
  | { t: 'ul' | 'ol'; items: MdInline[][] };

export const MARKDOWN_MAX_LENGTH = 100_000;

/** Only these link targets are allowed; anything else is shown as plain text. */
export function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(h)) return h;
  if (h.startsWith('/') && !h.startsWith('//')) return h;
  if (h.startsWith('#')) return h;
  return null;
}

export function parseInline(text: string): MdInline[] {
  const out: MdInline[] = [];
  // Order matters: links first, then bold (**), then italic (*).
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      const href = safeHref(m[2]);
      out.push(href ? { a: parseInline(m[1]), href } : m[0]);
    } else if (m[3] !== undefined) {
      out.push({ b: parseInline(m[3]) });
    } else {
      out.push({ i: parseInline(m[4]) });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);

export function parseMarkdown(src: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const used = new Set<string>();
  const uniqueId = (text: string) => {
    let base = slugify(text) || `section-${used.size + 1}`;
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };

  let para: string[] = [];
  let list: { t: 'ul' | 'ol'; items: string[] } | null = null;
  const flush = () => {
    if (para.length) blocks.push({ t: 'p', inl: parseInline(para.join(' ')) });
    if (list) blocks.push({ t: list.t, items: list.items.map(parseInline) });
    para = [];
    list = null;
  };

  for (const raw of src.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const text = h[2].trim();
      blocks.push({ t: h[1].length === 3 ? 'h3' : 'h2', text, id: uniqueId(text) });
      continue;
    }
    const ul = /^[-*•]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      const t = ul ? 'ul' : 'ol';
      if (para.length || (list && list.t !== t)) flush();
      if (!list) list = { t, items: [] };
      list.items.push((ul ?? ol)![1]);
      continue;
    }
    if (list) {
      // A plain line right after a bullet continues that bullet.
      list.items[list.items.length - 1] += ' ' + line;
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

/** Sections for the "On this page" list: every "## " heading. */
export const markdownToc = (blocks: MdBlock[]) =>
  blocks.flatMap((b) => (b.t === 'h2' ? [{ id: b.id, title: b.text, blocks: [] }] : []));

// -------------------------------------------------------------------
// Built-in content → Markdown, so the admin editor starts from the current text.
// -------------------------------------------------------------------
function blockToMarkdown(b: Block): string {
  if (typeof b === 'string') return b;
  if (Array.isArray(b)) return b.map((x) => `- ${x}`).join('\n');
  return b.dl.map(([term, desc]) => `- **${term}:** ${desc}`).join('\n');
}

export function docToMarkdown(doc: Doc): string {
  const parts: string[] = [];
  for (const b of doc.intro ?? []) parts.push(blockToMarkdown(b));
  for (const s of doc.sections) {
    parts.push(`## ${s.title}`);
    for (const b of s.blocks) parts.push(blockToMarkdown(b));
  }
  return parts.join('\n\n') + '\n';
}
