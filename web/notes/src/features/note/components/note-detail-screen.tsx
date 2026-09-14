import type { Bridge, Note } from '@/bridge/types';
import { Tabs } from '@/shared/components/ui/tabs';
import { useEffect, useState } from 'react';
import { renameSpeaker } from '../model';
import { NoteHeader } from './note-header';
import { SummaryView } from './summary-view';
import { TranscriptFeed } from './transcript-feed';

const TABS = [{ id: 'notes', label: 'Notes' }, { id: 'transcript', label: 'Transcript' }, { id: 'jots', label: 'Jots' }];

/** Content pane for one note: header, Notes / Transcript / Jots tabs. Loads via notes.get, follows note.updated, writes edits with notes.update. Speaker rename uses window.prompt for now. */
export function NoteDetailScreen({ bridge, id, onBack, onDeleted }: { bridge: Bridge; id: string; onBack?: () => void; onDeleted: () => void }) {
  const [note, setNote] = useState<Note | null>(null);
  const [tab, setTab] = useState('notes');

  useEffect(() => {
    let alive = true;
    setNote(null);
    bridge.call('notes.get', { id }).then(n => { if (alive) setNote(n); });
    const off = bridge.on('note.updated', n => { if (n.id === id) setNote(n); });
    return () => { alive = false; off(); };
  }, [bridge, id]);

  if (!note) return null;
  const patch = (p: Partial<Note>) => { setNote({ ...note, ...p }); void bridge.call('notes.update', { id, patch: p }); };

  return (
    <div className="flex h-full flex-col">
      <NoteHeader note={note} onBack={onBack} onTitle={t => patch({ title: t })} onCopy={what => void bridge.call('export.copy', { id, what })} onDelete={() => { void bridge.call('notes.delete', { id }).then(onDeleted); }} />
      <div className="px-6 pt-3"><Tabs items={TABS} value={tab} onChange={setTab} /></div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'notes' && <SummaryView note={note} />}
        {tab === 'transcript' && <TranscriptFeed note={note} onRenameSpeaker={s => { const name = window.prompt('Name for this speaker', note.speakerNames[s] ?? ''); if (name != null) patch({ speakerNames: renameSpeaker(note, s, name).speakerNames }); }} />}
        {tab === 'jots' && <pre className="whitespace-pre-wrap px-6 py-4 font-sans text-[14px] text-ink" data-selectable>{note.jots || 'No jots for this session.'}</pre>}
      </div>
    </div>
  );
}
