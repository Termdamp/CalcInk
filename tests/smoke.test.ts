import { describe, expect, it } from 'vitest';
import type { ParseResult, Stroke } from '../src/types';

const describeResult = (r: ParseResult): string => (r.ok ? String(r.value) : r.error);

describe('shared types', () => {
  it('accepts a well-formed Stroke', () => {
    const stroke: Stroke = {
      id: 's1',
      width: 4,
      points: [
        { x: 0, y: 0, t: 0 },
        { x: 10, y: 5, t: 16, pressure: 0.5 },
      ],
    };
    expect(stroke.points).toHaveLength(2);
  });

  it('narrows ParseResult via the ok discriminant', () => {
    expect(describeResult({ ok: true, value: 30 })).toBe('30');
    expect(describeResult({ ok: false, error: 'Undefined' })).toBe('Undefined');
  });
});
