/** Muted uppercase day label above a group of rows. */
export function DayHeader({ label }: { label: string }) {
  return <div className="px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wide text-faint">{label}</div>;
}
