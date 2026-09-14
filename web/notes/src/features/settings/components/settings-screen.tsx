import type { Bridge, Settings } from '@/bridge/types';
import { IconButton } from '@/shared/components/ui/icon-button';
import { cn } from '@/shared/utils/ui-utils';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-control bg-line-soft p-0.5">
      {options.map(o => <button key={o.id} type="button" onClick={() => onChange(o.id)} className={cn('rounded-[6px] px-3 py-1 text-[13px] font-semibold', o.id === value ? 'bg-surface text-ink shadow-sm' : 'text-muted')}>{o.label}</button>)}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line-soft py-3">
      <div><div className="text-[14px] font-semibold text-ink">{label}</div>{hint && <div className="text-[12px] text-muted">{hint}</div>}</div>
      {children}
    </div>
  );
}

/** Settings pane: speech engine, summary engine, Claude key status (read-only here), show-the-frog toggle. Reads settings.get, writes settings.set per change. */
export function SettingsScreen({ bridge, onBack }: { bridge: Bridge; onBack: () => void }) {
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => { bridge.call('settings.get', undefined).then(setS); }, [bridge]);
  if (!s) return null;
  const set = (patch: Partial<Settings>) => bridge.call('settings.set', patch).then(setS);
  return (
    <div className="mx-auto max-w-xl px-6 py-4">
      <div className="mb-4 flex items-center gap-2"><IconButton label="Back" onClick={onBack}><ArrowLeft /></IconButton><h1 className="text-[17px] font-bold">Settings</h1></div>
      <Row label="Speech engine" hint="Apple is instant; Parakeet is more accurate on names."><Segmented value={s.speechEngine} options={[{ id: 'apple', label: 'Apple' }, { id: 'parakeet', label: 'Parakeet' }]} onChange={v => set({ speechEngine: v })} /></Row>
      <Row label="Notes writer" hint={s.hasClaudeKey ? 'Claude key is set.' : 'No Claude key. Add one in the frog\'s Me tab, or use Apple Intelligence.'}><Segmented value={s.summaryEngine} options={[{ id: 'claude', label: 'Claude' }, { id: 'apple', label: 'Apple' }]} onChange={v => set({ summaryEngine: v })} /></Row>
      <Row label="Show the frog"><input type="checkbox" aria-label="Show the frog" checked={s.showFrog} onChange={e => set({ showFrog: e.target.checked })} /></Row>
    </div>
  );
}
