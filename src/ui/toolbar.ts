import { ClearCommand, type History, type StrokeStore } from '../strokes';
import { STROKE_WIDTH_RANGE, type ToolController, type ToolName } from './tools';

export interface ToolbarDeps {
  tools: ToolController;
  history: History;
  store: StrokeStore;
}

export function createToolbar({ tools, history, store }: ToolbarDeps): void {
  const root = document.createElement('div');
  root.className = 'toolbar';
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'Drawing tools');

  const button = (label: string, title: string, onClick: () => void): HTMLButtonElement => {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = label;
    el.title = title;
    el.addEventListener('click', onClick);
    return el;
  };
  const separator = (): HTMLElement => {
    const el = document.createElement('span');
    el.className = 'sep';
    return el;
  };

  const toolButtons: Record<ToolName, HTMLButtonElement> = {
    pen: button('Pen', 'Pen (P)', () => tools.setTool('pen')),
    'stroke-eraser': button('Erase stroke', 'Stroke eraser (E)', () => tools.setTool('stroke-eraser')),
    'pixel-eraser': button('Erase part', 'Pixel eraser (X)', () => tools.setTool('pixel-eraser')),
  };

  const undoAction = (): void => {
    if (!tools.busy) history.undo();
  };
  const redoAction = (): void => {
    if (!tools.busy) history.redo();
  };
  const undoButton = button('Undo', 'Undo (Ctrl+Z)', undoAction);
  const redoButton = button('Redo', 'Redo (Ctrl+Shift+Z)', redoAction);
  const clearButton = button('Clear', 'Clear canvas (undoable)', () => {
    if (!tools.busy && store.strokes.length > 0) history.execute(new ClearCommand());
  });

  const widthInput = document.createElement('input');
  widthInput.type = 'range';
  widthInput.min = String(STROKE_WIDTH_RANGE.min);
  widthInput.max = String(STROKE_WIDTH_RANGE.max);
  widthInput.step = '1';
  widthInput.setAttribute('aria-label', 'Stroke width');
  widthInput.addEventListener('input', () => tools.setStrokeWidth(Number(widthInput.value)));
  const widthValue = document.createElement('span');
  const widthLabel = document.createElement('label');
  widthLabel.append('Width ', widthInput, widthValue);

  const status = document.createElement('span');
  status.className = 'status';
  status.setAttribute('role', 'status');
  let statusTimer: number | undefined;
  const flash = (message: string): void => {
    status.textContent = message;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      status.textContent = '';
    }, 4000);
  };

  const saveButton = button('Save', 'Download the canvas as JSON', () => {
    const blob = new Blob([store.serialize()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'calcink.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  });

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.hidden = true;
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = ''; // allow re-opening the same file later
    if (!file) return;
    file
      .text()
      .then((text) => {
        const result = store.restore(text);
        if (result.ok) history.clear(); // old commands refer to strokes that no longer exist
        else flash(`Could not open file: ${result.error}`);
      })
      .catch(() => flash('Could not read file'));
  });
  const openButton = button('Open', 'Open a saved canvas', () => fileInput.click());

  root.append(
    ...Object.values(toolButtons),
    separator(),
    widthLabel,
    separator(),
    undoButton,
    redoButton,
    clearButton,
    separator(),
    saveButton,
    openButton,
    fileInput,
    status,
  );
  document.body.append(root);

  const sync = (): void => {
    for (const [name, el] of Object.entries(toolButtons)) {
      el.setAttribute('aria-pressed', String(name === tools.tool));
    }
    undoButton.disabled = !history.canUndo;
    redoButton.disabled = !history.canRedo;
    clearButton.disabled = store.strokes.length === 0;
    widthInput.value = String(tools.strokeWidth);
    widthValue.textContent = `${tools.strokeWidth}px`;
  };
  tools.on('change', sync);
  history.on('change', sync);
  store.on('change', sync);
  sync();

  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === 'z') {
      e.preventDefault(); // stop the browser's own undo
      if (e.shiftKey) redoAction();
      else undoAction();
      return;
    }
    if (mod && key === 'y') {
      e.preventDefault();
      redoAction();
      return;
    }
    if (mod || e.altKey) return;
    if (key === 'p') tools.setTool('pen');
    else if (key === 'e') tools.setTool('stroke-eraser');
    else if (key === 'x') tools.setTool('pixel-eraser');
  });
}