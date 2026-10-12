// tokens.mjs — src/tokens.json is the ONE place a parameter is defined. This turns it
// into the two things that read it: CSS variables for the controls, and a JS module
// for the glass shader. A font size and a lens curve are the same kind of thing.

const GLASS = ['spread', 'curve', 'amp', 'edgeBlur', 'centreBlur', 'frost', 'rim', 'spec', 'fresnel',
  'shadow', 'gap', 'ring', 'seam', 'seat', 'density', 'rimSat', 'body'];
const REQUIRED = {
  type: ['font', 'caption', 'label', 'body', 'title', 'display'],
  ink: ['ink', 'ink-2', 'ink-3', 'on-ink'],
  surface: ['pane', 'pane-blur', 'pane-tint', 'well', 'well-deep', 'lip-dark', 'lip-light', 'hair'],
  data: ['fill', 'drain'],
  geometry: ['r-pane', 'r-ctl', 'hit'],
  controls: ['track', 'thumb'],
  glass: GLASS,
};

export function validate(t) {
  const bad = [];
  if (!/^\d+\.\d+\.\d+$/.test(t.version || '')) bad.push('version (must be x.y.z)');
  for (const [group, keys] of Object.entries(REQUIRED)) {
    for (const k of keys) if (t[group] === undefined || t[group][k] === undefined || t[group][k] === '') bad.push(`${group}.${k}`);
  }
  for (const k of GLASS) if (t.glass && t.glass[k] !== undefined && !Number.isFinite(t.glass[k])) bad.push(`glass.${k} (must be a number)`);
  for (const [k, v] of Object.entries(t.palette || {})) if (!/^#[0-9a-f]{6}$/i.test(v)) bad.push(`palette.${k} (must be #rrggbb)`);
  if (!t.palette || !Object.keys(t.palette).length) bad.push('palette (empty)');
  if (bad.length) throw new Error('tokens.json: missing or invalid: ' + [...new Set(bad)].join(', '));
  return t;
}

const HEAD = (v) => `GENERATED from src/tokens.json (kit ${v}) by tools/build.mjs. Do not edit: change tokens.json and rebuild.`;

export function cssFromTokens(t) {
  validate(t);
  const lines = [];
  const put = (name, value) => lines.push(`  --e-${name}: ${value};`);
  put('font', t.type.font);
  for (const k of ['caption', 'label', 'body', 'title', 'display']) put('t-' + k, t.type[k]);
  for (const g of ['ink', 'surface', 'data', 'geometry', 'controls']) for (const [k, v] of Object.entries(t[g])) put(k, v);
  for (const [k, v] of Object.entries(t.palette)) put('tint-' + k, v);
  return `/* ${HEAD(t.version)} */\n:root {\n${lines.join('\n')}\n}\n`;
}

export function jsFromTokens(t) {
  validate(t);
  return `// ${HEAD(t.version)}\n`
    + `export const VERSION = ${JSON.stringify(t.version)};\n`
    + `export const PARAMS = ${JSON.stringify(t.glass, null, 2)};\n`
    + `export const PALETTE = ${JSON.stringify(t.palette, null, 2)};\n`;
}
