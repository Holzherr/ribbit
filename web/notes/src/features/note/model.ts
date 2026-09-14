import type { Note } from '@/bridge/types';

export function speakerLabel(note: Note, speaker: string): string {
  const n = note.speakerNames[speaker];
  if (n) return n;
  if (speaker === 'me') return 'Me';
  return `Speaker ${speaker.replace(/^s/, '')}`;
}

export function renameSpeaker(note: Note, speaker: string, name: string): Note {
  const t = name.trim();
  if (!t) return note;
  return { ...note, speakerNames: { ...note.speakerNames, [speaker]: t } };
}
