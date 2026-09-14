import type { Segment } from '@/bridge/types';
import { SpeakerChip } from '@/shared/components/ui/speaker-chip';
import { mmss } from '@/shared/utils/format';

/** One turn: timestamp column (48px, tabular), speaker chip, text. */
export function TranscriptTurn({ segment, name, onRename }: { segment: Segment; name: string; onRename?: () => void }) {
  return (
    <div className="grid grid-cols-[48px_1fr] gap-x-3 py-2">
      <span className="pt-0.5 text-[12px] tabular-nums text-muted">{mmss(segment.start)}</span>
      <div>
        <SpeakerChip speaker={segment.speaker} name={name} onClick={onRename} />
        <p className="mt-1 text-[14px] leading-relaxed text-ink" data-selectable>{segment.text}</p>
      </div>
    </div>
  );
}
