import { speakerTone, type SpeakerTone } from '@/shared/utils/format';
import { cn } from '@/shared/utils/ui-utils';

const tones: Record<SpeakerTone, string> = {
  brand: 'border-brand text-brand-ink',
  sky: 'border-sky-500 text-sky-700',
  violet: 'border-violet-500 text-violet-700',
  amber: 'border-amber-500 text-amber-700',
  slate: 'border-slate-400 text-slate-600',
};
/** Outlined speaker label tinted by speaker index. Clickable when `onClick` is set (rename). */
export function SpeakerChip({ speaker, name, onClick }: { speaker: string; name: string; onClick?: () => void }) {
  const cls = cn('inline-flex h-5 items-center rounded-pill border px-2 text-[12px] font-semibold bg-surface', tones[speakerTone(speaker)], onClick && 'hover:bg-line-soft');
  return onClick ? <button type="button" className={cls} onClick={onClick} title="Rename speaker">{name}</button> : <span className={cls}>{name}</span>;
}
