import { Search, X } from 'lucide-react';

/** Rounded search field with a leading magnifier and a clear button when non-empty. 32px high. */
export function SearchInput({ value, onChange, placeholder = 'Search notes' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-faint" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-control border border-line bg-surface pl-8 pr-8 text-[13px] text-ink placeholder:text-faint focus:border-brand focus:outline-none"
      />
      {value && (
        <button type="button" aria-label="Clear" onClick={() => onChange('')} className="absolute right-1.5 top-1.5 rounded-control p-0.5 text-muted hover:bg-line-soft">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
