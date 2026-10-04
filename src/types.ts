/** A single sampled pointer position. All coordinates are CSS pixels (logical), NOT device pixels. */
export interface Point {
  x: number;
  y: number;
  /** Timestamp in ms (event.timeStamp / performance.now() clock). */
  t: number;
  /** 0..1. Mice report 0.5 while pressed; pens report real values. Absent if unknown. */
  pressure?: number;
}

/** One pen-down → pen-up gesture. The canvas's source of truth. */
export interface Stroke {
  id: string;
  points: Point[];
  /** Brush width in CSS pixels, captured at draw time. */
  width: number;
}

/** Axis-aligned bounding box in the same CSS-pixel space as Point. */
export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The closed vocabulary the recognizer may output. */
export type SymbolLabel =
  '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '+' | '-' | '×' | '÷' | '.' | '=';

export interface RecognizedSymbol {
  label: SymbolLabel;
  /** 0..1 softmax probability of the winning class. */
  confidence: number;
  bbox: BBox;
}

export type ParseError = 'Undefined' | 'Syntax';

/** Discriminated union: check `ok` first and TypeScript narrows the rest. */
export type ParseResult = { ok: true; value: number } | { ok: false; error: ParseError };

/** Async because the real work happens in a Web Worker. */
export type Recognizer = (strokes: Stroke[]) => Promise<RecognizedSymbol[]>;
export type Parser = (input: string) => ParseResult;
export interface Size {
  width: number;
  height: number;
}