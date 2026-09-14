import type { Bridge, EventType, WireCommand, WireEvent, WireReply } from './types';

/** Production transport: WKWebView message handler up, `ribbit.receive` down. See Sources/VoicePet/Bridge.swift. */
export function createWKBridge(): Bridge {
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  const handlers = new Map<EventType, Set<(p: unknown) => void>>();
  let seq = 0;

  window.ribbit = {
    receive(msg: unknown) {
      const m = msg as Partial<WireReply & WireEvent>;
      if (typeof m.id === 'string') {
        const p = pending.get(m.id); if (!p) return; pending.delete(m.id);
        m.ok ? p.resolve(m.payload) : p.reject(new Error(m.error ?? 'bridge error'));
      } else if (typeof m.type === 'string') {
        handlers.get(m.type as EventType)?.forEach(h => h(m.payload));
      }
    },
  };

  return {
    call(type, payload) {
      const native = window.webkit?.messageHandlers?.ribbit;
      if (!native) return Promise.reject(new Error('no native bridge'));
      const id = `c${++seq}`;
      const msg: WireCommand = { id, type, payload };
      return new Promise((resolve, reject) => { pending.set(id, { resolve: resolve as (v: unknown) => void, reject }); native.postMessage(msg); });
    },
    on(type, handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler as (p: unknown) => void);
      return () => { handlers.get(type)?.delete(handler as (p: unknown) => void); };
    },
  };
}
