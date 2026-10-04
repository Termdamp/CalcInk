import './style.css';
import { attachInput, createRenderer, createViewport } from './canvas';
import { createStrokeStore } from './strokes';
import { installHud, installPatternToggle, installPointerReadout } from './ui/debug';

const STROKE_WIDTH = 4;

const canvas = document.querySelector<HTMLCanvasElement>('#board');
if (!canvas) throw new Error('#board not found');

const viewport = createViewport(canvas);
const store = createStrokeStore();
const renderer = createRenderer(viewport, store);

attachInput(viewport, {
  start: (p) => store.begin(p, STROKE_WIDTH),
  move: (ps) => store.append(ps),
  end: () => store.end(),
  cancel: () => store.cancel(),
});

renderer.renderNow();

if (import.meta.env.DEV) {
  installHud(viewport);
  installPatternToggle(renderer);
  installPointerReadout();
}