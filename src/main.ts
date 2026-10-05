import './style.css';
import { attachInput, createRenderer, createViewport } from './canvas';
import { createDraft, createIdGenerator, createStrokeStore } from './strokes';
import { installHud, installPatternToggle, installPointerReadout } from './ui/debug';

const STROKE_WIDTH = 4;

const committedCanvas = document.querySelector<HTMLCanvasElement>('#committed');
const liveCanvas = document.querySelector<HTMLCanvasElement>('#live');
if (!committedCanvas || !liveCanvas) throw new Error('canvas layers missing from index.html');

const committed = createViewport(committedCanvas);
const live = createViewport(liveCanvas);
const store = createStrokeStore();
const draft = createDraft(createIdGenerator());
const renderer = createRenderer({ committed, live, store, draft });

attachInput(live, {
  start: (p) => draft.begin(p, STROKE_WIDTH),
  move: (ps) => draft.append(ps),
  end: () => {
    const stroke = draft.finish();
    if (stroke) store.add(stroke);
  },
  cancel: () => draft.cancel(),
});

renderer.renderNow();

if (import.meta.env.DEV) {
  installHud(live);
  installPatternToggle(renderer);
  installPointerReadout();
}