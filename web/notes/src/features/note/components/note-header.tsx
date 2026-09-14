import type { Note } from '@/bridge/types';
import { Button } from '@/shared/components/ui/button';
import { IconButton } from '@/shared/components/ui/icon-button';
import { mmss } from '@/shared/utils/format';
import { ArrowLeft, Copy, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const CONFIRM_MS = 3000;

/** Top of the detail pane: back arrow, editable title (contentEditable-free: an input styled as text), date · duration · attendees, then Copy and Delete on the right. Delete takes two clicks: the trash button turns into a red "Delete?" button for 3 s, and only that second click calls `onDelete`. */
export function NoteHeader({ note, onBack, onTitle, onCopy, onDelete }: { note: Note; onBack?: () => void; onTitle: (t: string) => void; onCopy: (what: 'enhanced' | 'transcript' | 'jots') => void; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => window.clearTimeout(t);
  }, [confirming]);

  const date = new Date(note.date).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex items-start gap-3 border-b border-line px-6 py-4">
      {onBack && <IconButton label="Back" onClick={onBack}><ArrowLeft /></IconButton>}
      <div className="min-w-0 flex-1">
        <input value={note.title} onChange={e => onTitle(e.target.value)} aria-label="Title"
          className="w-full bg-transparent text-[17px] font-bold text-ink outline-none focus:bg-well rounded-control px-1 -mx-1" />
        <div className="mt-0.5 text-[12px] text-muted tabular-nums">{date}{note.duration > 0 && ` · ${mmss(note.duration)}`}{note.attendees.length > 0 && ` · ${note.attendees.map(a => a.name).join(', ')}`}</div>
      </div>
      <Button variant="soft" size="sm" onClick={() => onCopy(note.enhanced ? 'enhanced' : 'transcript')}><Copy /> Copy</Button>
      {confirming
        ? <Button variant="danger" size="sm" title="Click again to delete" autoFocus onClick={() => { setConfirming(false); onDelete(); }}><Trash2 /> Delete?</Button>
        : <IconButton label="Delete note" onClick={() => setConfirming(true)}><Trash2 /></IconButton>}
    </div>
  );
}
