import { describe, expect, it } from 'vitest';
import { dayLabel, initials, mmss, speakerTone } from './format';

describe('format', () => {
  it('mmss', () => {
    expect(mmss(0)).toBe('0:00');
    expect(mmss(65)).toBe('1:05');
    expect(mmss(3723)).toBe('1:02:03');
  });
  it('dayLabel', () => {
    const now = new Date('2026-09-14T12:00:00Z');
    expect(dayLabel('2026-09-14T08:00:00Z', now)).toBe('Today');
    expect(dayLabel('2026-09-13T22:00:00Z', now)).toBe('Yesterday');
    expect(dayLabel('2026-09-08T10:00:00Z', now)).toMatch(/^Tue 8 Sep$/);
  });
  it('initials', () => {
    expect(initials('Fiona Park')).toBe('FP');
    expect(initials('Me')).toBe('M');
    expect(initials('')).toBe('?');
  });
  it('speakerTone', () => {
    expect(speakerTone('me')).toBe('brand');
    expect(speakerTone('s1')).toBe('sky');
    expect(speakerTone('s2')).toBe('violet');
    expect(speakerTone('s3')).toBe('amber');
    expect(speakerTone('s9')).toBe('slate');
  });
});
