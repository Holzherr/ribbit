import type { Note } from '@/bridge/types';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { SearchInput } from '@/shared/components/ui/search-input';
import { FileText } from 'lucide-react';
import { filterNotes, groupByDay } from '../model';
import { DayHeader } from './day-header';
import { NoteRow } from './note-row';

/** Sidebar: search box on top, then rows grouped by day. Empty state when nothing matches. */
export function NoteList({ notes, selectedId, onSelect, query, onQuery }: { notes: Note[]; selectedId?: string | null; onSelect: (id: string) => void; query: string; onQuery: (q: string) => void }) {
  const groups = groupByDay(filterNotes(notes, query));
  return (
    <div className="flex h-full flex-col">
      <div className="p-3"><SearchInput value={query} onChange={onQuery} /></div>
      <div className="flex-1 overflow-y-auto px-1 pb-3">
        {groups.length === 0 && <EmptyState icon={<FileText />} title={query ? 'No matches' : 'No notes yet'} body={query ? 'Try another word.' : 'Start a session before a call and both sides land here.'} />}
        {groups.map(g => (
          <div key={g.label}>
            <DayHeader label={g.label} />
            {g.notes.map(n => <NoteRow key={n.id} note={n} selected={n.id === selectedId} onSelect={onSelect} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
