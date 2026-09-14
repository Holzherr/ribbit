import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from '@/shared/utils/ui-utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 font-semibold whitespace-nowrap transition-colors duration-100 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        brand: 'rounded-control bg-brand text-white hover:bg-brand-hover',
        ghost: 'rounded-control border border-line bg-surface text-ink hover:bg-line-soft',
        soft: 'rounded-control bg-line-soft text-ink hover:bg-line',
        text: 'rounded-control text-brand-ink hover:bg-brand-soft',
        danger: 'rounded-control text-danger hover:bg-rec-soft',
        quiet: 'rounded-control text-muted hover:bg-line-soft hover:text-ink',
      },
      size: {
        default: 'h-8 px-3 text-[13px] [&_svg]:size-4',
        sm: 'h-7 px-2.5 text-[12px] [&_svg]:size-3.5',
        icon: 'size-8 [&_svg]:size-4',
        'icon-sm': 'size-7 [&_svg]:size-3.5',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'brand', size: 'default' },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

/** Every action in the window. Desktop-dense: 32px default height. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, block, type = 'button', ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size, block }), className)} {...props} />
));
Button.displayName = 'Button';
