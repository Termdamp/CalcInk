import type { Point, Stroke } from '../src/types';

export const pt = (x: number, y: number, t = 0): Point => ({ x, y, t });

export const makeStroke = (
  id: string,
  coords: ReadonlyArray<readonly [number, number]>,
  width = 2,
): Stroke => ({ id, width, points: coords.map(([x, y], i) => pt(x, y, i)) });