import type { Bridge, Note } from '@/bridge/types';
import { Wordmark } from '@/shared/brand/wordmark';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Mic, Settings } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NoteList } from './note-list';

/** Two-pane window: 280px sidebar (wordmark, Start button, list) and a content pane. Loads notes over the bridge and re-renders on note.updated. `children` is the content pane. */
export function LibraryScreen({ bridge, selectedId, onSelect, onStart, onSettings, children }: { bridge: Bridge; selectedId: string | null; onSelect: (id: string) => void; onStart: () => void; onSettings: () => void; children?: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    bridge.call('notes.list', undefined).then(n => { if (alive) setNotes(n); });
    const off = bridge.on('note.updated', n => setNotes(prev => prev.some(x => x.id === n.id) ? prev.map(x => x.id === n.id ? { ...n, segments: [] } : x) : [{ ...n, segments: [] }, ...prev]));
    return () => { alive = false; off(); };
  }, [bridge]);

  return (
    <div className="grid h-screen grid-cols-[280px_1fr] bg-canvas">
      <aside className="flex flex-col border-r border-line bg-surface">
        <div className="flex items-center justify-between px-4 pt-4">
          <Wordmark />
          <Button variant="quiet" size="icon-sm" aria-label="Settings" onClick={onSettings}><Settings /></Button>
        </div>
        <div className="px-3 pt-3"><Button block onClick={onStart}><Mic /> Start notes</Button></div>
        <div className="min-h-0 flex-1"><NoteList notes={notes} selectedId={selectedId} onSelect={onSelect} query={query} onQuery={setQuery} /></div>
      </aside>
      <main className="min-w-0 overflow-y-auto">
        {children ?? <EmptyState icon={<Mic />} title="Pick a note" body="Or start a session before your next call." />}
      </main>
    </div>
  );
}
