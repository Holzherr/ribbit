import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWKBridge } from './wk';

declare global { interface Window { webkit?: { messageHandlers: { ribbit: { postMessage: (m: unknown) => void } } }; ribbit?: { receive: (m: unknown) => void } } }

describe('createWKBridge', () => {
  beforeEach(() => { delete window.webkit; delete window.ribbit; });

  it('rejects without a native handler', async () => {
    const b = createWKBridge();
    await expect(b.call('notes.list', undefined)).rejects.toThrow('no native bridge');
  });

  it('posts a command and resolves on the matching reply', async () => {
    const post = vi.fn();
    window.webkit = { messageHandlers: { ribbit: { postMessage: post } } };
    const b = createWKBridge();
    const p = b.call('notes.get', { id: 'x' });
    const sent = post.mock.calls[0]![0] as { id: string; type: string; payload: unknown };
    expect(sent.type).toBe('notes.get');
    window.ribbit!.receive({ id: sent.id, ok: true, payload: { id: 'x', title: 'T' } });
    await expect(p).resolves.toMatchObject({ title: 'T' });
  });

  it('rejects on error replies and routes events', async () => {
    const post = vi.fn();
    window.webkit = { messageHandlers: { ribbit: { postMessage: post } } };
    const b = createWKBridge();
    const p = b.call('notes.get', { id: 'x' });
    const sent = post.mock.calls[0]![0] as { id: string };
    window.ribbit!.receive({ id: sent.id, ok: false, error: 'note not found' });
    await expect(p).rejects.toThrow('note not found');
    const h = vi.fn();
    b.on('error', h);
    window.ribbit!.receive({ type: 'error', payload: { message: 'boom' } });
    expect(h).toHaveBeenCalledWith({ message: 'boom' });
  });
});
