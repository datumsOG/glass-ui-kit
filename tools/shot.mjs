#!/usr/bin/env node
// shot.mjs — screenshot a page the way Blair's phone sees it, with no dependencies.
//
//   node tools/shot.mjs <url> <out.png> [--w 393 --h 852 --dpr 3]
//        [--wait 4000] [--eval "js to run before the shot"] [--desktop] [--full]
//
// Why a real browser: internal/verify-in-the-real-thing.md. Screenshots
// from --virtual-time-budget do not run requestAnimationFrame, so WebGL glass and
// map tiles never paint. This drives headless Chromium over the DevTools protocol
// instead (Node 22+ has a built-in WebSocket), with mobile emulation: touch, DPR 3,
// iPhone 15-sized viewport.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes(k);
const [url, out] = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
if (!url || !out) { console.error('usage: shot.mjs <url> <out.png> [opts]'); process.exit(2); }
const W = +opt('--w', 393), H = +opt('--h', 852), DPR = +opt('--dpr', 3);
const WAIT = +opt('--wait', 4000), EVAL = opt('--eval', null), DESKTOP = flag('--desktop');

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = process.env.HOME + '/.cache/ms-playwright';
  const dirs = existsSync(base) ? readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort() : [];
  for (const d of dirs.reverse()) {
    for (const sub of ['chrome-linux64', 'chrome-linux']) {
      const p = join(base, d, sub, 'chrome');
      if (existsSync(p)) return p;
    }
  }
  throw new Error('no chromium found; set CHROME=/path/to/chrome');
}

const port = 9300 + Math.floor(Math.random() * 500);
const prof = mkdtempSync(join(tmpdir(), 'shot-'));
const chrome = spawn(findChrome(), [
  '--headless=new', '--no-sandbox', '--hide-scrollbars', '--mute-audio',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-certificate-errors',
  `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params }));
});

try {
  let target;
  for (let t = 0; t < 50 && !target; t++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === 'page'); } catch {}
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  });
  await send('Page.enable'); await send('Runtime.enable');
  if (!DESKTOP) {
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  } else {
    await send('Emulation.setDeviceMetricsOverride', { width: +opt('--w', 1440), height: +opt('--h', 900), deviceScaleFactor: 1, mobile: false });
  }
  await send('Page.navigate', { url });
  await sleep(WAIT);
  if (EVAL) {
    const r = await send('Runtime.evaluate', { expression: EVAL, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.value !== undefined) console.log('eval ->', JSON.stringify(r.result.value));
    await sleep(+opt('--after', 1500));
  }
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: flag('--full') });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('wrote', out);
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill('SIGKILL');
}
