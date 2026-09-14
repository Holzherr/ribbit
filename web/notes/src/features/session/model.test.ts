import { describe, expect, it } from 'vitest';
import type { Note } from '@/bridge/types';
import { sessionEndedBy } from './model';

const note = (patch: Partial<Note> & { id: string }): Note => ({
  date: '', title: '', duration: 0, summary: '', segments: [], speakerNames: {},
  status: 'recording', error: null, jots: '', enhanced: '', template: 'default', attendees: [], calendarEventID: null,
  ...patch,
});

describe('sessionEndedBy', () => {
  it('is false while the session note is still recording', () => {
    expect(sessionEndedBy('n-1', note({ id: 'n-1', status: 'recording' }))).toBe(false);
  });

  it('is true once the session note moves past recording', () => {
    expect(sessionEndedBy('n-1', note({ id: 'n-1', status: 'processing' }))).toBe(true);
  });

  it('ignores updates to notes other than the session note', () => {
    expect(sessionEndedBy('n-1', note({ id: 'n-2', status: 'ready' }))).toBe(false);
  });
});
