import './style.css';
import { attachInput, createRenderer, createViewport } from './canvas';
import { createDraft, createHistory, createIdGenerator, createStrokeStore } from './strokes';
import {
  installDocumentReadout,
  installHud,
  installLatencyProbe,
  installPatternToggle,
  installPointerReadout,
} from './ui/debug';
import { createEraserCursor } from './ui/eraserCursor';
import { createToolbar } from './ui/toolbar';
import { createToolController } from './ui/tools';

const ERASER_RADIUS = 12; // CSS px

const committedCanvas = document.querySelector<HTMLCanvasElement>('#committed');
const liveCanvas = document.querySelector<HTMLCanvasElement>('#live');
if (!committedCanvas || !liveCanvas) throw new Error('canvas layers missing from index.html');

const committed = createViewport(committedCanvas);
const live = createViewport(liveCanvas);
const makeId = createIdGenerator();
const store = createStrokeStore();
const draft = createDraft(makeId);
const history = createHistory(store, { limit: 100 });
const renderer = createRenderer({ committed, live, store, draft });
const tools = createToolController({ store, draft, history, makeId, eraserRadius: ERASER_RADIUS });

attachInput(live, tools.handlers);
createEraserCursor(tools, ERASER_RADIUS);
createToolbar({ tools, history, store });
renderer.renderNow();

if (import.meta.env.DEV) {
  installHud(live);
  installDocumentReadout(store, history);
  installPointerReadout();
  installLatencyProbe(renderer);
  installPatternToggle(renderer);
}