import type { Note } from '@/bridge/types';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Markdown } from '@/shared/components/ui/markdown';
import { Sparkles } from 'lucide-react';

/** Shows `enhanced` if present, else `summary`, else a hint. Error banner on top when `note.error` is set. */
export function SummaryView({ note }: { note: Note }) {
  const text = note.enhanced || note.summary;
  return (
    <div className="px-6 py-4">
      {note.error && <div className="mb-4 rounded-card bg-warn-soft px-3 py-2 text-[13px] text-warn">{note.error}</div>}
      {text ? <Markdown source={text} /> : <EmptyState icon={<Sparkles />} title="No notes yet" body={note.status === 'processing' ? 'Writing them now.' : 'Add a Claude key or turn on Apple Intelligence in Settings to get notes.'} />}
    </div>
  );
}
