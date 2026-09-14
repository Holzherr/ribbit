import { describe, expect, it } from 'vitest';
import { FIXTURE_NOTES } from '@/fixtures/notes';
import { renameSpeaker, speakerLabel } from './model';

describe('note model', () => {
  const note = FIXTURE_NOTES[0]!;
  it('labels speakers', () => {
    expect(speakerLabel(note, 'me')).toBe('Me');
    expect(speakerLabel(note, 's1')).toBe('Fiona');
    expect(speakerLabel(note, 's2')).toBe('Speaker 2');
  });
  it('renames without mutating', () => {
    const out = renameSpeaker(note, 's1', 'Fiona Park');
    expect(out.speakerNames.s1).toBe('Fiona Park');
    expect(note.speakerNames.s1).toBe('Fiona');
  });
  it('trims and ignores empty names', () => {
    expect(renameSpeaker(note, 's1', '   ').speakerNames.s1).toBe('Fiona');
    expect(renameSpeaker(note, 's2', ' Dan ').speakerNames.s2).toBe('Dan');
  });
});
