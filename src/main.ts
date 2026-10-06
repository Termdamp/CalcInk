import './style.css';
import { attachInput, createRenderer, createViewport } from './canvas';
import { AddStrokeCommand, createDraft, createHistory, createIdGenerator, createStrokeStore } from './strokes';
import { installHud, installPatternToggle, installPointerReadout } from './ui/debug';

const history = createHistory(store);
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
    if (stroke) history.execute(new AddStrokeCommand(stroke));
  },
  cancel: () => draft.cancel(),
});
window.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
  e.preventDefault();
  if (e.shiftKey) history.redo();
  else history.undo();
});
renderer.renderNow();

if (import.meta.env.DEV) {
  installHud(live);
  installPatternToggle(renderer);
  installPointerReadout();
}