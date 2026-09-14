import type { ReactNode } from 'react';

/** Centred icon, title, one-line body and an optional action. Used when a list or a tab is empty. */
export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="text-faint [&_svg]:size-8">{icon}</div>
      <div className="text-[15px] font-bold text-ink">{title}</div>
      <div className="max-w-sm text-[13px] text-muted">{body}</div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
