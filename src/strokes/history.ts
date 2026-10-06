import { createEmitter, type Emitter } from '../emitter';
import { CompositeCommand, type Command } from './commands';
import type { StrokeStore } from './store';

export const DEFAULT_HISTORY_LIMIT = 100;

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

export interface HistoryEvents {
  change: HistoryState;
}

export interface HistoryOptions {
  /** Maximum number of undo steps kept. Older steps become permanent. */
  limit?: number;
}

export interface History {
  /** Runs the command now and records it (or adds it to the open group). */
  execute(command: Command): void;
  undo(): boolean;
  redo(): boolean;
  /** Everything executed until commitGroup() becomes ONE undo step. */
  beginGroup(label: string): void;
  commitGroup(): void;
  /** Undoes everything done in the open group and forgets it. */
  rollbackGroup(): void;
  /** Forgets all history (use after loading a different document). */
  clear(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoCount: number;
  readonly redoCount: number;
  on: Emitter<HistoryEvents>['on'];
}

export function createHistory(store: StrokeStore, options: HistoryOptions = {}): History {
  const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_HISTORY_LIMIT));
  const undoStack: Command[] = [];
  const redoStack: Command[] = [];
  let group: { label: string; commands: Command[] } | null = null;
  const events = createEmitter<HistoryEvents>();

  // While a group is open, undo/redo are refused so a half-finished gesture can't be torn apart.
  const canUndo = (): boolean => group === null && undoStack.length > 0;
  const canRedo = (): boolean => group === null && redoStack.length > 0;
  const emit = (): void => events.emit('change', { canUndo: canUndo(), canRedo: canRedo() });

  const record = (command: Command): void => {
    undoStack.push(command);
    if (undoStack.length > limit) undoStack.shift(); // forget the oldest step
  };

  const execute = (command: Command): void => {
    command.execute(store);
    redoStack.length = 0; // a new action kills the redo branch
    if (group) group.commands.push(command);
    else record(command);
    emit();
  };

  const undo = (): boolean => {
    if (!canUndo()) return false;
    const command = undoStack.pop();
    if (!command) return false;
    command.undo(store);
    redoStack.push(command);
    emit();
    return true;
  };

  const redo = (): boolean => {
    if (!canRedo()) return false;
    const command = redoStack.pop();
    if (!command) return false;
    command.execute(store);
    record(command);
    emit();
    return true;
  };

  const commitGroup = (): void => {
    const open = group;
    if (!open) return;
    group = null;
    const [only] = open.commands;
    if (open.commands.length === 1 && only) record(only);
    else if (open.commands.length > 1) record(new CompositeCommand(open.label, open.commands));
    emit();
  };

  return {
    execute,
    undo,
    redo,
    beginGroup(label) {
      if (group) commitGroup();
      group = { label, commands: [] };
      emit();
    },
    commitGroup,
    rollbackGroup() {
      const open = group;
      if (!open) return;
      group = null;
      for (const command of [...open.commands].reverse()) command.undo(store);
      emit();
    },
    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
      group = null;
      emit();
    },
    get canUndo() {
      return canUndo();
    },
    get canRedo() {
      return canRedo();
    },
    get undoCount() {
      return undoStack.length;
    },
    get redoCount() {
      return redoStack.length;
    },
    on: events.on,
  };
}