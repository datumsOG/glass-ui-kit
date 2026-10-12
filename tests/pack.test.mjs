import test from 'node:test';
import assert from 'node:assert/strict';
import { packElements, MAX_ELEMENTS } from '../src/glass/pack.js';

const pane = (o = {}) => ({ left: 0, top: 0, width: 200, height: 100, radius: 22, kind: 'pane', frost: 0, absorb: [0, 0, 0], press: 0, ...o });
const btn  = (o = {}) => pane({ left: 20, top: 20, width: 80, height: 44, radius: 12, kind: 'button', ...o });

test('centre and half-size in device px, y flipped to GL origin', () => {
  const p = packElements([pane({ left: 10, top: 20 })], { scale: 3, bufferHeight: 900 });
  assert.deepEqual([...p.rect.slice(0, 4)], [330, 900 - 210, 300, 150]);
});
test('positions are measured from the canvas, not the screen', () => {
  // A canvas that scrolls with the page: scrolled 200 px, it starts 200 px above the screen.
  const p = packElements([pane({ left: 10, top: -180 })], { scale: 3, bufferHeight: 900, origin: { x: 0, y: -200 } });
  assert.deepEqual([...p.rect.slice(0, 2)], [330, 900 - 210]);
});
test('scrolling the canvas and the glass together leaves the lens where it was', () => {
  const at = (scroll) => [...packElements([pane({ left: 10, top: 300 - scroll })],
    { scale: 2, bufferHeight: 1600, origin: { x: 0, y: 100 - scroll } }).rect.slice(0, 4)];
  assert.deepEqual(at(0), at(37));
});
test('opacity travels with its element, and is 1 when not given', () => {
  const p = packElements([btn({ alpha: 0.25 }), pane({ alpha: 0.5 }), pane()], { scale: 1, bufferHeight: 400 });
  assert.deepEqual([...p.alpha.slice(0, 3)], [0.5, 1, 0.25]);
});
test('fully transparent glass is not packed, and is not counted as dropped', () => {
  const p = packElements([pane({ alpha: 0 }), btn({ alpha: 0 }), pane({ left: 300 })], { scale: 1, bufferHeight: 400 });
  assert.equal(p.count, 1);
  assert.equal(p.dropped, 0);
  assert.deepEqual(p.kept, [2]);
});
test('radius is clamped to half the short side', () => {
  const p = packElements([pane({ height: 30, radius: 999 })], { scale: 2, bufferHeight: 400 });
  assert.equal(p.rad[0], 30);
});
test('panes are packed before buttons whatever the input order', () => {
  const p = packElements([btn(), pane()], { scale: 1, bufferHeight: 400 });
  assert.deepEqual([p.kind[0], p.kind[1]], [0, 1]);
});
test('a button knows the pane it sits in; one outside every pane has parent -1', () => {
  const p = packElements([pane(), btn(), btn({ left: 500 })], { scale: 1, bufferHeight: 400 });
  assert.deepEqual([p.parent[1], p.parent[2]], [0, -1]);
});
test('over the limit: panes kept, extra buttons dropped and counted', () => {
  const items = [pane(), ...Array.from({ length: MAX_ELEMENTS + 5 }, () => btn())];
  const p = packElements(items, { scale: 1, bufferHeight: 400 });
  assert.equal(p.count, MAX_ELEMENTS);
  assert.equal(p.dropped, 6);
  assert.equal(p.kind[0], 0);
});
test('elements under 6 px, and non-finite numbers, are skipped', () => {
  const p = packElements([pane({ width: 4 }), pane({ left: NaN })], { scale: 1, bufferHeight: 400 });
  assert.equal(p.count, 0);
});
test('tint, frost and press travel with their element after sorting', () => {
  const p = packElements([btn({ absorb: [1, 2, 3], press: 0.5 }), pane({ frost: 9 })], { scale: 1, bufferHeight: 400 });
  assert.equal(p.frost[0], 9);
  assert.deepEqual([...p.absorb.slice(3, 6)], [1, 2, 3]);
  assert.equal(p.press[1], 0.5);
});
test('kept lists the input positions that were packed, so the host can un-skin the rest', () => {
  const items = [btn(), pane(), ...Array.from({ length: MAX_ELEMENTS }, () => btn())];
  const p = packElements(items, { scale: 1, bufferHeight: 400 });
  assert.equal(p.kept.length, MAX_ELEMENTS);
  assert.equal(p.kept[0], 1);                         // the pane, packed first
  assert.ok(!p.kept.includes(items.length - 1));      // the last button did not fit
});
