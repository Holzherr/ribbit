import { Fragment } from 'react';

/** Renders the markdown subset the summarizer and enhancer produce: #, ## headings, - bullets, **bold**, paragraphs. Text only, no HTML. */
export function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r/g, '').split(/\n{2,}/);
  return (
    <div className="space-y-3 text-[14px] leading-relaxed text-ink" data-selectable>
      {blocks.map((b, i) => <Block key={i} text={b} />)}
    </div>
  );
}

function Block({ text }: { text: string }) {
  const lines = text.split('\n');
  if (lines.every(l => /^\s*[-*] /.test(l))) {
    return <ul className="list-disc space-y-1 pl-5">{lines.map((l, i) => <li key={i}><Inline text={l.replace(/^\s*[-*] /, '')} /></li>)}</ul>;
  }
  const h = /^(#{1,3}) (.*)$/.exec(lines[0]!);
  if (h && lines.length === 1) {
    const cls = h[1]!.length === 1 ? 'text-[17px] font-bold' : 'mt-2 text-[12px] font-bold uppercase tracking-wide text-muted';
    return <div className={cls}><Inline text={h[2]!} /></div>;
  }
  return <p>{lines.map((l, i) => <Fragment key={i}>{i > 0 && <br />}<Inline text={l} /></Fragment>)}</p>;
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>)}</>;
}
