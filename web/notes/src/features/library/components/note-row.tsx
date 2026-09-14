import type { Note } from '@/bridge/types';
import { StatusPill } from '@/shared/components/ui/status-pill';
import { initials, mmss } from '@/shared/utils/format';
import { cn } from '@/shared/utils/ui-utils';

/** One note in the sidebar list: title, time · duration, up to three attendee initials, status pill. Selected row has a well background. */
export function NoteRow({ note, selected, onSelect }: { note: Note; selected?: boolean; onSelect: (id: string) => void }) {
  const time = new Date(note.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return (
    <button type="button" onClick={() => onSelect(note.id)} aria-current={selected ? 'true' : undefined}
      className={cn('flex w-full flex-col gap-1 rounded-card px-3 py-2.5 text-left hover:bg-line-soft', selected && 'bg-well hover:bg-well')}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{note.title}</span>
        <StatusPill status={note.status} />
      </div>
      <div className={cn('flex items-center gap-2 text-[12px] text-muted', selected && 'text-body')}>
        <span className="tabular-nums">{time}{note.duration > 0 && ` · ${mmss(note.duration)}`}</span>
        <span className="flex -space-x-1">
          {note.attendees.slice(0, 3).map(a => (
            <span key={a.name} title={a.name} className="grid size-5 place-items-center rounded-full border border-surface bg-well text-[9px] font-bold text-body">{initials(a.name)}</span>
          ))}
        </span>
      </div>
    </button>
  );
}
