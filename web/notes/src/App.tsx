import type { Bridge } from '@/bridge/types';
import { LibraryScreen } from '@/features/library/components/library-screen';
import { NoteDetailScreen } from '@/features/note/components/note-detail-screen';
import { SessionBar } from '@/features/session/components/session-bar';
import { sessionEndedBy } from '@/features/session/model';
import { SettingsScreen } from '@/features/settings/components/settings-screen';
import { useEffect, useState } from 'react';

type Route = { name: 'library' } | { name: 'settings' };
type Session = { noteId: string; elapsed: number; level: number; title: string };

/** Window root. Sidebar is always the library; the content pane is a note, the settings screen, or the empty hint. */
export function App({ bridge }: { bridge: Bridge }) {
  const [route, setRoute] = useState<Route>({ name: 'library' });
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => bridge.on('error', e => setError(e.message)), [bridge]);

  // Recover a session already recording when the window opens (e.g. reopened mid-call).
  useEffect(() => {
    let alive = true;
    bridge.call('session.status', undefined).then(async s => {
      if (!alive || !s.recording || !s.noteId) return;
      const note = await bridge.call('notes.get', { id: s.noteId });
      if (alive) setSession({ noteId: s.noteId, elapsed: s.elapsed, level: 0, title: note.title });
    });
    return () => { alive = false; };
  }, [bridge]);

  useEffect(() => bridge.on('session.tick', t => setSession(prev => prev && prev.noteId === t.noteId ? { ...prev, elapsed: t.elapsed, level: t.level } : prev)), [bridge]);

  useEffect(() => bridge.on('note.updated', n => setSession(prev => prev && sessionEndedBy(prev.noteId, n) ? null : prev)), [bridge]);

  useEffect(() => bridge.on('note.deleted', ({ id }) => setSelected(prev => prev === id ? null : prev)), [bridge]);

  const start = async () => {
    try {
      const { noteId } = await bridge.call('session.start', {});
      const note = await bridge.call('notes.get', { id: noteId });
      setSession({ noteId, elapsed: 0, level: 0, title: note.title });
      setSelected(noteId);
      setRoute({ name: 'library' });
    }
    catch (e) { setError((e as Error).message); }
  };

  return (
    <>
      <LibraryScreen
        bridge={bridge}
        selectedId={selected}
        onSelect={id => { setSelected(id); setRoute({ name: 'library' }); }}
        onStart={start}
        onSettings={() => setRoute({ name: 'settings' })}
        banner={session && <SessionBar elapsed={session.elapsed} level={session.level} title={session.title} onStop={() => bridge.call('session.stop', undefined)} />}
      >
        {route.name === 'settings' ? <SettingsScreen bridge={bridge} onBack={() => setRoute({ name: 'library' })} />
          : selected ? <NoteDetailScreen bridge={bridge} id={selected} onDeleted={() => setSelected(null)} /> : undefined}
      </LibraryScreen>
      {error && (
        <div role="alert" className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-card bg-ink px-4 py-2 text-[13px] text-white shadow-lg" onClick={() => setError(null)}>{error}</div>
      )}
    </>
  );
}
