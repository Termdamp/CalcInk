export type Listener<Payload> = (payload: Payload) => void;

export interface Emitter<Events extends object> {
  /** Subscribe to one event type. Returns an unsubscribe function. */
  on<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void;
  emit<K extends keyof Events>(type: K, payload: Events[K]): void;
}

export function createEmitter<Events extends object>(): Emitter<Events> {
  const listeners = new Map<keyof Events, Set<Listener<never>>>();

  return {
    on(type, listener) {
      const set = listeners.get(type) ?? new Set<Listener<never>>();
      listeners.set(type, set);
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },
    emit(type, payload) {
      const set = listeners.get(type);
      if (!set) return;
      // Iterate a copy: a listener may unsubscribe itself (or others) while we loop.
      for (const listener of [...set]) (listener as Listener<typeof payload>)(payload);
    },
  };
}