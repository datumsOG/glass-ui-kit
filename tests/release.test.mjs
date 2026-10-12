import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cutRelease, pin, status } from '../tools/lib/release.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'kit-'));
  const files = { 'ember-ui.css': 'a{}', 'glass/host.js': "import './core.js?v=3';\nexport const x = 1;\n", 'glass/core.js': 'export const y = 2;\n' };
  return { root, files, releases: join(root, 'releases'), app: join(root, 'app', 'kit') };
}

test('a release holds the files, a manifest with a checksum each, and versioned imports', () => {
  const f = fixture();
  const dir = cutRelease(f.files, f.releases, '1.0.0');
  const m = JSON.parse(readFileSync(join(dir, 'MANIFEST.json')));
  assert.equal(m.version, '1.0.0');
  assert.deepEqual(Object.keys(m.files).sort(), ['ember-ui.css', 'glass/core.js', 'glass/host.js']);
  assert.match(m.files['ember-ui.css'], /^[0-9a-f]{64}$/);
  assert.match(readFileSync(join(dir, 'glass/host.js'), 'utf8'), /core\.js\?v=1\.0\.0/);
});
test('a release is immutable: cutting the same version twice is refused', () => {
  const f = fixture();
  cutRelease(f.files, f.releases, '1.0.0');
  assert.throws(() => cutRelease(f.files, f.releases, '1.0.0'), /already exists/);
});
test('version must be x.y.z', () => {
  const f = fixture();
  assert.throws(() => cutRelease(f.files, f.releases, 'latest'), /x\.y\.z/);
  assert.throws(() => cutRelease(f.files, f.releases, '../1.0.0'), /x\.y\.z/);
});
test('pin copies a release into the app and stamps it; status says ok', () => {
  const f = fixture();
  cutRelease(f.files, f.releases, '1.0.0');
  pin(f.releases, '1.0.0', f.app);
  assert.equal(readFileSync(join(f.app, 'KIT-VERSION'), 'utf8').trim(), '1.0.0');
  assert.ok(existsSync(join(f.app, 'glass/core.js')));
  assert.deepEqual(status(f.releases, f.app), { state: 'ok', version: '1.0.0', changed: [] });
});
test('a hand-edited copy is flagged, naming the file', () => {
  const f = fixture();
  cutRelease(f.files, f.releases, '1.0.0');
  pin(f.releases, '1.0.0', f.app);
  appendFileSync(join(f.app, 'ember-ui.css'), '/* quick fix */');
  const s = status(f.releases, f.app);
  assert.equal(s.state, 'modified');
  assert.deepEqual(s.changed, ['ember-ui.css']);
});
test('a deleted file is flagged too', () => {
  const f = fixture();
  cutRelease(f.files, f.releases, '1.0.0');
  pin(f.releases, '1.0.0', f.app);
  rmSync(join(f.app, 'glass/core.js'));
  assert.deepEqual(status(f.releases, f.app).changed, ['glass/core.js']);
});
test('an app with a kit folder but no stamp is legacy; no folder is absent', () => {
  const f = fixture();
  assert.equal(status(f.releases, f.app).state, 'absent');
  mkdirSync(f.app, { recursive: true }); writeFileSync(join(f.app, 'ember-ui.css'), 'old');
  assert.equal(status(f.releases, f.app).state, 'legacy');
});
test('pinning a version that was never cut is refused, and the app is not touched', () => {
  const f = fixture();
  mkdirSync(f.app, { recursive: true }); writeFileSync(join(f.app, 'mine.css'), 'keep');
  assert.throws(() => pin(f.releases, '9.9.9', f.app), /no release 9\.9\.9/);
  assert.equal(readFileSync(join(f.app, 'mine.css'), 'utf8'), 'keep');
});
test('upgrading replaces the old release files and keeps nothing stale', () => {
  const f = fixture();
  cutRelease(f.files, f.releases, '1.0.0');
  cutRelease({ 'ember-ui.css': 'b{}' }, f.releases, '1.1.0');
  pin(f.releases, '1.0.0', f.app);
  pin(f.releases, '1.1.0', f.app);
  assert.ok(!existsSync(join(f.app, 'glass/core.js')));
  assert.deepEqual(status(f.releases, f.app), { state: 'ok', version: '1.1.0', changed: [] });
});
test('a release folder that has been edited after cutting is detected', async () => {
  const { verifyRelease } = await import('../tools/lib/release.mjs');
  const f = fixture();
  const dir = cutRelease(f.files, f.releases, '1.0.0');
  assert.deepEqual(verifyRelease(dir), []);
  appendFileSync(join(dir, 'ember-ui.css'), ' ');
  assert.deepEqual(verifyRelease(dir), ['ember-ui.css']);
});
