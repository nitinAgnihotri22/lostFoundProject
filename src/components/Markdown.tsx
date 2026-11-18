// Renders admin-edited Markdown (see lib/markdown.ts) inside the content-page styles.
// No hooks, so it works in both server and client components.
import React from 'react';
import { MdBlock, MdInline, parseMarkdown } from '@/lib/markdown';

function Inline({ nodes }: { nodes: MdInline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (typeof n === 'string') return <React.Fragment key={i}>{n}</React.Fragment>;
        if ('b' in n) return <strong key={i}><Inline nodes={n.b} /></strong>;
        if ('i' in n) return <em key={i}><Inline nodes={n.i} /></em>;
        const external = /^https?:\/\//i.test(n.href);
        return (
          <a key={i} href={n.href} {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}>
            <Inline nodes={n.a} />
          </a>
        );
      })}
    </>
  );
}

export default function Markdown({ source, blocks }: { source?: string; blocks?: MdBlock[] }) {
  const list = blocks ?? parseMarkdown(source ?? '');
  return (
    <div className="prose-page">
      {list.map((b, i) => {
        switch (b.t) {
          case 'h2':
            return <h2 key={i} id={b.id}>{b.text}</h2>;
          case 'h3':
            return <h3 key={i} id={b.id}>{b.text}</h3>;
          case 'p':
            return <p key={i}><Inline nodes={b.inl} /></p>;
          case 'ul':
          case 'ol': {
            const Tag = b.t;
            return (
              <Tag key={i}>
                {b.items.map((it, j) => (
                  <li key={j}><Inline nodes={it} /></li>
                ))}
              </Tag>
            );
          }
        }
      })}
    </div>
  );
}
