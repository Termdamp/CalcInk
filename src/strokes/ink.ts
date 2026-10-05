import type { Point, Stroke } from '../types';

/** Pen pressure maps to a width factor of MIN + SCALE × pressure → 0.35 … 1.65 (0.5 → 1.0). */
const PRESSURE_FACTOR_MIN = 0.35;
const PRESSURE_FACTOR_SCALE = 1.3;

export function widthAt(stroke: Stroke, point: Point): number {
  return point.pressure === undefined
    ? stroke.width
    : stroke.width * (PRESSURE_FACTOR_MIN + PRESSURE_FACTOR_SCALE * point.pressure);
}

/** The largest half-thickness this stroke's ink can have. Used to inflate bounds and hit-tests. */
export function maxHalfWidth(stroke: Stroke): number {
  const pressureSensitive = stroke.points[0]?.pressure !== undefined;
  const factor = pressureSensitive ? PRESSURE_FACTOR_MIN + PRESSURE_FACTOR_SCALE : 1;
  return (stroke.width * factor) / 2;
}