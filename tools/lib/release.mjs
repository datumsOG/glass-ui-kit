// release.mjs — frozen releases, apps pinned by copy.
//
// Blair, 2026-10-09: "I don't want to make some change to the UI suite and then half
// our apps are fucked." So:
//   cutRelease  writes releases/<version>/ once. It refuses to write it twice.
//   pin         copies one release into an app's own kit folder and stamps it.
//   status      says which version an app holds and whether its copy still matches.
// Nothing is shared at runtime. An app changes only when someone runs pin on it.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';

const VERSION = /^\d+\.\d+\.\d+$/;
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const checkVersion = (v) => { if (!VERSION.test(v)) throw new Error(`version must be x.y.z, got "${v}"`); };

// files: { 'relative/path': string | Buffer }
export function cutRelease(files, releasesRoot, version) {
  checkVersion(version);
  const dir = join(releasesRoot, version);
  if (existsSync(dir)) throw new Error(`release ${version} already exists at ${dir}; a release is never edited, cut a new version`);
  const manifest = { version, cut: new Date().toISOString(), files: {} };
  for (const [rel, content] of Object.entries(files)) {
    let data = content;
    // Internal imports carry the release version, so a browser can never pair a new
    // file with a cached old neighbour.
    if (typeof data === 'string' && /\.m?js$/.test(rel)) data = data.replace(/(\.m?js)\?v=[\w.]+/g, `$1?v=${version}`);
    const out = join(dir, rel);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, data);
    manifest.files[rel] = sha(readFileSync(out));
  }
  writeFileSync(join(dir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
  return dir;
}

function readManifest(dir) {
  try { return JSON.parse(readFileSync(join(dir, 'MANIFEST.json'), 'utf8')); } catch (e) { return null; }
}

export function pin(releasesRoot, version, appKitDir) {
  checkVersion(version);
  const src = join(releasesRoot, version);
  const manifest = readManifest(src);
  if (!manifest) throw new Error(`no release ${version} in ${releasesRoot}`);
  // Remove what the previous pin put there (and only that), so nothing stale survives.
  const old = readManifest(appKitDir);
  if (old) for (const rel of Object.keys(old.files)) rmSync(join(appKitDir, rel), { force: true });
  for (const rel of Object.keys(manifest.files)) {
    const out = join(appKitDir, rel);
    mkdirSync(dirname(out), { recursive: true });
    copyFileSync(join(src, rel), out);
  }
  copyFileSync(join(src, 'MANIFEST.json'), join(appKitDir, 'MANIFEST.json'));
  writeFileSync(join(appKitDir, 'KIT-VERSION'), version + '\n');
  return manifest;
}

// state: 'absent' (no kit folder) | 'legacy' (a kit folder from before releases)
//      | 'ok' | 'modified' (a file differs from, or is missing against, its release)
export function status(releasesRoot, appKitDir) {
  if (!existsSync(appKitDir) || !statSync(appKitDir).isDirectory()) return { state: 'absent', version: null, changed: [] };
  let version = null;
  try { version = readFileSync(join(appKitDir, 'KIT-VERSION'), 'utf8').trim(); } catch (e) { /* unpinned */ }
  if (!version) return { state: readdirSync(appKitDir).length ? 'legacy' : 'absent', version: null, changed: [] };
  // Trust the release folder; fall back to the app's own stamp if the release is gone.
  const manifest = (VERSION.test(version) && readManifest(join(releasesRoot, version))) || readManifest(appKitDir);
  if (!manifest) return { state: 'modified', version, changed: ['MANIFEST.json'] };
  const changed = [];
  for (const [rel, want] of Object.entries(manifest.files)) {
    let got = null;
    try { got = sha(readFileSync(join(appKitDir, rel))); } catch (e) { /* missing */ }
    if (got !== want) changed.push(rel);
  }
  return { state: changed.length ? 'modified' : 'ok', version, changed: changed.sort() };
}

// A release is never edited. This returns the files in a release folder that no longer
// match the checksums it was cut with (an empty list means intact).
export function verifyRelease(dir) {
  const manifest = readManifest(dir);
  if (!manifest) return ['MANIFEST.json'];
  const changed = [];
  for (const [rel, want] of Object.entries(manifest.files)) {
    let got = null;
    try { got = sha(readFileSync(join(dir, rel))); } catch (e) { /* missing */ }
    if (got !== want) changed.push(rel);
  }
  return changed.sort();
}
