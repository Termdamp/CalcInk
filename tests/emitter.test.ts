import { describe, expect, it, vi } from 'vitest';
import { createEmitter } from '../src/emitter';

interface Events {
  ping: number;
  text: string;
}

describe('emitter', () => {
  it('delivers payloads only to subscribers of that event', () => {
    const emitter = createEmitter<Events>();
    const onPing = vi.fn();
    const onText = vi.fn();
    emitter.on('ping', onPing);
    emitter.on('text', onText);
    emitter.emit('ping', 7);
    expect(onPing).toHaveBeenCalledWith(7);
    expect(onText).not.toHaveBeenCalled();
  });

  it('stops delivering after unsubscribe', () => {
    const emitter = createEmitter<Events>();
    const listener = vi.fn();
    const off = emitter.on('ping', listener);
    off();
    emitter.emit('ping', 1);
    expect(listener).not.toHaveBeenCalled();
  });

  it('is safe to unsubscribe from inside a listener', () => {
    const emitter = createEmitter<Events>();
    const calls: string[] = [];
    const offA: () => void = emitter.on('ping', () => {
      calls.push('a');
      offA();
    });
    emitter.on('ping', () => calls.push('b'));
    emitter.emit('ping', 1);
    emitter.emit('ping', 2);
    expect(calls).toEqual(['a', 'b', 'b']);
  });
});