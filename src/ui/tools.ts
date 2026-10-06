import type { InputHandlers } from '../canvas';
import { createEmitter, type Emitter } from '../emitter';
import {
  AddStrokeCommand,
  EraseStrokesCommand,
  computePixelErase,
  findStrokesHit,
  sweepStamps,
  type Draft,
  type History,
  type StrokeStore,
  type Vec,
} from '../strokes';

export type ToolName = 'pen' | 'stroke-eraser' | 'pixel-eraser';

export const STROKE_WIDTH_RANGE = { min: 1, max: 24 } as const;

export interface ToolState {
  tool: ToolName;
  strokeWidth: number;
}

export interface ToolEvents {
  change: ToolState;
}

export interface ToolController {
  /** Hand these to attachInput(). */
  readonly handlers: InputHandlers;
  readonly tool: ToolName;
  readonly strokeWidth: number;
  /** True while a pointer gesture is in progress (undo/redo and tool switches are ignored). */
  readonly busy: boolean;
  setTool(tool: ToolName): void;
  setStrokeWidth(width: number): void;
  on: Emitter<ToolEvents>['on'];
}

export interface ToolDeps {
  store: StrokeStore;
  draft: Draft;
  history: History;
  makeId: () => string;
  /** Eraser radius in CSS px. */
  eraserRadius: number;
}

export function createToolController(deps: ToolDeps): ToolController {
  const { store, draft, history, makeId, eraserRadius } = deps;
  const events = createEmitter<ToolEvents>();
  let tool: ToolName = 'pen';
  let strokeWidth = 4;
  let busy = false;
  let lastEraser: Vec | null = null;

  const notify = (): void => events.emit('change', { tool, strokeWidth });

  const eraseAlong = (points: readonly Vec[]): void => {
    // Stamp the eraser along the path between samples so fast flicks cannot tunnel.
    const stamps: Vec[] = [];
    for (const p of points) {
      if (lastEraser) stamps.push(...sweepStamps(lastEraser, p, eraserRadius / 2));
      else stamps.push(p);
      lastEraser = p;
    }
    if (tool === 'stroke-eraser') {
      const ids = findStrokesHit(store.strokes, stamps, eraserRadius);
      if (ids.length > 0) history.execute(new EraseStrokesCommand(ids));
    } else {
      const { removeIds, added } = computePixelErase(store.strokes, stamps, eraserRadius, makeId);
      if (removeIds.length > 0) history.execute(new EraseStrokesCommand(removeIds, added));
    }
  };

  const handlers: InputHandlers = {
    start(point) {
      busy = true;
      if (tool === 'pen') {
        draft.begin(point, strokeWidth);
        return;
      }
      history.beginGroup('Erase');
      lastEraser = null;
      eraseAlong([point]);
    },
    move(points) {
      if (tool === 'pen') draft.append(points);
      else eraseAlong(points);
    },
    end() {
      busy = false;
      if (tool === 'pen') {
        const stroke = draft.finish();
        if (stroke) history.execute(new AddStrokeCommand(stroke));
      } else {
        history.commitGroup(); // the whole drag is ONE undo step
        lastEraser = null;
      }
    },
    cancel() {
      busy = false;
      if (tool === 'pen') {
        draft.cancel();
      } else {
        history.rollbackGroup();
        lastEraser = null;
      }
    },
  };

  return {
    handlers,
    get tool() {
      return tool;
    },
    get strokeWidth() {
      return strokeWidth;
    },
    get busy() {
      return busy;
    },
    setTool(next) {
      if (busy || next === tool) return;
      tool = next;
      notify();
    },
    setStrokeWidth(width) {
      strokeWidth = Math.min(STROKE_WIDTH_RANGE.max, Math.max(STROKE_WIDTH_RANGE.min, width));
      notify();
    },
    on: events.on,
  };
}