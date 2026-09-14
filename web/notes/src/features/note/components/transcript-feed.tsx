import type { Note } from '@/bridge/types';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { MessageSquare } from 'lucide-react';
import { speakerLabel } from '../model';
import { TranscriptTurn } from './transcript-turn';

/** Vertical list of turns. Speaker chips are clickable to rename. Empty state when there are no segments. */
export function TranscriptFeed({ note, onRenameSpeaker }: { note: Note; onRenameSpeaker?: (speaker: string) => void }) {
  if (note.segments.length === 0) return <EmptyState icon={<MessageSquare />} title="No transcript" body={note.status === 'processing' ? 'Still transcribing.' : 'Nothing was heard in this session.'} />;
  return <div className="divide-y divide-line-soft px-6">{note.segments.map(s => <TranscriptTurn key={s.id} segment={s} name={speakerLabel(note, s.speaker)} onRename={onRenameSpeaker && (() => onRenameSpeaker(s.speaker))} />)}</div>;
}
