import type { Point } from '../types';
import { clientToCanvas } from './coords';
import type { Viewport } from './viewport';

export interface InputHandlers {
  start(point: Point): void;
  move(points: Point[]): void;
  end(): void;
  cancel(): void;
}

/** After any pen activity, touch is ignored for this long (a palm resting while writing). */
const PEN_LOCKOUT_MS = 1000;
/** Touch contacts wider than this (CSS px) are treated as palms. Only helps where hardware reports it. */
const MAX_TOUCH_CONTACT = 40;

export function attachInput(viewport: Viewport, handlers: InputHandlers): () => void {
  const { canvas } = viewport;
  const abort = new AbortController();
  const opts = { signal: abort.signal };

  let activeId: number | null = null;
  let activeType = '';
  let lastPenActivity = -Infinity;

  const toPoint = (e: PointerEvent, rect: DOMRect): Point => {
    const { x, y } = clientToCanvas(e.clientX, e.clientY, rect, viewport.size);
    const point: Point = { x, y, t: e.timeStamp };
    if (e.pointerType === 'pen') point.pressure = e.pressure; // mouse/touch pressure is noise
    return point;
  };

  const looksLikePalm = (e: PointerEvent): boolean =>
    e.pointerType === 'touch' &&
    (e.timeStamp - lastPenActivity < PEN_LOCKOUT_MS ||
      Math.max(e.width, e.height) > MAX_TOUCH_CONTACT);

  const release = (e: PointerEvent): void => {
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    activeId = null;
    activeType = '';
  };

  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'pen') lastPenActivity = e.timeStamp;
      if (!e.isPrimary || e.button !== 0) return; // extra fingers, right-click, pen eraser/barrel
      if (looksLikePalm(e)) return;

      if (activeId !== null) {
        if (e.pointerType === 'pen' && activeType === 'touch') {
          handlers.cancel(); // the pen wins over an in-progress finger/palm stroke
          activeId = null;
        } else {
          return;
        }
      }

      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      activeId = e.pointerId;
      activeType = e.pointerType;
      handlers.start(toPoint(e, canvas.getBoundingClientRect()));
    },
    opts,
  );

  canvas.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'pen') lastPenActivity = e.timeStamp; // hover counts as pen activity
      if (e.pointerId !== activeId) return;
      const rect = canvas.getBoundingClientRect(); // once per event, not per coalesced sample
      // Older Safari versions lack getCoalescedEvents; fall back to the event itself.
      const coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      const samples = coalesced.length > 0 ? coalesced : [e];
      handlers.move(samples.map((s) => toPoint(s, rect)));
    },
    opts,
  );

  canvas.addEventListener(
    'pointerup',
    (e) => {
      if (e.pointerId !== activeId) return;
      handlers.move([toPoint(e, canvas.getBoundingClientRect())]);
      release(e);
      handlers.end();
    },
    opts,
  );

  canvas.addEventListener(
    'pointercancel',
    (e) => {
      if (e.pointerId !== activeId) return;
      release(e);
      handlers.cancel(); // the browser/OS took the gesture: discard the half-drawn stroke
    },
    opts,
  );

  // A long-press on touch/pen opens a context menu, which would cancel the stroke.
  canvas.addEventListener('contextmenu', (e) => e.preventDefault(), opts);

  return () => abort.abort();
}