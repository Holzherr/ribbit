import type { NoteStatus } from '@/bridge/types';
import { Chip } from './chip';

const map: Record<NoteStatus, { label: string; tone: 'neutral' | 'brand' | 'rec' } | null> = {
  ready: null,
  recording: { label: 'Recording', tone: 'rec' },
  processing: { label: 'Processing…', tone: 'neutral' },
  enhancing: { label: 'Enhancing…', tone: 'brand' },
  failed: { label: 'Failed', tone: 'rec' },
};
/** Chip for a note's status. Renders nothing for `ready`. Recording shows a pulsing red dot. */
export function StatusPill({ status }: { status: NoteStatus }) {
  const m = map[status];
  if (!m) return null;
  return (
    <Chip tone={m.tone}>
      {status === 'recording' && <span className="mr-1.5 size-1.5 animate-pulse rounded-full bg-rec" />}
      {m.label}
    </Chip>
  );
}
