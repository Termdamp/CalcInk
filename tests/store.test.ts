import { describe, expect, it } from 'vitest';
import { createStrokeStore, type StoreChange } from '../src/strokes';
import { makeStroke, pt } from './helpers';

const a = () => makeStroke('a', [[0, 0], [10, 0]]);
const b = () => makeStroke('b', [[0, 5], [10, 5]]);
const c = () => makeStroke('c', [[0, 9], [10, 9]]);

describe('stroke store', () => {
  it('adds and gets strokes in draw order', () => {
    const store = createStrokeStore();
    const first = a();
    store.add(first);
    store.add(b());
    expect(store.strokes.map((s) => s.id)).toEqual(['a', 'b']);
    expect(store.get('a')).toBe(first);
    expect(store.get('nope')).toBeUndefined();
  });

  it('ignores a stroke whose id already exists', () => {
    const store = createStrokeStore();
    store.add(a());
    store.add(a());
    expect(store.strokes).toHaveLength(1);
  });

  it('replaces the strokes array on every change (old snapshots stay valid)', () => {
    const store = createStrokeStore();
    const before = store.strokes;
    store.add(a());
    expect(store.strokes).not.toBe(before);
    expect(before).toHaveLength(0);
  });

  it('freezes committed strokes', () => {
    const store = createStrokeStore();
    const stroke = a();
    store.add(stroke);
    expect(() => stroke.points.push(pt(1, 1))).toThrow(TypeError);
  });

  it('remove returns original indices and insert restores the exact order', () => {
    const store = createStrokeStore();
    [a(), b(), c()].forEach((s) => store.add(s));
    const removed = store.remove(['a', 'c']);
    expect(removed.map((e) => [e.stroke.id, e.index])).toEqual([['a', 0], ['c', 2]]);
    expect(store.strokes.map((s) => s.id)).toEqual(['b']);
    store.insert(removed);
    expect(store.strokes.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('reports append=true only for pure appends', () => {
    const store = createStrokeStore();
    const changes: StoreChange[] = [];
    store.on('change', (change) => changes.push(change));
    store.add(a());
    store.add(b());
    store.remove(['a']);
    expect(changes.map((x) => x.append)).toEqual([true, true, false]);
  });

  it('clear returns everything, and insert brings it back as an append', () => {
    const store = createStrokeStore();
    store.add(a());
    store.add(b());
    const entries = store.clear();
    expect(store.strokes).toHaveLength(0);
    const changes: StoreChange[] = [];
    store.on('change', (change) => changes.push(change));
    store.insert(entries);
    expect(store.strokes.map((s) => s.id)).toEqual(['a', 'b']);
    expect(changes[0]?.append).toBe(true);
  });

  it('load replaces the document and drops duplicate ids', () => {
    const store = createStrokeStore();
    store.add(a());
    store.load([b(), b(), c()]);
    expect(store.strokes.map((s) => s.id)).toEqual(['b', 'c']);
  });
});