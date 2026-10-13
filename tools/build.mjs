#!/usr/bin/env node
// build.mjs — regenerate the token files, and optionally cut a release.
//
//   node tools/build.mjs            regenerate src/tokens.css and src/glass/tokens.js
//   node tools/build.mjs release    also write releases/<version>/ (version from tokens.json)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cssFromTokens, jsFromTokens } from './lib/tokens.mjs';
import { cutRelease } from './lib/release.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const tokens = JSON.parse(read('src/tokens.json'));
const css = cssFromTokens(tokens), js = jsFromTokens(tokens);
writeFileSync(join(ROOT, 'src/tokens.css'), css);
writeFileSync(join(ROOT, 'src/glass/tokens.js'), js);
console.log(`tokens ${tokens.version}: wrote src/tokens.css and src/glass/tokens.js`);

if (process.argv[2] === 'release') {
  const files = {
    'ember-ui.css': css + '\n' + read('src/controls/ember-ui.css'),   // one stylesheet: tokens, then controls
    'ember-ui.js': read('src/controls/ember-ui.js'),
    'tokens.json': read('src/tokens.json'),
    'README.md': read('docs/ADOPTING.md'),
  };
  for (const f of ['core.glsl.js', 'pack.js', 'tint.js', 'tokens.js', 'host-maplibre.js']) files['glass/' + f] = read('src/glass/' + f);
  const dir = cutRelease(files, join(ROOT, 'releases'), tokens.version);
  console.log(`release ${tokens.version} cut at ${dir}`);
}
