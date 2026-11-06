// Keyboard controls (design-plates.md Controls): Tab / Shift+Tab / 1-9 pick a plate, arrows move it along its rail,
// Z (or Ctrl+Z) undo, R restart, Enter next level once solved, Esc cancels a preview or drops the selection.
// Pure: the input layer passes KeyboardEvent fields and the current context, and dispatches the returned action.
import type { Dir } from '../rules/rules.ts';

export type KeyAction =
  | { kind: 'select'; plate: number }
  | { kind: 'move'; plate: number; dir: Dir }
  | { kind: 'undo' } | { kind: 'restart' } | { kind: 'next' } | { kind: 'cancel' };

export interface KeyContext { plates: number; axis: number[]; selected: number | null; solved: boolean }
export interface KeyInput { key: string; shift?: boolean; ctrl?: boolean }

const ARROWS: Record<string, Dir> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };

export function keyAction(e: KeyInput, c: KeyContext): KeyAction | null {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === 'z') return { kind: 'undo' };
  if (e.ctrl) return null; // leave other browser shortcuts alone
  if (k === 'r') return { kind: 'restart' };
  if (k === 'Escape') return { kind: 'cancel' };
  if (k === 'Enter') return c.solved ? { kind: 'next' } : null;
  if (c.solved || c.plates === 0) return null;
  if (k === 'Tab') {
    const from = c.selected ?? (e.shift ? 0 : -1);
    return { kind: 'select', plate: (from + (e.shift ? -1 : 1) + c.plates) % c.plates };
  }
  if (/^[1-9]$/.test(k)) { const p = Number(k) - 1; return p < c.plates ? { kind: 'select', plate: p } : null; }
  const dir = ARROWS[k];
  if (dir === undefined) return null;
  const p = c.selected ?? 0; // an arrow with nothing selected acts on plate 1 and selects it
  // The board lies on the diagonal, so every rail runs between two arrows: east is down-right, north is up-right. Either arrow nearest the way goes that way, and no arrow is ever refused for being "the other way" (Nov 6).
  return { kind: 'move', plate: p, dir: c.axis[p] === 1 ? (k === 'ArrowRight' || k === 'ArrowDown' ? 1 : 3) : (k === 'ArrowUp' || k === 'ArrowRight' ? 0 : 2) };
}
