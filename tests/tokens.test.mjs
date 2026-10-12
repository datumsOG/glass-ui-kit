import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cssFromTokens, jsFromTokens, validate } from '../tools/lib/tokens.mjs';

const tokens = JSON.parse(readFileSync(new URL('../src/tokens.json', import.meta.url)));

test('a token becomes the CSS variable the controls read', () => {
  const css = cssFromTokens(tokens);
  assert.match(css, /--e-font: -apple-system/);
  assert.match(css, /--e-t-display: 36px;/);
  assert.match(css, /--e-ink: #fff;/);
  assert.match(css, /--e-r-pane: 22px;/);
  assert.match(css, /--e-thumb: 24px;/);
  assert.match(css, /--e-tint-ruby: #f70001;/);
});
test('glass parameters and palette reach the shader module unchanged', async () => {
  const js = jsFromTokens(tokens);
  const mod = await import('data:text/javascript,' + encodeURIComponent(js));
  assert.equal(mod.VERSION, tokens.version);
  assert.deepEqual(mod.PARAMS, tokens.glass);
  assert.deepEqual(mod.PALETTE, tokens.palette);
  assert.equal(mod.PARAMS.amp, 34);
});
test('a missing token fails loudly, naming it', () => {
  const broken = structuredClone(tokens); delete broken.glass.spread;
  assert.throws(() => validate(broken), /glass\.spread/);
  const noInk = structuredClone(tokens); delete noInk.ink.ink;
  assert.throws(() => validate(noInk), /ink\.ink/);
});
test('a palette colour that is not #rrggbb is refused', () => {
  const bad = structuredClone(tokens); bad.palette.ruby = 'red';
  assert.throws(() => validate(bad), /palette\.ruby/);
});
test('a non-numeric glass parameter is refused', () => {
  const bad = structuredClone(tokens); bad.glass.amp = '34';
  assert.throws(() => validate(bad), /glass\.amp/);
});
test('the generated files in src/ match tokens.json (run tools/build.mjs if this fails)', () => {
  assert.equal(readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8'), cssFromTokens(tokens));
  assert.equal(readFileSync(new URL('../src/glass/tokens.js', import.meta.url), 'utf8'), jsFromTokens(tokens));
});
