import './style.css';
import { createViewport } from './canvas';
import { drawCrispnessPattern, installHud } from './ui/debug';

const canvas = document.querySelector<HTMLCanvasElement>('#board');
if (!canvas) throw new Error('#board not found');

const viewport = createViewport(canvas);

const redraw = (): void => {
  const { ctx, size } = viewport;
  ctx.clearRect(0, 0, size.width, size.height);
  drawCrispnessPattern(ctx, size);
};
viewport.onChange(redraw);
redraw(); // createViewport already applied the first size before we subscribed

if (import.meta.env.DEV) installHud(viewport);