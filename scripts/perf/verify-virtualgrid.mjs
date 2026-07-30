// scripts/perf/verify-virtualgrid.mjs
// Serves out/, drives a throttled fast-fling, asserts the live DOM card count
// stays bounded even at the full list length. Exit 1 on regression.
const BASE = process.argv[2] || "http://localhost:5055";
const CDP = process.argv[3] || "9222";
const MAX_LIVE_CARDS = 120; // windowed grid must never approach the full list
const j = async (p) => (await fetch(`http://127.0.0.1:${CDP}${p}`)).json();
const t = (await j("/json")).find((x) => x.type === "page") || (await j("/json/new?about:blank"));
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let i = 0; const p = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { const { resolve, reject } = p.get(m.id); p.delete(m.id); if (m.error) reject(new Error(JSON.stringify(m.error))); else resolve(m.result); } };
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++i; p.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (x) => { const { result, exceptionDetails } = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails)); return result.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setCPUThrottlingRate", { rate: 6 });
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url: `${BASE}/` }); await sleep(2500);
await ev(`window.__lt=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push(Math.round(e.duration))}).observe({entryTypes:['longtask']});true`);
let maxCards = 0;
for (let pass = 0; pass < 8; pass++) {
  await ev(`window.scrollBy(0, ${1500 + pass * 400});true`);
  for (let k = 0; k < 20; k++) { await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 195, y: 400, deltaX: 0, deltaY: 520 }); await sleep(8); }
  const n = await ev(`document.querySelectorAll('[data-vg-card]').length`);
  maxCards = Math.max(maxCards, n);
}
const stats = await ev(`({longtasks:window.__lt.length,longtaskMax:window.__lt.length?Math.max(...window.__lt):0,total:document.querySelectorAll('[data-vg-card]').length})`);
const ok = maxCards > 0 && maxCards <= MAX_LIVE_CARDS;
console.log(JSON.stringify({ maxLiveCards: maxCards, limit: MAX_LIVE_CARDS, ...stats, pass: ok }, null, 2));
ws.close();
process.exit(ok ? 0 : 1);
