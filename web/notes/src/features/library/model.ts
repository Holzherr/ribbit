import type { Note } from '@/bridge/types';
import { dayLabel } from '@/shared/utils/format';

export function filterNotes(notes: Note[], query: string): Note[] {
  const q = query.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter(n => [n.title, n.jots, n.enhanced, n.summary, ...n.segments.map(s => s.text)].some(t => t.toLowerCase().includes(q)));
}

export function groupByDay(notes: Note[], now: Date = new Date()): { label: string; notes: Note[] }[] {
  const sorted = [...notes].sort((a, b) => b.date.localeCompare(a.date));
  const out: { label: string; notes: Note[] }[] = [];
  for (const n of sorted) {
    const label = dayLabel(n.date, now);
    const last = out[out.length - 1];
    if (last && last.label === label) last.notes.push(n); else out.push({ label, notes: [n] });
  }
  return out;
}
