import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#board');
if (!canvas) throw new Error('#board not found');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D context unavailable');

function draw(w: number, h: number): void {
  if (!ctx) return;
  ctx.strokeStyle = '#2b4acb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, h);
  ctx.moveTo(w, 0);
  ctx.lineTo(0, h);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) / 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Is this text crisp? 0123456789', 24, 40);
}

new ResizeObserver(([entry]) => {
  if (!entry) return; // noUncheckedIndexedAccess: the array might be empty
  const { width, height } = entry.contentRect;
  canvas.width = width; // NAIVE: bitmap size = CSS size
  canvas.height = height;
  draw(width, height);
}).observe(canvas);