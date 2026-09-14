import { Button } from '@/shared/components/ui/button';
import { mmss } from '@/shared/utils/format';
import { cn } from '@/shared/utils/ui-utils';
import { Square } from 'lucide-react';

/** Recording banner: pulsing red dot, note title, elapsed mm:ss, 5-bar mic level, Stop. Sits above the content pane while a session runs. */
export function SessionBar({ elapsed, level, title, onStop }: { elapsed: number; level: number; title: string; onStop: () => void }) {
  const bars = Math.round(Math.min(1, Math.max(0, level)) * 5);
  return (
    <div className="flex items-center gap-3 border-b border-rec-soft bg-rec-soft/60 px-6 py-2">
      <span className="size-2.5 animate-pulse rounded-full bg-rec" />
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{title}</span>
      <span className="flex items-end gap-0.5" aria-hidden>{[1, 2, 3, 4, 5].map(i => <span key={i} className={cn('w-1 rounded-sm', i <= bars ? 'bg-rec' : 'bg-line')} style={{ height: 4 + i * 2 }} />)}</span>
      <span className="text-[13px] tabular-nums text-body">{mmss(elapsed)}</span>
      <Button variant="ghost" size="sm" onClick={onStop}><Square /> Stop</Button>
    </div>
  );
}
