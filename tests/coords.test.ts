import { describe, expect, it } from 'vitest';
import { clientToCanvas } from '../src/canvas/coords';

const size = { width: 800, height: 600 };

describe('clientToCanvas', () => {
  it('is the identity when the canvas fills the window', () => {
    const rect = { left: 0, top: 0, width: 800, height: 600 };
    expect(clientToCanvas(120, 340, rect, size)).toEqual({ x: 120, y: 340 });
  });

  it('subtracts the canvas offset', () => {
    const rect = { left: 100, top: 50, width: 800, height: 600 };
    expect(clientToCanvas(100, 50, rect, size)).toEqual({ x: 0, y: 0 });
    expect(clientToCanvas(250, 200, rect, size)).toEqual({ x: 150, y: 150 });
  });

  it('compensates for a canvas scaled up by CSS (transform: scale(2))', () => {
    const rect = { left: 10, top: 20, width: 1600, height: 1200 };
    expect(clientToCanvas(410, 320, rect, size)).toEqual({ x: 200, y: 150 });
  });

  it('compensates for a canvas scaled down by CSS', () => {
    const rect = { left: 0, top: 0, width: 400, height: 300 };
    expect(clientToCanvas(200, 150, rect, size)).toEqual({ x: 400, y: 300 });
  });

  it('keeps fractional precision (stylus coordinates are sub-pixel)', () => {
    const rect = { left: 10.5, top: 3.25, width: 800, height: 600 };
    expect(clientToCanvas(100.75, 50.5, rect, size)).toEqual({ x: 90.25, y: 47.25 });
  });

  it('does not clamp points outside the canvas (captured pointers can leave it)', () => {
    const rect = { left: 100, top: 50, width: 800, height: 600 };
    expect(clientToCanvas(40, 20, rect, size)).toEqual({ x: -60, y: -30 });
  });

  it('never divides by zero for a collapsed canvas', () => {
    const rect = { left: 10, top: 10, width: 0, height: 0 };
    expect(clientToCanvas(30, 40, rect, size)).toEqual({ x: 20, y: 30 });
  });
});