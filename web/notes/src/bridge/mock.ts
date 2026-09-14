import { FIXTURE_EVENTS, FIXTURE_SETTINGS } from '@/fixtures/notes';
import type { Bridge, CommandType, Commands, Events, EventType, Note, Settings } from './types';

export interface MockBridge extends Bridge {
  emit<E extends EventType>(type: E, payload: Events[E]): void;
  notes: Note[];
}

/** In-memory bridge for Storybook and tests. Answers every command from fixtures; `emit` fakes Swift events. */
export function createMockBridge(seed: Note[] = [], opts: { latency?: number } = {}): MockBridge {
  const notes: Note[] = seed.map(n => structuredClone(n));
  const handlers = new Map<EventType, Set<(p: never) => void>>();
  let settings: Settings = { ...FIXTURE_SETTINGS };
  let session: { noteId: string; startedAt: number } | null = null;
  let processingNoteId: string | null = null;   // MeetingRecorder.isProcessing: set by session.stop; the mock never finishes processing
  const wait = () => new Promise(r => setTimeout(r, opts.latency ?? 0));
  const find = (id: string) => { const n = notes.find(x => x.id === id); if (!n) throw new Error(`note ${id} not found`); return n; };

  const bridge: MockBridge = {
    notes,
    async call(type, payload) {
      await wait();
      const p = payload as never;
      const impl: { [K in CommandType]: (p: Commands[K]['payload']) => Commands[K]['reply'] } = {
        'notes.list': () => notes.map(n => ({ ...n, segments: [] })),
        'notes.get': ({ id }) => structuredClone(find(id)),
        'notes.update': ({ id, patch }) => { const n = find(id); Object.assign(n, patch); bridge.emit('note.updated', structuredClone(n)); return structuredClone(n); },
        'notes.delete': ({ id }) => { const i = notes.findIndex(x => x.id === id); if (i >= 0) notes.splice(i, 1); return 'ok'; },
        'session.start': ({ title, calendarEventID }) => {
          if (session) throw new Error("Can't start: already recording");
          if (processingNoteId) throw new Error("Can't start: still processing the last note");
          const n: Note = { id: `n-${Date.now()}`, date: new Date().toISOString(), title: title ?? 'Untitled', duration: 0, summary: '', segments: [], speakerNames: { me: 'Me' }, status: 'recording', error: null, jots: '', enhanced: '', template: 'default', attendees: [], calendarEventID: calendarEventID ?? null };
          notes.unshift(n); session = { noteId: n.id, startedAt: Date.now() };
          return { noteId: n.id };
        },
        'session.stop': () => { if (session) { const n = find(session.noteId); n.status = 'processing'; n.duration = (Date.now() - session.startedAt) / 1000; processingNoteId = n.id; session = null; bridge.emit('note.updated', structuredClone(n)); } return 'ok'; },
        'session.status': () => ({ recording: !!session, processing: processingNoteId !== null, noteId: session?.noteId ?? null, elapsed: session ? (Date.now() - session.startedAt) / 1000 : 0 }),
        'calendar.upcoming': () => FIXTURE_EVENTS,
        'calendar.authorize': () => ({ granted: true }),
        'enhance.run': ({ id, template }) => { const n = find(id); n.template = template; n.enhanced = `# ${n.title}\n\n(mock enhance with template ${template})\n\n${n.jots}`; n.status = 'ready'; bridge.emit('note.updated', structuredClone(n)); return { enhanced: n.enhanced }; },
        'chat.ask': ({ question }) => ({ answer: `Mock answer to: ${question}` }),
        'export.copy': () => 'ok',
        'settings.get': () => settings,
        'settings.set': patch => { settings = { ...settings, ...patch }; return settings; },
        'window.close': () => 'ok',
      };
      return impl[type](p) as never;
    },
    on(type, handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler as never);
      return () => { handlers.get(type)?.delete(handler as never); };
    },
    emit(type, payload) {
      handlers.get(type)?.forEach(h => (h as (p: unknown) => void)(payload));
    },
  };
  return bridge;
}
