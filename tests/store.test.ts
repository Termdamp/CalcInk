import { describe, expect, it, vi } from 'vitest';
import { createStrokeStore } from '../src/strokes';

const pt = (x: number, y: number, t = 0) => ({ x, y, t });

describe('stroke store', () => {
  it('commits the active stroke on end', () => {
    const store = createStrokeStore();
    store.begin(pt(0, 0), 4);
    store.append([pt(10, 10)]);
    expect(store.activeStroke?.points).toHaveLength(2);
    store.end();
    expect(store.activeStroke).toBeNull();
    expect(store.strokes).toHaveLength(1);
    expect(store.strokes[0]?.width).toBe(4);
  });

  it('drops jitter closer than the minimum distance', () => {
    const store = createStrokeStore();
    store.begin(pt(0, 0), 4);
    store.append([pt(0.1, 0.1), pt(5, 5)]);
    expect(store.activeStroke?.points).toHaveLength(2);
  });

  it('keeps a single-point stroke (a tap becomes a dot / decimal point)', () => {
    const store = createStrokeStore();
    store.begin(pt(3, 3), 4);
    store.end();
    expect(store.strokes[0]?.points).toHaveLength(1);
  });

  it('discards the active stroke on cancel', () => {
    const store = createStrokeStore();
    store.begin(pt(0, 0), 4);
    store.cancel();
    expect(store.strokes).toHaveLength(0);
    expect(store.activeStroke).toBeNull();
  });

  it('notifies once per append batch', () => {
    const store = createStrokeStore();
    const spy = vi.fn();
    store.subscribe(spy);
    store.begin(pt(0, 0), 4); // 1
    store.append([pt(10, 0), pt(20, 0), pt(30, 0)]); // 2
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('never throws when used out of order', () => {
    const store = createStrokeStore();
    expect(() => {
      store.append([pt(1, 1)]);
      store.end();
      store.cancel();
    }).not.toThrow();
  });

  it('gives each stroke a unique id', () => {
    const store = createStrokeStore();
    store.begin(pt(0, 0), 4);
    store.end();
    store.begin(pt(5, 5), 4);
    store.end();
    expect(new Set(store.strokes.map((s) => s.id)).size).toBe(2);
  });
});