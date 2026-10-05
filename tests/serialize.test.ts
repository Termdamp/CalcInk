import { describe, expect, it } from 'vitest';
import {
  createStrokeStore,
  deserializeStrokes,
  serializeStrokes,
} from '../src/strokes';
import type { Stroke } from '../src/types';
import { makeStroke } from './helpers';

const sample: Stroke[] = [
  { id: 's1', width: 4, points: [{ x: 0, y: 0, t: 0 }, { x: 10.5, y: 5.25, t: 16, pressure: 0.5 }] },
  { id: 's2', width: 2, points: [{ x: 3, y: 3, t: 100 }] },
];

describe('serialization', () => {
  it('round-trips strokes exactly, including optional pressure', () => {
    expect(deserializeStrokes(serializeStrokes(sample))).toStrictEqual({
      ok: true,
      strokes: sample,
    });
  });

  it('round-trips through the store', () => {
    const source = createStrokeStore();
    source.add(makeStroke('x', [[0, 0], [5, 5]]));
    const target = createStrokeStore();
    expect(target.restore(source.serialize()).ok).toBe(true);
    expect(target.strokes).toStrictEqual(source.strokes);
  });

  const wrap = (strokes: unknown) =>
    JSON.stringify({ format: 'calcink-canvas', version: 1, strokes });

  it.each([
    ['garbage', 'this is not json'],
    ['null', 'null'],
    ['an array', '[]'],
    ['wrong format', JSON.stringify({ format: 'other', version: 1, strokes: [] })],
    ['future version', JSON.stringify({ format: 'calcink-canvas', version: 2, strokes: [] })],
    ['strokes not a list', JSON.stringify({ format: 'calcink-canvas', version: 1, strokes: 5 })],
    ['stroke without points', wrap([{ id: 'a', width: 2, points: [] }])],
    ['non-numeric coordinate', wrap([{ id: 'a', width: 2, points: [{ x: '1', y: 1, t: 0 }] }])],
    ['pressure out of range', wrap([{ id: 'a', width: 2, points: [{ x: 1, y: 1, t: 0, pressure: 2 }] }])],
    ['zero width', wrap([{ id: 'a', width: 0, points: [{ x: 1, y: 1, t: 0 }] }])],
    [
      'duplicate ids',
      wrap([
        { id: 'a', width: 2, points: [{ x: 1, y: 1, t: 0 }] },
        { id: 'a', width: 2, points: [{ x: 2, y: 2, t: 0 }] },
      ]),
    ],
  ])('rejects %s without throwing', (_name, input) => {
    expect(deserializeStrokes(input).ok).toBe(false);
  });

  it('leaves the document untouched when restore fails', () => {
    const store = createStrokeStore();
    store.add(makeStroke('keep', [[0, 0], [1, 1]]));
    expect(store.restore('garbage').ok).toBe(false);
    expect(store.strokes.map((s) => s.id)).toEqual(['keep']);
  });
});