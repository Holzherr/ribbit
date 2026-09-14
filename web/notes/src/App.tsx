import type { Bridge } from '@/bridge/types';
import { LibraryScreen } from '@/features/library/components/library-screen';
import { NoteDetailScreen } from '@/features/note/components/note-detail-screen';
import { SettingsScreen } from '@/features/settings/components/settings-screen';
import { useEffect, useState } from 'react';

type Route = { name: 'library' } | { name: 'settings' };

/** Window root. Sidebar is always the library; the content pane is a note, the settings screen, or the empty hint. */
export function App({ bridge }: { bridge: Bridge }) {
  const [route, setRoute] = useState<Route>({ name: 'library' });
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => bridge.on('error', e => setError(e.message)), [bridge]);

  const start = async () => {
    try { const { noteId } = await bridge.call('session.start', {}); setSelected(noteId); setRoute({ name: 'library' }); }
    catch (e) { setError((e as Error).message); }
  };

  return (
    <>
      <LibraryScreen bridge={bridge} selectedId={selected} onSelect={id => { setSelected(id); setRoute({ name: 'library' }); }} onStart={start} onSettings={() => setRoute({ name: 'settings' })}>
        {route.name === 'settings' ? <SettingsScreen bridge={bridge} onBack={() => setRoute({ name: 'library' })} />
          : selected ? <NoteDetailScreen bridge={bridge} id={selected} onDeleted={() => setSelected(null)} /> : undefined}
      </LibraryScreen>
      {error && (
        <div role="alert" className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-card bg-ink px-4 py-2 text-[13px] text-white shadow-lg" onClick={() => setError(null)}>{error}</div>
      )}
    </>
  );
}
