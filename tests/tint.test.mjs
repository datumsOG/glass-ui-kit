import test from 'node:test';
import assert from 'node:assert/strict';
import { absorption, transmitted, inkFor, PALETTE } from '../src/glass/tint.js';

const srgb = (l) => Math.round(255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055));

test('at density 1, white light comes out as the named colour', () => {
  const t = transmitted(absorption('#1f4fd8'), 1).map(srgb);
  assert.deepEqual(t, [0x1f, 0x4f, 0xd8]);
});
test('density 0 is clear glass', () => {
  assert.deepEqual(transmitted(absorption('ruby'), 0), [1, 1, 1]);
});
test('a longer path is more saturated, never brighter', () => {
  const a = absorption('emerald');
  const face = transmitted(a, 0.6, 1), rim = transmitted(a, 0.6, 2);
  assert.ok(rim.every((v, i) => v <= face[i]));
});
test('unknown names and malformed hex are clear and finite', () => {
  for (const bad of ['mauve-ish', '#12', '', null, '#gggggg']) {
    assert.deepEqual(absorption(bad), [0, 0, 0]);
  }
});
test('a zero channel does not produce Infinity', () => {
  assert.ok(absorption('#ff0000').every(Number.isFinite));
});
test('ink: white on deep tints, black on pale ones', () => {
  assert.equal(inkFor('#1f4fd8', 1), '#fff');
  assert.equal(inkFor('#c8102e', 1), '#fff');
  assert.equal(inkFor('#f4c430', 1), '#000');
  assert.equal(inkFor('#f4c430', 0), '#000');
});
test('every palette entry is a valid colour', () => {
  for (const k of Object.keys(PALETTE)) assert.notDeepEqual(absorption(k), [0, 0, 0]);
});
test('ink depends on what is behind the glass: pale tints take white over a dark backdrop', () => {
  // explicit colour: the palette is a token and Blair retunes it
  assert.equal(inkFor('#f4c430', 0.8, PALETTE, 0.35), '#fff');
  assert.equal(inkFor('#f4c430', 0.8, PALETTE, 1), '#000');
});
test('over a dark map (backdrop 0.05) every palette colour takes white ink at any density', () => {
  for (const k of Object.keys(PALETTE)) for (const d of [0.05, 0.3, 0.8, 1.5]) assert.equal(inkFor(k, d, PALETTE, 0.05), '#fff');
});
test('3-digit hex is accepted', () => {
  assert.deepEqual(absorption('#f00'), absorption('#ff0000'));
});
