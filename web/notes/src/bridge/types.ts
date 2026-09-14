// Mirror of Sources/VoicePet/Store.swift (Note, Segment) plus the bridge contract in the spec.
export interface Segment { id: string; speaker: string; start: number; end: number; text: string }
export interface Attendee { name: string; email?: string }
export type NoteStatus = 'recording' | 'processing' | 'ready' | 'failed' | 'enhancing';

export interface Note {
  id: string;
  date: string;              // ISO 8601
  title: string;
  duration: number;          // seconds
  summary: string;
  segments: Segment[];
  speakerNames: Record<string, string>;
  status: NoteStatus;
  error?: string | null;
  jots: string;
  enhanced: string;
  template: string;
  attendees: Attendee[];
  calendarEventID?: string | null;
}

export interface CalendarEvent { id: string; title: string; start: string; end: string; attendees: Attendee[] }

export interface Settings {
  speechEngine: 'apple' | 'parakeet';
  summaryEngine: 'claude' | 'apple';
  hasClaudeKey: boolean;
  calendarEnabled: boolean;
  callDetection: Record<string, boolean>;   // bundle id -> on
  showFrog: boolean;
}

export interface SessionStatus { recording: boolean; processing: boolean; noteId: string | null; elapsed: number }

export interface Commands {
  'notes.list': { payload: undefined; reply: Note[] };
  'notes.get': { payload: { id: string }; reply: Note };
  'notes.update': { payload: { id: string; patch: Partial<Note> }; reply: Note };
  'notes.delete': { payload: { id: string }; reply: 'ok' };
  'session.start': { payload: { title?: string; calendarEventID?: string }; reply: { noteId: string } };
  'session.stop': { payload: undefined; reply: 'ok' };
  'session.status': { payload: undefined; reply: SessionStatus };
  'calendar.upcoming': { payload: { hours: number }; reply: CalendarEvent[] };
  'calendar.authorize': { payload: undefined; reply: { granted: boolean } };
  'enhance.run': { payload: { id: string; template: string }; reply: { enhanced: string } };
  'chat.ask': { payload: { id: string; question: string }; reply: { answer: string } };
  'export.copy': { payload: { id: string; what: 'enhanced' | 'transcript' | 'jots' }; reply: 'ok' };
  'settings.get': { payload: undefined; reply: Settings };
  'settings.set': { payload: Partial<Settings>; reply: Settings };
  'window.close': { payload: undefined; reply: 'ok' };
}

export interface Events {
  'session.tick': { noteId: string; elapsed: number; level: number };
  'transcript.segment': { noteId: string; segment: Segment };
  'note.updated': Note;
  'note.deleted': { id: string };
  'call.detected': { app: string; event?: CalendarEvent };
  'error': { message: string };
}

export type CommandType = keyof Commands;
export type EventType = keyof Events;

export interface Bridge {
  call<K extends CommandType>(type: K, payload: Commands[K]['payload']): Promise<Commands[K]['reply']>;
  on<E extends EventType>(type: E, handler: (payload: Events[E]) => void): () => void;
}

// Wire format shared with Bridge.swift.
export interface WireCommand { id: string; type: CommandType; payload?: unknown }
export interface WireReply { id: string; ok: boolean; payload?: unknown; error?: string }
export interface WireEvent { type: EventType; payload: unknown }
