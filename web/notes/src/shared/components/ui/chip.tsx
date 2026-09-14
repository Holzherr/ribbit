import { cn } from '@/shared/utils/ui-utils';

export type ChipTone = 'neutral' | 'brand' | 'rec';
const tones: Record<ChipTone, string> = {
  neutral: 'bg-line-soft text-body',
  brand: 'bg-brand-soft text-brand-ink',
  rec: 'bg-rec-soft text-danger',
};
/** Small rounded label. 20px high, 12px text. */
export function Chip({ tone = 'neutral', className, children }: { tone?: ChipTone; className?: string; children: React.ReactNode }) {
  return <span className={cn('inline-flex h-5 items-center rounded-pill px-2 text-[12px] font-medium', tones[tone], className)}>{children}</span>;
}
