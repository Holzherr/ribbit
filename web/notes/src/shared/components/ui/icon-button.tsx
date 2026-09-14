import { Button, type ButtonProps } from './button';

/** A quiet 28px square button with an accessible label; icon is the child. */
export function IconButton({ label, ...props }: ButtonProps & { label: string }) {
  return <Button variant="quiet" size="icon-sm" aria-label={label} title={label} {...props} />;
}
