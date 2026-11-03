import { describe, expect, it } from 'vitest';
import { keyAction, type KeyAction, type KeyContext } from './keys';
import { Session } from './session';
import { fromJson, type LevelJson } from '../rules/rules';
import levels from '../levels/levels.json';

const ctx = (o: Partial<KeyContext> = {}): KeyContext => ({ plates: 3, axis: [1, 0, 1], selected: null, solved: false, ...o });

describe('keyAction', () => {
  it('Tab cycles forward and back, wrapping', () => {
    expect(keyAction({ key: 'Tab' }, ctx())).toEqual({ kind: 'select', plate: 0 });
    expect(keyAction({ key: 'Tab' }, ctx({ selected: 2 }))).toEqual({ kind: 'select', plate: 0 });
    expect(keyAction({ key: 'Tab', shift: true }, ctx())).toEqual({ kind: 'select', plate: 2 });
    expect(keyAction({ key: 'Tab', shift: true }, ctx({ selected: 1 }))).toEqual({ kind: 'select', plate: 0 });
  });
  it('digits pick a plate that exists', () => {
    expect(keyAction({ key: '2' }, ctx())).toEqual({ kind: 'select', plate: 1 });
    expect(keyAction({ key: '4' }, ctx())).toBeNull();
  });
  it('arrows move along the rail; across it they nudge', () => {
    expect(keyAction({ key: 'ArrowRight' }, ctx({ selected: 0 }))).toEqual({ kind: 'move', plate: 0, dir: 1 });
    expect(keyAction({ key: 'ArrowUp' }, ctx({ selected: 1 }))).toEqual({ kind: 'move', plate: 1, dir: 0 });
    expect(keyAction({ key: 'ArrowUp' }, ctx({ selected: 0 }))).toEqual({ kind: 'wrong-axis', plate: 0 });
    expect(keyAction({ key: 'ArrowLeft' }, ctx())).toEqual({ kind: 'move', plate: 0, dir: 3 });
  });
  it('undo, restart, cancel, next; caps lock and Ctrl+Z; other Ctrl shortcuts pass through', () => {
    expect(keyAction({ key: 'Z' }, ctx())).toEqual({ kind: 'undo' });
    expect(keyAction({ key: 'z', ctrl: true }, ctx())).toEqual({ kind: 'undo' });
    expect(keyAction({ key: 'r', ctrl: true }, ctx())).toBeNull(); // Ctrl+R reloads the page, not a restart
    expect(keyAction({ key: 'r' }, ctx())).toEqual({ kind: 'restart' });
    expect(keyAction({ key: 'Escape' }, ctx())).toEqual({ kind: 'cancel' });
    expect(keyAction({ key: 'Enter' }, ctx())).toBeNull();
    expect(keyAction({ key: 'Enter' }, ctx({ solved: true }))).toEqual({ kind: 'next' });
  });
  it('a solved level ignores plate keys but still allows undo and restart', () => {
    const c = ctx({ solved: true, selected: 0 });
    expect(keyAction({ key: 'ArrowRight' }, c)).toBeNull();
    expect(keyAction({ key: 'Tab' }, c)).toBeNull();
    expect(keyAction({ key: 'z' }, c)).toEqual({ kind: 'undo' });
  });
  it('drives a Session: First Peak solved from the keyboard (Tab, Right)', () => {
    const lv = fromJson((levels as LevelJson[]).find(l => l.name === 'First Peak')!);
    const s = new Session(lv);
    let selected: number | null = null;
    for (const key of ['Tab', 'ArrowRight']) {
      const a: KeyAction = keyAction({ key }, { plates: lv.plates, axis: lv.axis, selected, solved: s.solved })!;
      if (a.kind === 'select') selected = a.plate;
      if (a.kind === 'move') expect(s.move(a.plate, a.dir).ok).toBe(true);
    }
    expect([s.solved, s.moves, s.stars]).toEqual([true, 1, 1]);
  });
});
