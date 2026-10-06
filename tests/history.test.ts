import { describe, expect, it } from 'vitest';
import {
  AddStrokeCommand,
  ClearCommand,
  EraseStrokesCommand,
  createHistory,
  createStrokeStore,
  type History,
  type StrokeStore,
} from '../src/strokes';
import { makeStroke } from './helpers';

const setup = (limit = 100) => {
  const store = createStrokeStore();
  const history = createHistory(store, { limit });
  return { store, history };
};
const ids = (store: StrokeStore) => store.strokes.map((s) => s.id);
const draw = (history: History, id: string) =>
  history.execute(new AddStrokeCommand(makeStroke(id, [[0, 0], [10, 10]])));

describe('history', () => {
  it('undoes and redoes an add', () => {
    const { store, history } = setup();
    draw(history, 'a');
    draw(history, 'b');
    expect(history.undo()).toBe(true);
    expect(ids(store)).toEqual(['a']);
    expect(history.redo()).toBe(true);
    expect(ids(store)).toEqual(['a', 'b']);
  });

  it('returns false when there is nothing to undo or redo', () => {
    const { history } = setup();
    expect(history.undo()).toBe(false);
    expect(history.redo()).toBe(false);
  });

  it('discards the redo branch when a new action follows an undo', () => {
    const { store, history } = setup();
    draw(history, 'a');
    draw(history, 'b');
    history.undo();
    draw(history, 'c');
    expect(history.canRedo).toBe(false);
    expect(history.redo()).toBe(false);
    expect(ids(store)).toEqual(['a', 'c']);
  });

  it('drops the oldest steps beyond the limit', () => {
    const { store, history } = setup(3);
    ['a', 'b', 'c', 'd', 'e'].forEach((id) => draw(history, id));
    expect(history.undoCount).toBe(3);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(false);
    expect(ids(store)).toEqual(['a', 'b']); // the two oldest actions became permanent
  });

  it('restores erased strokes at their original positions', () => {
    const { store, history } = setup();
    ['a', 'b', 'c'].forEach((id) => draw(history, id));
    history.execute(new EraseStrokesCommand(['a', 'c']));
    expect(ids(store)).toEqual(['b']);
    history.undo();
    expect(ids(store)).toEqual(['a', 'b', 'c']);
  });

  it('undoes an erase that added replacement fragments, and redoes it', () => {
    const { store, history } = setup();
    draw(history, 'a');
    draw(history, 'b');
    const fragments = [
      makeStroke('a1', [[0, 0], [4, 4]]),
      makeStroke('a2', [[6, 6], [10, 10]]),
    ];
    history.execute(new EraseStrokesCommand(['a'], fragments));
    expect(ids(store)).toEqual(['b', 'a1', 'a2']);
    history.undo();
    expect(ids(store)).toEqual(['a', 'b']);
    history.redo();
    expect(ids(store)).toEqual(['b', 'a1', 'a2']);
  });

  it('clear and undo restore everything in order', () => {
    const { store, history } = setup();
    ['a', 'b', 'c'].forEach((id) => draw(history, id));
    history.execute(new ClearCommand());
    expect(store.strokes).toHaveLength(0);
    history.undo();
    expect(ids(store)).toEqual(['a', 'b', 'c']);
  });

  it('turns a whole group into ONE undo step', () => {
    const { store, history } = setup();
    ['a', 'b', 'c'].forEach((id) => draw(history, id));
    history.beginGroup('Erase');
    history.execute(new EraseStrokesCommand(['b']));
    history.execute(new EraseStrokesCommand(['c']));
    history.commitGroup();
    expect(history.undoCount).toBe(4); // three draws + one group
    expect(ids(store)).toEqual(['a']);
    history.undo();
    expect(ids(store)).toEqual(['a', 'b', 'c']);
    history.redo();
    expect(ids(store)).toEqual(['a']);
  });

  it('records nothing for an empty group', () => {
    const { history } = setup();
    history.beginGroup('Erase');
    history.commitGroup();
    expect(history.undoCount).toBe(0);
  });

  it('rolls a group back without leaving a history entry', () => {
    const { store, history } = setup();
    draw(history, 'a');
    history.beginGroup('Erase');
    history.execute(new EraseStrokesCommand(['a']));
    history.rollbackGroup();
    expect(ids(store)).toEqual(['a']);
    expect(history.undoCount).toBe(1);
  });

  it('refuses undo and redo while a group is open', () => {
    const { history } = setup();
    draw(history, 'a');
    history.beginGroup('Erase');
    expect(history.undo()).toBe(false);
    expect(history.canUndo).toBe(false);
  });

  it('emits canUndo/canRedo transitions', () => {
    const { history } = setup();
    const states: boolean[][] = [];
    history.on('change', (s) => states.push([s.canUndo, s.canRedo]));
    draw(history, 'a');
    history.undo();
    history.redo();
    expect(states).toEqual([[true, false], [false, true], [true, false]]);
  });
});