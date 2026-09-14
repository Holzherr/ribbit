import { cn } from '@/shared/utils/ui-utils';

/** Text wordmark "ribbit" in brand green with a small dot. Sizes sm (16px) and lg (28px). Placeholder until a mark is drawn. */
export function Wordmark({ size = 'sm', className }: { size?: 'sm' | 'lg'; className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline gap-1 font-extrabold tracking-tight text-brand-ink', size === 'lg' ? 'text-[28px]' : 'text-[16px]', className)}>
      ribbit<span className="size-1.5 self-center rounded-full bg-brand" />
    </span>
  );
}
