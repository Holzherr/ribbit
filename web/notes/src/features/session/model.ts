import type { Note } from '@/bridge/types';

/** True when a `note.updated` event for the current session's note signals the session has ended (the note left the `recording` status). */
export function sessionEndedBy(sessionNoteId: string, note: Note): boolean {
  return note.id === sessionNoteId && note.status !== 'recording';
}
