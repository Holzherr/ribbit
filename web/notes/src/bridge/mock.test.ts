import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_NOTES } from '@/fixtures/notes';
import { createMockBridge } from './mock';

describe('createMockBridge', () => {
  it('lists seeded notes without segments', async () => {
    const b = createMockBridge(FIXTURE_NOTES);
    const list = await b.call('notes.list', undefined);
    expect(list).toHaveLength(3);
    expect(list[0].segments).toEqual([]);
  });

  it('gets a full note and applies patches', async () => {
    const b = createMockBridge(FIXTURE_NOTES);
    const full = await b.call('notes.get', { id: 'n-ready' });
    expect(full.segments).toHaveLength(4);
    const updated = await b.call('notes.update', { id: 'n-ready', patch: { title: 'Renamed' } });
    expect(updated.title).toBe('Renamed');
    expect((await b.call('notes.get', { id: 'n-ready' })).title).toBe('Renamed');
  });

  it('rejects unknown ids', async () => {
    const b = createMockBridge([]);
    await expect(b.call('notes.get', { id: 'nope' })).rejects.toThrow('not found');
  });

  it('delivers emitted events and unsubscribes', () => {
    const b = createMockBridge([]);
    const h = vi.fn();
    const off = b.on('error', h);
    b.emit('error', { message: 'x' });
    off();
    b.emit('error', { message: 'y' });
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('starts and stops a session', async () => {
    const b = createMockBridge([]);
    const { noteId } = await b.call('session.start', { title: 'T' });
    expect((await b.call('session.status', undefined)).recording).toBe(true);
    await b.call('session.stop', undefined);
    expect((await b.call('notes.get', { id: noteId })).status).toBe('processing');
  });

  it('rejects session.start while recording or while the last note is processing', async () => {
    const b = createMockBridge([]);
    await b.call('session.start', {});
    await expect(b.call('session.start', {})).rejects.toThrow("Can't start: already recording");
    await b.call('session.stop', undefined);
    expect((await b.call('session.status', undefined)).processing).toBe(true);
    await expect(b.call('session.start', {})).rejects.toThrow("Can't start: still processing the last note");
  });

  it('does not report processing just because a seeded note has a processing status', async () => {
    const b = createMockBridge(FIXTURE_NOTES);
    expect((await b.call('session.status', undefined)).processing).toBe(false);
  });
});
