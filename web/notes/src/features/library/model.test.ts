import { describe, expect, it } from 'vitest';
import type { Note } from '@/bridge/types';
import { FIXTURE_NOTES } from '@/fixtures/notes';
import { filterNotes, groupByDay } from './model';

describe('library model', () => {
  it('filters by title, jots, enhanced, summary and transcript, case-insensitive', () => {
    expect(filterNotes(FIXTURE_NOTES, 'CAT').map(n => n.id)).toEqual(['n-ready']);
    expect(filterNotes(FIXTURE_NOTES, 'senior eng').map(n => n.id)).toEqual(['n-processing']);
    expect(filterNotes(FIXTURE_NOTES, 'vet clinics').map(n => n.id)).toEqual(['n-ready']);
    expect(filterNotes(FIXTURE_NOTES, '')).toHaveLength(3);
  });

  it('groups newest first by day label', () => {
    // Fixed ISO dates (not FIXTURE_NOTES, whose dates are relative to Date.now() at
    // import time) so this is deterministic under TZ=UTC regardless of wall-clock time.
    const base = (n: Partial<Note> & { id: string; date: string }): Note => ({
      title: '', duration: 0, summary: '', segments: [], speakerNames: {}, status: 'ready',
      error: null, jots: '', enhanced: '', template: 'default', attendees: [], calendarEventID: null,
      ...n,
    });
    const now = new Date('2026-01-10T12:00:00Z');
    const notes: Note[] = [
      base({ id: 'a', date: '2026-01-10T08:00:00Z' }), // today, earlier
      base({ id: 'b', date: '2026-01-10T10:00:00Z' }), // today, later -> sorts first
      base({ id: 'c', date: '2026-01-09T20:00:00Z' }), // yesterday
    ];

    const g = groupByDay(notes, now);

    expect(g[0]!.label).toBe('Today');
    expect(g[0]!.notes.map(n => n.id)).toEqual(['b', 'a']);
    expect(g[1]!.label).toBe('Yesterday');
    expect(g[1]!.notes.map(n => n.id)).toEqual(['c']);
  });
});
