import { cn } from '@/shared/utils/ui-utils';

export interface TabItem { id: string; label: string }
/** Underlined tab strip. The active tab has an ink underline; others are muted. */
export function Tabs({ items, value, onChange }: { items: TabItem[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="flex gap-4 border-b border-line">
      {items.map(t => (
        <button key={t.id} role="tab" aria-selected={t.id === value} type="button" onClick={() => onChange(t.id)}
          className={cn('-mb-px border-b-2 px-1 pb-2 text-[13px] font-semibold', t.id === value ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-body')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
