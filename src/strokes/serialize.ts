import type { Point, Stroke } from '../types';

export const FORMAT = 'calcink-canvas';
export const FORMAT_VERSION = 1;

export type DeserializeResult =
  | { ok: true; strokes: Stroke[] }
  | { ok: false; error: string };

export function serializeStrokes(strokes: readonly Stroke[]): string {
  return JSON.stringify({ format: FORMAT, version: FORMAT_VERSION, strokes });
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function parsePoint(value: unknown): Point | null {
  if (!isRecord(value)) return null;
  const { x, y, t, pressure } = value;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(t)) return null;
  const point: Point = { x, y, t };
  if (pressure !== undefined) {
    if (!isFiniteNumber(pressure) || pressure < 0 || pressure > 1) return null;
    point.pressure = pressure;
  }
  return point;
}

function parseStroke(value: unknown): Stroke | null {
  if (!isRecord(value)) return null;
  const { id, width, points } = value;
  if (typeof id !== 'string' || id === '') return null;
  if (!isFiniteNumber(width) || width <= 0) return null;
  if (!Array.isArray(points) || points.length === 0) return null;
  const parsed: Point[] = [];
  for (const raw of points) {
    const point = parsePoint(raw);
    if (!point) return null;
    parsed.push(point);
  }
  return { id, width, points: parsed };
}

/** Never throws: malformed input becomes `{ ok: false, error }`. */
export function deserializeStrokes(json: string): DeserializeResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Not valid JSON' };
  }
  if (!isRecord(data) || data.format !== FORMAT) {
    return { ok: false, error: 'Not a CalcInk canvas file' };
  }
  if (data.version !== FORMAT_VERSION) {
    return { ok: false, error: `Unsupported version: ${String(data.version)}` };
  }
  if (!Array.isArray(data.strokes)) return { ok: false, error: 'Missing strokes list' };

  const strokes: Stroke[] = [];
  const seen = new Set<string>();
  for (const raw of data.strokes) {
    const stroke = parseStroke(raw);
    if (!stroke) return { ok: false, error: `Invalid stroke at index ${strokes.length}` };
    if (seen.has(stroke.id)) return { ok: false, error: `Duplicate stroke id: ${stroke.id}` };
    seen.add(stroke.id);
    strokes.push(stroke);
  }
  return { ok: true, strokes };
}