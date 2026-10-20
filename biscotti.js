(() => {
'use strict';

const CF = 'https://speed.cloudflare.com';
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const sess = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

function bind(k, v) {
  $$(`[data-k="${k}"]`).forEach(el => { el.textContent = v; el.classList.remove('sk'); });
}
const safe = (v, max = 80) => (typeof v === 'string' || typeof v === 'number') ? String(v).replace(/[\u0000-\u001f]/g, '').slice(0, max) : '';

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  }
}

function setIcon(svg, id) { svg.querySelector('use').setAttribute('href', '#' + id); }

const FETCH_OPTS = { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' };
async function getRaw(url, ms = 6000, extra = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { ...FETCH_OPTS, ...extra, signal: c.signal });
    if (extra.mode !== 'no-cors' && !r.ok) throw new Error('HTTP ' + r.status);
    return r;
  } finally { clearTimeout(t); }
}
const getJSON = async (u, ms) => (await getRaw(u, ms)).json();
const getText = async (u, ms) => (await getRaw(u, ms)).text();

document.addEventListener('pointerdown', e => {
  const host = e.target.closest('.ripple');
  if (!host) return;
  const r = host.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2;
  const s = document.createElement('span');
  s.className = 'rip';
  s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  host.appendChild(s);
  s.addEventListener('animationend', () => s.remove());
});

const mq = matchMedia('(prefers-color-scheme: dark)');
const DEFAULTS = { theme: 'auto', size: 'default', hand: true, hide: false, len: 'standard', unit: 'mbps', live: true, haptics: true, exact: true };
const VALID = { theme: ['auto', 'light', 'dark'], size: ['small', 'default', 'large'], len: ['quick', 'standard', 'long'], unit: ['mbps', 'mbs'] };
const SIZES = { small: 0.92, default: 1, large: 1.14 };
const LENGTHS = { quick: 4000, standard: 7000, long: 12000 };
const settings = {};
for (const k in DEFAULTS) {
  const v = store.get('biscotti.' + k, DEFAULTS[k]);
  settings[k] = VALID[k] ? (VALID[k].includes(v) ? v : DEFAULTS[k]) : (typeof v === typeof DEFAULTS[k] ? v : DEFAULTS[k]);
}
let handLoaded = true;

function buzz(p = 200) {
  if (!settings.haptics || !navigator.vibrate) return;
  try { navigator.vibrate(Array.isArray(p) ? p : Math.max(20, p)); } catch {}
}

function confirmDialog(title, text) {
  return new Promise(resolve => {
    const d = $('#dlg'), yes = $('#dlgYes'), no = $('#dlgNo');
    const prev = document.activeElement;
    $('#dlgTitle').textContent = title;
    $('#dlgText').textContent = text;
    d.classList.add('show');
    no.focus();
    buzz(20);
    const done = v => {
      d.classList.remove('show');
      yes.removeEventListener('click', onYes);
      no.removeEventListener('click', onNo);
      d.removeEventListener('click', onScrim);
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
      resolve(v);
    };
    const onYes = () => done(true);
    const onNo = () => done(false);
    const onScrim = e => { if (e.target === d) done(false); };
    const onKey = e => {
      if (e.key === 'Escape') done(false);
      else if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === no ? yes : no).focus(); }
    };
    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
    d.addEventListener('click', onScrim);
    document.addEventListener('keydown', onKey);
  });
}

function applyTheme() {
  const dark = settings.theme === 'dark' || (settings.theme === 'auto' && mq.matches);
  document.documentElement.dataset.scheme = dark ? 'dark' : 'light';
  const m = $('meta[name="theme-color"]');
  if (m) m.content = dark ? '#1c1310' : '#fbf3e8';
}
function applyHide() { document.body.classList.toggle('hide-sens', settings.hide); }
function applySize() { document.documentElement.style.setProperty('--fs-user', SIZES[settings.size] || 1); }
function applyFont() {
  document.documentElement.dataset.font = settings.hand ? 'hand' : 'default';
  if (settings.hand && !handLoaded) {
    handLoaded = true;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Chewy&family=Gaegu:wght@400;700&display=swap';
    document.head.append(l);
  }
}

function syncSettingsUI() {
  $$('.seg').forEach(g => $$('button', g).forEach(b => {
    const on = b.dataset.v === String(settings[g.dataset.setting]);
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on);
  }));
  $$('input[data-setting]').forEach(i => { i.checked = !!settings[i.dataset.setting]; });
}

const APPLY = {
  theme: () => applyTheme(),
  hide: () => applyHide(),
  size: () => applySize(),
  hand: () => applyFont(),
  unit: () => applyUnit(),
  len: () => applyLen(),
  live: () => updatePingLoop(),
  haptics: () => {},
  exact: () => { if (settings.exact) resolveExact(true); else paintDevice(); }
};
function setSetting(k, v) {
  settings[k] = v;
  store.set('biscotti.' + k, v);
  APPLY[k]();
  syncSettingsUI();
  buzz(8);
}

mq.addEventListener?.('change', applyTheme);
addEventListener('scroll', () => $('.topbar').classList.toggle('lifted', scrollY > 4), { passive: true });
$$('.seg').forEach(g => g.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) setSetting(g.dataset.setting, b.dataset.v);
}));
$$('input[data-setting]').forEach(i => i.addEventListener('change', () => setSetting(i.dataset.setting, i.checked)));
$('#actReset').addEventListener('click', async () => {
  if (!await confirmDialog('reset settings?', 'everything goes back to the defaults')) return;
  Object.keys(DEFAULTS).forEach(k => setSetting(k, DEFAULTS[k]));
  toast('Settings reset');
});
applyTheme(); applyHide(); applySize(); applyFont(); syncSettingsUI();

let view = 'overview';
function showView(name) {
  if (!$('#view-' + name)) name = 'overview';
  view = name;
  document.body.dataset.view = name;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  $$('.nav-item').forEach(b => {
    const on = b.dataset.view === name;
    b.classList.toggle('active', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  updatePingLoop();
}
$$('.nav-item').forEach(b => b.addEventListener('click', () => { buzz(6); history.replaceState(null, '', '#' + b.dataset.view); showView(b.dataset.view); }));
addEventListener('hashchange', () => showView(location.hash.slice(1)));

const IP_RE = /^[0-9a-f:.]{3,45}$/i;
const parseTrace = txt => Object.fromEntries(String(txt).split('\n').map(l => l.split('=')).filter(p => p.length === 2));

const FLAG_URL = 'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/';
const flagImg = $('#flag');
flagImg.addEventListener('error', () => { flagImg.hidden = true; });
function setFlag(cc) {
  if (/^[A-Za-z]{2}$/.test(cc || '')) { flagImg.src = FLAG_URL + cc.toLowerCase() + '.svg'; flagImg.hidden = false; }
  else flagImg.hidden = true;
}

const ipProviders = [
  async () => {
    const d = await getJSON('https://ipwho.is/');
    if (d.success === false) throw new Error(d.message || 'ipwho.is failed');
    return { ip: d.ip, type: d.type, city: d.city, region: d.region, country: d.country, cc: d.country_code,
             lat: d.latitude, lon: d.longitude, isp: d.connection?.isp || d.connection?.org, asn: d.connection?.asn,
             tz: d.timezone?.id, src: 'ipwho.is' };
  },
  async () => {
    const d = await getJSON('https://free.freeipapi.com/api/json/');
    return { ip: d.ipAddress, type: d.ipVersion === 6 ? 'IPv6' : 'IPv4', city: d.cityName, region: d.regionName,
             country: d.countryName, cc: d.countryCode, lat: d.latitude, lon: d.longitude, isp: d.asnOrganization,
             asn: d.asn, tz: Array.isArray(d.timeZones) ? d.timeZones[0] : d.timeZone, src: 'freeipapi.com' };
  }
];

async function lookupIP(force) {
  if (!force) {
    const c = sess.get('biscotti.ip');
    if (c && Date.now() - c.at < 5 * 60e3) return c.data;
  }
  const tracePromise = getText(CF + '/cdn-cgi/trace').then(parseTrace).catch(() => null);
  let data = null;
  for (const p of ipProviders) {
    try { const d = await p(); if (IP_RE.test(String(d.ip))) { data = d; break; } } catch (e) { console.warn('IP provider failed:', e.message); }
  }
  const trace = await tracePromise;
  if (!data && trace && IP_RE.test(trace.ip || '')) {
    data = { ip: trace.ip, type: trace.ip.includes(':') ? 'IPv6' : 'IPv4', cc: trace.loc, src: 'Cloudflare trace' };
  }
  if (!data) throw new Error('All IP lookups failed');
  data.trace = trace;
  sess.set('biscotti.ip', { at: Date.now(), data });
  return data;
}

let currentIP = '';
function renderIP(d) {
  currentIP = safe(d.ip, 45);
  bind('ip', currentIP);
  $('[data-k="ip"]').classList.toggle('long', currentIP.length > 18);
  bind('ipType', safe(d.type, 6) || (currentIP.includes(':') ? 'IPv6' : 'IPv4'));
  setFlag(d.cc);
  const place = [d.city, d.region && d.region !== d.city ? d.region : '', d.country].map(x => safe(x, 40)).filter(Boolean).join(', ');
  bind('place', place || 'Location unknown');
  bind('isp', safe(d.isp, 60) || 'Provider unknown');
  bind('asn', d.asn ? 'AS' + safe(d.asn, 10).replace(/^AS/i, '') : '—');
  const lat = Number(d.lat), lon = Number(d.lon);
  bind('coords', Number.isFinite(lat) && Number.isFinite(lon)
    ? `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}` : '—');
  const tz = safe(d.tz, 40);
  bind('tz', tz || '—');
  let lt = '—';
  try { if (tz) lt = new Date().toLocaleTimeString([], { timeZone: tz, hour: 'numeric', minute: '2-digit' }); } catch {}
  bind('localTime', lt);
  bind('src', safe(d.src, 30));
  const t = d.trace || {};
  bind('colo', safe(t.colo, 6) || '—');
  bind('http', safe(t.http, 10) || '—');
  bind('tls', safe(t.tls, 10) || '—');
  bind('warp', safe(t.warp, 10) || '—');
}

async function loadIP(force) {
  try { renderIP(await lookupIP(force)); }
  catch {
    bind('ip', 'Unavailable'); bind('place', 'Lookup blocked or offline'); bind('isp', '—'); setFlag(null);
    ['ipType', 'coords', 'tz', 'localTime', 'asn', 'src', 'colo', 'http', 'tls', 'warp'].forEach(k => bind(k, '—'));
    toast('IP lookup failed. Ad blocker, VPN or offline?');
  }
}
$('#btnCopyIp').addEventListener('click', async () => {
  if (!IP_RE.test(currentIP)) return toast('No IP to copy yet');
  toast(await copy(currentIP) ? 'IP copied' : 'Couldn\'t copy');
});

const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const LINK = { wifi: 'Wi‑Fi', cellular: 'Cellular', ethernet: 'Ethernet', bluetooth: 'Bluetooth', wimax: 'WiMAX', other: 'Other', none: 'None' };

function renderConn() {
  const online = navigator.onLine;
  bind('status', online ? 'Online' : 'Offline');
  $('#rowStatus').classList.toggle('bad', !online);
  $('#offlineBanner').hidden = online;

  let link = 'Unknown';
  if (conn) {
    if (conn.type && LINK[conn.type]) link = LINK[conn.type];
    else if (conn.effectiveType) link = conn.effectiveType.toUpperCase();
  }
  bind('link', link);
  bind('downlink', conn && conn.downlink != null ? `${conn.downlink} Mbps` : 'n/a');
  bind('rtt', conn && conn.rtt != null ? `${conn.rtt} ms` : 'n/a');
  bind('connHint', conn
    ? 'Browser estimates, not a measurement' + (conn.saveData ? '. Data Saver is on' : '') + '. Run a speed test for real numbers.'
    : 'Your browser hides link details (Safari/Firefox). Use the Speed tab for real numbers.');
}
addEventListener('online', () => { renderConn(); refreshAll(true); });
addEventListener('offline', renderConn);
if (conn) {
  let t;
  conn.addEventListener?.('change', () => { renderConn(); clearTimeout(t); t = setTimeout(() => { loadIP(true); checkReach(); }, 1500); });
}

const TARGETS = [
  { name: 'Cloudflare', sub: 'speed.cloudflare.com', url: CF + '/__down?bytes=0' },
  { name: 'Google DNS', sub: 'dns.google', url: 'https://dns.google/resolve?name=example.com' },
  { name: 'Google', sub: 'www.google.com', url: 'https://www.google.com/generate_204' },
  { name: 'GitHub', sub: 'github.com', url: 'https://github.com/favicon.ico' },
  { name: 'Wikipedia', sub: 'wikipedia.org', url: 'https://en.wikipedia.org/static/favicon/wikipedia.ico' }
];

async function probe(url) {
  const times = [];
  for (let i = 0; i < 2; i++) {
    const s = performance.now();
    try { await getRaw(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now() + i, 5000, { mode: 'no-cors' }); }
    catch { return null; }
    times.push(performance.now() - s);
  }
  return Math.min(...times);
}

function latClass(ms) { return ms == null ? 'down' : ms < 100 ? 'good' : ms < 250 ? 'ok' : 'down'; }

async function checkReach() {
  const ul = $('#reachList');
  ul.replaceChildren(...TARGETS.map(t => {
    const li = document.createElement('li'); li.className = 'li'; li.dataset.n = t.name;
    li.innerHTML = '<i class="sdot"></i><span class="nm"></span><span class="val sk">000 ms</span>';
    li.querySelector('.nm').append(t.name, Object.assign(document.createElement('small'), { textContent: t.sub }));
    return li;
  }));
  await Promise.all(TARGETS.map(async t => {
    const ms = await probe(t.url);
    const li = ul.querySelector(`[data-n="${t.name}"]`);
    if (!li) return;
    const c = latClass(ms);
    li.querySelector('.sdot').className = 'sdot ' + c;
    const v = li.querySelector('.val'); v.classList.remove('sk');
    v.textContent = ms == null ? 'Unreachable' : Math.round(ms) + ' ms';
  }));
}
$('#btnReach').addEventListener('click', checkReach);

const ARC = 452.39, CIRC = 603.19;
const STOPS = [0, 5, 10, 25, 50, 100, 250, 500, 1000];
function speedToFrac(v) {
  if (v <= 0) return 0;
  if (v >= 1000) return 1;
  for (let i = 1; i < STOPS.length; i++) if (v <= STOPS[i]) return ((i - 1) + (v - STOPS[i - 1]) / (STOPS[i] - STOPS[i - 1])) / (STOPS.length - 1);
  return 1;
}
const UNITS = { mbps: { label: 'Mbps', div: 1, end: '1G' }, mbs: { label: 'MB/s', div: 8, end: '125' } };
const unit = () => UNITS[settings.unit] || UNITS.mbps;
const fmtSpeed = v => { v /= unit().div; return v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2); };

const gProg = $('#gProg'), gVal = $('#gVal'), gPhase = $('#gPhase');
let gTarget = 0, gShown = 0, gRaf = 0, running = false, cancelPhase = null, userStopped = false;

function gaugeLoop() {
  gShown += (gTarget - gShown) * 0.14;
  if (Math.abs(gTarget - gShown) < 0.005) gShown = gTarget;
  gVal.textContent = gShown <= 0 ? '0' : fmtSpeed(gShown);
  const frac = speedToFrac(gShown);
  gProg.style.strokeDasharray = `${(ARC * frac).toFixed(2)} ${CIRC}`;
  gProg.style.opacity = frac > 0.002 ? 1 : 0;
  gRaf = (running || gShown !== gTarget) ? requestAnimationFrame(gaugeLoop) : 0;
}
const setGauge = v => { gTarget = v; if (!gRaf) gRaf = requestAnimationFrame(gaugeLoop); };

function setStep(name) {
  const order = ['ping', 'download', 'upload'];
  const idx = order.indexOf(name);
  $$('.step').forEach(s => {
    const i = order.indexOf(s.dataset.step);
    s.classList.toggle('active', i === idx);
    s.classList.toggle('done', idx === -1 ? name === 'done' : i < idx);
  });
}
const setBar = f => { $('#bar').style.width = (clamp(f, 0, 1) * 100) + '%'; };

function makeMeter() {
  let bytes = 0, win = [], warmT = null, warmB = 0;
  const t0 = performance.now();
  return {
    add(n) { bytes += n; },
    get bytes() { return bytes; },
    tick() {
      const now = performance.now();
      win.push([now, bytes]);
      while (win.length > 2 && now - win[0][0] > 1000) win.shift();
      if (warmT === null && now - t0 >= 1200) { warmT = now; warmB = bytes; }
      const [wt, wb] = win[0];
      return now > wt ? (bytes - wb) * 8 / (now - wt) / 1e3 : 0;
    },
    final() {
      const now = performance.now();
      if (warmT !== null && now - warmT >= 1500) return (bytes - warmB) * 8 / (now - warmT) / 1e3;
      return bytes * 8 / (now - t0) / 1e3;
    }
  };
}

const BASE_MS = 7000, BASE_DL = 250e6, BASE_UL = 80e6;
const lim = () => { const ms = LENGTHS[settings.len] || BASE_MS, f = ms / BASE_MS; return { ms, dl: BASE_DL * f, ul: BASE_UL * f }; };

async function measureLatency(n = 12) {
  const s = [];
  let lost = 0;
  for (let i = 0; i < n; i++) {
    if (userStopped) throw new Error('stopped');
    const t = performance.now();
    try { await getRaw(`${CF}/__down?bytes=0&_=${Date.now()}${i}`, 4000); s.push(performance.now() - t); }
    catch { lost++; }
    setBar((i + 1) / n * 0.12);
    await sleep(90);
  }
  const good = s.slice(1);
  if (!good.length) throw new Error('Cloudflare unreachable');
  const sorted = [...good].sort((a, b) => a - b);
  const ping = sorted[Math.floor(sorted.length / 2)];
  const jitter = good.length > 1 ? good.slice(1).reduce((a, v, i) => a + Math.abs(v - good[i]), 0) / (good.length - 1) : 0;
  return { ping, jitter, loss: lost / n * 100 };
}

async function measureDownload(progressBase) {
  const L = lim();
  const meter = makeMeter();
  const ctrl = new AbortController();
  cancelPhase = () => ctrl.abort();
  const sizes = [1e6, 1e7, 2.5e7, 2.5e7, 2.5e7, 2.5e7];
  const t0 = performance.now();
  let stop = false;
  const timer = setInterval(() => {
    const el = performance.now() - t0;
    setGauge(meter.tick());
    setBar(progressBase + clamp(el / L.ms, 0, 1) * 0.44);
    if (el >= L.ms || meter.bytes >= L.dl) { stop = true; ctrl.abort(); }
  }, 100);

  const worker = async () => {
    for (let i = 0; !stop; i++) {
      const res = await fetch(`${CF}/__down?bytes=${sizes[Math.min(i, sizes.length - 1)]}&_=${Date.now()}${i}`, { ...FETCH_OPTS, signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (!res.body) { meter.add((await res.arrayBuffer()).byteLength); continue; }
      const reader = res.body.getReader();
      for (;;) { const { done, value } = await reader.read(); if (done) break; meter.add(value.length); }
    }
  };
  try { await Promise.all(Array.from({ length: 4 }, () => worker().catch(e => { if (e.name !== 'AbortError') throw e; }))); }
  finally { clearInterval(timer); cancelPhase = null; }
  if (userStopped) throw new Error('stopped');
  if (meter.bytes < 1000) throw new Error('Download blocked');
  return { mbps: meter.final(), bytes: meter.bytes };
}

function randomBlob(size) {
  const buf = new Uint8Array(size);
  for (let o = 0; o < size; o += 65536) crypto.getRandomValues(buf.subarray(o, Math.min(o + 65536, size)));
  return new Blob([buf], { type: 'text/plain' });
}

async function measureUpload(progressBase) {
  const L = lim();
  const meter = makeMeter();
  const blobs = [randomBlob(1e6), randomBlob(5e6)];
  const live = new Set();
  let stop = false, errors = 0;
  cancelPhase = () => { stop = true; live.forEach(x => x.abort()); };
  const t0 = performance.now();
  const timer = setInterval(() => {
    const el = performance.now() - t0;
    setGauge(meter.tick());
    setBar(progressBase + clamp(el / L.ms, 0, 1) * 0.44);
    if (el >= L.ms || meter.bytes >= L.ul) { stop = true; live.forEach(x => x.abort()); }
  }, 100);

  const worker = () => new Promise(resolve => {
    let i = 0;
    const next = () => {
      if (stop || errors > 3) return resolve();
      const xhr = new XMLHttpRequest();
      let last = 0;
      live.add(xhr);
      xhr.open('POST', `${CF}/__up?_=${Date.now()}${i}`);
      xhr.setRequestHeader('Content-Type', 'text/plain');
      const blob = blobs[Math.min(i, 1)];
      xhr.upload.onprogress = e => { meter.add(e.loaded - last); last = e.loaded; };

      xhr.onload = () => { meter.add(Math.max(0, blob.size - last)); live.delete(xhr); next(); };
      xhr.onerror = xhr.ontimeout = () => { live.delete(xhr); errors++; next(); };
      xhr.onabort = () => { live.delete(xhr); resolve(); };
      xhr.timeout = 15000;
      xhr.send(blob); i++;
    };
    next();
  });
  try { await Promise.all([worker(), worker(), worker()]); }
  finally { clearInterval(timer); cancelPhase = null; }
  if (userStopped) throw new Error('stopped');
  if (meter.bytes < 1000) throw new Error('Upload blocked');
  return { mbps: meter.final(), bytes: meter.bytes };
}

function verdictFor(down) {
  if (down < 5)   return ['Slow', 'Basic browsing and messaging will work. Video may buffer.'];
  if (down < 25)  return ['Decent', 'Fine for HD streaming and everyday use.'];
  if (down < 100) return ['Good', 'Plenty for 4K streaming and a few people at once.'];
  if (down < 300) return ['Fast', 'Big downloads and a busy household? No problem.'];
  return ['Blazing', 'This is seriously quick.'];
}

function renderQuality(r) {
  const items = [
    ['HD video',      r.down >= 5],
    ['4K streaming',  r.down >= 25],
    ['Video calls',   r.down >= 5 && r.up >= 3 && r.ping < 150],
    ['Online gaming', r.ping < 60 && r.jitter < 25 && r.loss < 2]
  ];
  const box = $('#quality');
  box.replaceChildren(...items.map(([label, ok]) => {
    const s = document.createElement('span');
    s.className = 'q' + (ok ? '' : ' no');
    s.innerHTML = `<svg class="ic xs"><use href="#${ok ? 'i-check' : 'i-x'}"/></svg>`;
    s.append(label);
    return s;
  }));
  box.hidden = false;
  const [title, sub] = verdictFor(r.down);
  $('#verdictTitle').textContent = title;
  $('#verdictSub').textContent = sub;
  $('#verdict').hidden = false;
}

let lastTiles = {};
function setTiles(r) {
  lastTiles = r;
  const f = v => v == null ? '—' : fmtSpeed(v);
  $('#rDown').textContent = f(r.down);
  $('#rUp').textContent = f(r.up);
  $('#rPing').textContent = r.ping == null ? '—' : Math.round(r.ping);
  $('#rJit').textContent = r.jitter == null ? '—' : r.jitter.toFixed(1);
}

function setRunning(on) {
  running = on;
  $('#btnTest').classList.toggle('running', on);
  $('#btnTestLbl').textContent = on ? 'Stop' : 'Start test';
  setIcon($('#btnTest svg'), on ? 'i-stop' : 'i-play');
  $('#bar').parentElement.classList.toggle('on', on);
  updatePingLoop();
}

async function runTest() {
  if (running) { userStopped = true; cancelPhase?.(); return; }
  if (!navigator.onLine) return toast('You\'re offline');
  userStopped = false;
  setRunning(true);
  buzz(10);
  setTiles({}); $('#verdict').hidden = true; $('#quality').hidden = true;
  setGauge(0); gShown = 0; setBar(0);
  const res = {};
  let used = 0;
  try {
    setStep('ping'); gPhase.textContent = 'Latency';
    Object.assign(res, await measureLatency());
    setTiles({ ping: res.ping, jitter: res.jitter });

    setStep('download'); gPhase.textContent = 'Download'; setGauge(0);
    const d = await measureDownload(0.12);
    res.down = d.mbps; used += d.bytes;
    setTiles({ ...res });
    setGauge(res.down);
    await sleep(700);

    setStep('upload'); gPhase.textContent = 'Upload'; setGauge(0);
    const u = await measureUpload(0.56);
    res.up = u.mbps; used += u.bytes;
    setTiles({ ...res });

    setStep('done'); setBar(1);
    gPhase.textContent = 'Download';
    setGauge(res.down);
    renderQuality(res);
    $('#dataHint span').textContent = `Used about ${(used / 1e6).toFixed(0)} MB this run.`;
    saveHistory(res);
    toast('Done! ' + fmtSpeed(res.down) + ' ' + unit().label + ' down');
    buzz([30, 50, 30]);
  } catch (e) {
    setStep(null); setBar(0);
    gPhase.textContent = 'Ready'; setGauge(0);
    if (e.message !== 'stopped') toast('Test failed: ' + safe(e.message, 60) + '. Is Cloudflare blocked?');
    else toast('Test stopped');
  } finally {
    setRunning(false);
  }
}
$('#btnTest').addEventListener('click', runTest);

function saveHistory(r) {
  const h = store.get('biscotti.hist', []);
  h.unshift({ t: Date.now(), down: r.down, up: r.up, ping: r.ping, jitter: r.jitter });
  store.set('biscotti.hist', h.slice(0, 8));
  renderHistory();
}
function renderHistory() {
  const h = store.get('biscotti.hist', []).filter(x => x && Number.isFinite(x.down));
  const ul = $('#histList');
  $('#histEmpty').hidden = h.length > 0;
  $('#btnClearHist').hidden = h.length === 0;
  ul.replaceChildren(...h.map(x => {
    const li = document.createElement('li'); li.className = 'li hist';
    const nm = document.createElement('span'); nm.className = 'nm';
    nm.append(new Date(x.t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }));
    const sm = document.createElement('small'); sm.textContent = `${Math.round(x.ping)} ms ping, ${Number(x.jitter).toFixed(1)} ms jitter`;
    nm.append(sm);
    const a = document.createElement('span'); a.className = 'arrows';
    const mk = (id, v) => { const s = document.createElement('span'); s.innerHTML = `<svg class="ic xs"><use href="#${id}"/></svg> `; const b = document.createElement('b'); b.textContent = fmtSpeed(v); s.append(b, ' ' + unit().label); return s; };
    a.append(mk('i-down', x.down), mk('i-up', x.up));
    li.append(nm, a);
    return li;
  }));
  const last = h[0];
  if (last && $('#rDown').textContent === '—') {
    setTiles(last);
    renderQuality({ ...last, loss: 0 });
  }
}
async function clearHistory() {
  if (!await confirmDialog('clear speed test history?', 'this removes the results saved on this device... cant undo it')) return;
  store.set('biscotti.hist', []); renderHistory(); toast('History cleared');
}
$('#btnClearHist').addEventListener('click', clearHistory);
$('#actClearHist').addEventListener('click', clearHistory);

const lp = { samples: [], lost: 0, total: 0, busy: false, timer: null };

function updatePingLoop() {
  const want = settings.live && view === 'speed' && !document.hidden && !running && navigator.onLine;
  if (want && !lp.timer) { tickPing(); lp.timer = setInterval(tickPing, 1500); }
  else if (!want && lp.timer) { clearInterval(lp.timer); lp.timer = null; }
}
document.addEventListener('visibilitychange', updatePingLoop);

async function tickPing() {
  if (lp.busy) return;
  lp.busy = true;
  const t = performance.now();
  lp.total++;
  try { await getRaw(`${CF}/__down?bytes=0&_=${Date.now()}`, 3000); lp.samples.push(performance.now() - t); if (lp.samples.length > 40) lp.samples.shift(); }
  catch { lp.lost++; }
  lp.busy = false;
  renderLive();
}

const NS = 'http://www.w3.org/2000/svg';
function renderLive() {
  const s = lp.samples;
  if (!s.length) { $('#lpNow').textContent = '—'; return; }
  const min = Math.min(...s), max = Math.max(...s), avg = s.reduce((a, b) => a + b, 0) / s.length;
  const jit = s.length > 1 ? s.slice(1).reduce((a, v, i) => a + Math.abs(v - s[i]), 0) / (s.length - 1) : 0;
  $('#lpNow').textContent = Math.round(s[s.length - 1]);
  $('#lpMin').textContent = Math.round(min) + ' ms';
  $('#lpAvg').textContent = Math.round(avg) + ' ms';
  $('#lpMax').textContent = Math.round(max) + ' ms';
  $('#lpJit').textContent = jit.toFixed(1) + ' ms';
  $('#lpLoss').textContent = (lp.lost / lp.total * 100).toFixed(0) + '%';
  $('#lpN').textContent = lp.total;

  const svg = $('#spark');
  const W = 300, H = 80, pad = 6;
  const lo = Math.max(0, min - 5), hi = Math.max(max + 5, lo + 20);
  const x = i => s.length === 1 ? W / 2 : (i / (s.length - 1)) * W;
  const y = v => H - pad - ((v - lo) / (hi - lo)) * (H - pad * 2);
  const pts = s.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  svg.replaceChildren();
  const base = document.createElementNS(NS, 'line');
  base.setAttribute('class', 'base'); base.setAttribute('x1', 0); base.setAttribute('x2', W); base.setAttribute('y1', y(avg)); base.setAttribute('y2', y(avg));
  const area = document.createElementNS(NS, 'path');
  area.setAttribute('class', 'area'); area.setAttribute('d', `M0,${H} L${pts.join(' L')} L${W},${H} Z`);
  const line = document.createElementNS(NS, 'polyline');
  line.setAttribute('class', 'line'); line.setAttribute('points', pts.join(' '));
  svg.append(base, area, line);
}

function parseUA() {
  const ua = navigator.userAgent;
  let browser = 'Browser', ver = '';
  const m = (re) => (ua.match(re) || [])[1];
  if ((ver = m(/Edg\/([\d.]+)/))) browser = 'Edge';
  else if ((ver = m(/OPR\/([\d.]+)/))) browser = 'Opera';
  else if ((ver = m(/SamsungBrowser\/([\d.]+)/))) browser = 'Samsung Internet';
  else if ((ver = m(/(?:Firefox|FxiOS)\/([\d.]+)/))) browser = 'Firefox';
  else if ((ver = m(/(?:Chrome|CriOS)\/([\d.]+)/))) browser = 'Chrome';
  else if ((ver = m(/Version\/([\d.]+).*Safari/))) browser = 'Safari';
  let os = 'Unknown OS';
  if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  const tablet = /iPad/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua));
  return { browser, ver: (ver || '').split('.')[0], os, mobile: /Mobi|Android|iPhone|iPad/.test(ua), tablet };
}

function gpuName() {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return null;
    const e = gl.getExtension('WEBGL_debug_renderer_info');
    return safe(e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), 90);
  } catch { return null; }
}

const report = [];
function kvEl(label, value, note) {
  const d = document.createElement('div');
  const dt = document.createElement('dt'); dt.textContent = label;
  const dd = document.createElement('dd'); dd.textContent = value; dd.title = value;
  if (note) dd.append(Object.assign(document.createElement('small'), { textContent: note }));
  d.append(dt, dd); return d;
}


const DEVICE_DB = 'https://cdn.jsdelivr.net/gh/bsthen/device-models@main/devices.json';
const SPEC_API = 'https://gettechapi.github.io/TechAPI/v1/';
const NOISE = /\b(5g|4g|lte|nfc|global|india|eea|dual sim|wi-?fi|cellular|edition|version)\b/gi;
const DB_V = 3;
const pretty = s => s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const listOf = d => (Array.isArray(d) ? d : Object.values(d || {}).find(Array.isArray) || []).filter(e => e && typeof e.slug === 'string');
const VARIANT = /^(-(\d+(gb|tb)|[45]g|lte|wifi|wi|fi|global|cellular))*$/;
const indexes = {};
const BRAND_NAMES = { lge: 'LG', htc: 'HTC', zte: 'ZTE', oppo: 'OPPO', oneplus: 'OnePlus', hmd: 'HMD', tcl: 'TCL', asus: 'ASUS' };
const OWN_LINES = { xiaomi: /^(redmi|poco|mi)\b/i };
const RETRY_MS = 3 * 864e5;
const dev = { p: null, sub: '', osLine: '', model: '', dpr: 1, mem: '', gpu: null, lookup: false, rec: null, exactState: 'idle' };
const deviceKind = p => p.tablet ? 'Tablet' : p.mobile ? 'Mobile device' : 'Desktop / laptop';
const deviceIcon = p => p.tablet ? 'i-tablet' : p.mobile ? 'i-phone' : 'i-laptop';

function brandLabel(b) {
  const s = safe(b, 30).trim();
  const k = s.toLowerCase();
  return BRAND_NAMES[k] || (s === k ? s.charAt(0).toUpperCase() + s.slice(1) : s);
}

function fullName(brand, name) {
  const own = OWN_LINES[brand.toLowerCase()];
  if (!name || !brand || name.toLowerCase().startsWith(brand.toLowerCase()) || (own && own.test(name))) return name;
  return `${brand} ${name}`;
}

const slugify = s => s.toLowerCase().replace(/\+/g, ' plus ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function nearestKey(keys, key) {
  let best = null;
  let bestLen = Math.max(4, key.length - 2) - 1;
  for (const k of keys) {
    const u = k.toUpperCase();
    let i = 0;
    while (i < u.length && i < key.length && u[i] === key[i]) i++;
    if (i > bestLen) { best = k; bestLen = i; }
  }
  return best;
}

async function findModel(model) {
  const data = await getJSON(DEVICE_DB, 30000);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid device database');
  }

  const key = model.trim().toUpperCase();
  let hit = data[key];
  let approx = false;

  if (!hit) {
    const base = (key.match(/^SM-[A-Z]\d{3}/) || [])[0];
    const sameBase = base && Object.keys(data).find(k => k.toUpperCase().startsWith(base));
    if (sameBase) hit = data[sameBase];
  }

  if (!hit) {
    const near = nearestKey(Object.keys(data), key);
    if (near) { hit = data[near]; approx = true; }
  }

  if (!hit || typeof hit !== 'object') return null;

  const brand = brandLabel(hit.brand);
  const market = safe(hit.name, 60).trim();

  return market
    ? { brand, market, name: fullName(brand, market), approx }
    : null;
}

function nameTiers(rec) {
  const bare = rec.market.replace(/\s+5G$/i, '');
  const tiers = [[rec.market, `${rec.brand} ${rec.market}`, bare, `${bare} 5G`, `${rec.brand} ${bare}`]];
  const words = rec.market.replace(/\([^)]*\)/g, ' ').replace(NOISE, ' ').split(/\s+/).filter(Boolean);
  if (words[0] && words[0].toLowerCase() === rec.brand.toLowerCase()) words.shift();
  for (let n = words.length; n >= 2; n--) {
    const name = words.slice(0, n).join(' ');
    if (n < words.length && !/\d/.test(name)) break;
    tiers.push([name, `${rec.brand} ${name}`, `${name} 5G`]);
  }
  return tiers;
}

async function fetchSpec(kind, slugs) {
  try {
    const d = await Promise.any(slugs.map(slug => getJSON(`${SPEC_API}${kind}/${slug}/index.json`, 12000)));
    return d && typeof d === 'object' ? { d, confirmed: false, loose: false } : null;
  } catch { return null; }
}

const loadIndex = kind => indexes[kind] || (indexes[kind] = getJSON(`${SPEC_API}${kind}/index.json`, 30000).then(listOf).catch(e => { delete indexes[kind]; throw e; }));

async function fetchTablet(slugs, model, strict) {
  let list;
  try { list = await loadIndex('tablets'); } catch { return null; }
  const hits = new Map();
  for (const s of slugs) for (const e of list) {
    if (!e.slug.startsWith(s)) continue;
    const rest = e.slug.slice(s.length);
    if (rest && rest[0] !== '-') continue;
    const rank = !rest ? 0 : VARIANT.test(rest) ? 1 : 2;
    if (rank === 2 && strict) continue;
    if (!hits.has(e.slug) || rank < hits.get(e.slug)) hits.set(e.slug, rank);
  }
  const top = [...hits].sort((a, b) => a[1] - b[1] || a[0].length - b[0].length).slice(0, 8);
  const docs = await Promise.all(top.map(async ([slug, rank]) => {
    try {
      const d = await getJSON(`${SPEC_API}tablets/${slug}/index.json`, 12000);
      return d && typeof d === 'object' ? { d, rank } : null;
    } catch { return null; }
  }));
  const ok = docs.filter(Boolean);
  const same = ok.find(x => Array.isArray(x.d.model_numbers) && x.d.model_numbers.some(m => String(m).toUpperCase() === model.toUpperCase()));
  const pick = same || ok[0];
  return pick ? { d: pick.d, confirmed: !!same, loose: pick.rank === 2 } : null;
}

async function findSpecs(rec, tablet, model) {
  const kinds = tablet ? ['tablets', 'smartphones'] : ['smartphones', 'tablets'];
  const seen = new Set();
  const tiers = nameTiers(rec);
  for (let i = 0; i < tiers.length; i++) {
    const slugs = [...new Set(tiers[i].map(slugify))].filter(s => s && !seen.has(s));
    if (!slugs.length) continue;
    slugs.forEach(s => seen.add(s));
    const found = await Promise.all(kinds.map(async k => (k === 'tablets' && await fetchTablet(slugs, model, i === 0)) || fetchSpec(k, slugs)));
    const hit = found.find(Boolean);
    if (hit) return { d: await resolveSoc(hit.d), approx: !hit.confirmed && (i > 0 || hit.loose) };
  }
  return null;
}

async function resolveSoc(d) {
  if (typeof d.soc !== 'string') return d;
  let r = null;
  try { r = await getJSON(`${SPEC_API}socs/${d.soc}/index.json`, 8000); } catch {}
  r = r && typeof r === 'object' ? r : {};
  const gpu = typeof r.gpu_name === 'string' ? r.gpu_name : r.gpu && typeof r.gpu.name === 'string' ? r.gpu.name : '';
  return { ...d, soc: { name: typeof r.name === 'string' ? r.name : pretty(d.soc), process_nm: r.process_nm, gpu_name: gpu } };
}

const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
const sizeGB = g => g >= 1024 ? `${+(g / 1024).toFixed(2)} TB` : `${g} GB`;

function specRows(d) {
  const rows = [];
  const add = (k, v) => { if (v) rows.push([k, safe(v, 120)]); };
  const soc = d.soc && typeof d.soc === 'object' ? d.soc : {};
  const disp = d.display || {}, con = d.connectivity || {}, dim = d.dimensions || {};
  const cams = Array.isArray(d.cameras) ? d.cameras : [];
  const inches = num(disp.size_inch) || parseFloat((String(disp.size || '').match(/([\d.]+)\s*inch/) || [])[1]);
  const px = String(disp.resolution || '').match(/(\d+)\s*x\s*(\d+)/);
  const hz = num(disp.refresh_hz) || parseInt((String(disp.type || '').match(/(\d+)\s*Hz/i) || [])[1], 10);
  const bt = String(con.bluetooth || '').match(/^[\d.]+/);
  const wifi = String(con.wifi || con.wlan || '').split(',')[0].trim();
  const nfc = con.nfc === true || /^yes/i.test(String(con.nfc));
  add('Chipset', soc.name ? `${safe(soc.name, 60)}${num(soc.process_nm) ? ` (${soc.process_nm} nm)` : ''}` : '');
  add('GPU', safe(soc.gpu_name, 60));
  add('Memory', num(d.ram_gb) ? `${d.ram_gb} GB` : '');
  add('Storage', Array.isArray(d.storage_options_gb) ? d.storage_options_gb.filter(num).map(sizeGB).join(', ') : '');
  add('Display', Number.isFinite(inches) ? `${inches}″${px ? ` ${px[1]} × ${px[2]}` : ''}` : '');
  add('Panel', safe(disp.type, 80));
  add('Refresh rate', Number.isFinite(hz) ? `${hz} Hz` : '');
  add('Peak brightness', num(disp.brightness_nits) ? `${disp.brightness_nits} nits` : '');
  const rear = cams.filter(c => c && c.type !== 'selfie' && num(c.mp)).map(c => c.mp);
  add('Rear cameras', rear.length ? `${rear.join(' + ')} MP` : '');
  const front = cams.find(c => c && c.type === 'selfie' && num(c.mp));
  add('Front camera', front ? `${front.mp} MP` : '');
  add('Battery', num(d.battery_mah) ? `${d.battery_mah} mAh` : '');
  add('Charging', [num(d.charging_wired_w) ? `${d.charging_wired_w} W wired` : '', num(d.charging_wireless_w) ? `${d.charging_wireless_w} W wireless` : ''].filter(Boolean).join(', '));
  add('Size', num(dim.height_mm) && num(dim.width_mm) && num(dim.depth_mm) ? `${dim.height_mm} × ${dim.width_mm} × ${dim.depth_mm} mm` : '');
  add('Weight', num(d.weight_g) ? `${d.weight_g} g` : '');
  add('Water resistance', safe(d.ip_rating, 10));
  add('Wireless', [safe(wifi, 40), bt ? `Bluetooth ${bt[0]}` : '', nfc ? 'NFC' : ''].filter(Boolean).join(', '));
  add('Port', safe(con.usb, 40));
  const rel = typeof d.release_date === 'string' ? new Date(d.release_date + 'T00:00:00') : null;
  add('Released', rel && !isNaN(rel) ? rel.toLocaleDateString([], { month: 'short', year: 'numeric' }) : '');
  return rows;
}

function launchOS(d) {
  const os = safe(d.os, 80).split(',')[0].trim(), v = safe(d.os_version, 10);
  return os ? (v && !os.includes(v) ? `${os} ${v}` : os) : '';
}

function paintExactHint() {
  const state = settings.exact ? dev.exactState : 'idle';
  const text = {
    idle: 'Shows your phone or tablet\u2019s full name and specs. Downloads public lists once',
    loading: 'Looking up your phone\u2026',
    ok: dev.rec && dev.rec.picked ? `You picked ${dev.rec.name}` : dev.rec && dev.rec.approx ? `Closest match for ${dev.model}` : `Matched ${dev.model}`,
    nospec: `Matched ${dev.model}, but no spec sheet was found for it`,
    miss: dev.model ? `No match for ${dev.model} in the list` : 'Couldn\u2019t detect your model. Search for it on the Device page',
    fail: 'Couldn\u2019t load the lists. Try again later'
  }[state];
  $('#exactHint').textContent = text;
  paintPick();
}

function tileEl(cls, icon, label, value, sub) {
  const d = document.createElement('div');
  d.className = `tile ${cls}`.trim();
  d.innerHTML = `<svg class="ic"><use href="#${icon}"/></svg>`;
  const t = (tag, c, text) => Object.assign(document.createElement(tag), { className: c, textContent: text });
  d.append(t('span', 'tile-l', label), t('strong', 'tile-v', value), ...(sub ? [t('small', 'tile-s', sub)] : []));
  return d;
}

function paintDevice() {
  if (!dev.p) return;
  const { p, sub, osLine, dpr, mem, gpu } = dev;
  const rec = settings.exact ? dev.rec : null;
  const specs = rec && rec.hw.length ? rec.hw : null;
  const engine = `${p.browser}${p.ver ? ' ' + p.ver : ''} on ${p.os}`;
  const name = rec ? rec.name : engine;
  bind('devName', name); bind('devSub', sub);
  $('#devNote').hidden = !(rec && rec.approx);

  const seen = navigator.deviceMemory;
  const live = ([a, b]) => {
    const base = parseFloat(b);
    if (a !== 'Memory' || !seen || !(seen > base)) return [a, b];
    return [a, `${b} (${seen}${seen >= 8 ? '+' : ''}*)`, '*Actual value detected from hardware'];
  };
  const hw = specs ? specs.map(live) : [
    ['Screen', `${screen.width} × ${screen.height}`],
    ['CPU threads', String(navigator.hardwareConcurrency || 'Hidden')],
    ['Memory', mem],
    ['Pixel ratio', `${dpr.toFixed(2).replace(/\.?0+$/, '')}×`]
  ];
  $('#hwList').replaceChildren(...hw.map(([a, b, c]) => kvEl(a, b, c)));

  const row = k => (hw.find(r => r[0] === k) || [])[1];
  const ram = row('Memory'), rom = row('Storage');
  const tiles = specs ? [
    ['i-chip', 'Chipset', row('Chipset')],
    ['i-gpu', 'GPU', row('GPU')],
    ['i-storage', ram ? 'Memory' : 'Storage', ram || rom, ram && rom ? `${rom} storage` : '']
  ].filter(t => t[2]) : [];
  const kind = p.tablet ? 'Tablet' : p.mobile ? 'Phone' : 'Laptop';
  const bento = $('#ovBento');
  bento.style.setProperty('--rows', Math.max(tiles.length, 1));
  bento.classList.toggle('solo', !tiles.length);
  bento.replaceChildren(tileEl('tall', 'art', kind, name), ...tiles.map(t => tileEl('', ...t)));
  $('#ovDevice').hidden = !specs;
  $('#ovNote').hidden = !(rec && rec.approx);

  const sw = specs ? [['System', osLine], ...(rec.launch ? [['Launched with', rec.launch]] : [])] : [];
  $('#swList').replaceChildren(...sw.map(([a, b]) => kvEl(a, b)));
  $('#swBox').hidden = !sw.length;

  const dark = mq.matches ? 'Dark' : 'Light';
  const sys = [
    rec ? ['WebView', engine] : ['Browser', `${p.browser} ${p.ver}`.trim()],
    ['System', osLine],
    ['Viewport', `${innerWidth} × ${innerHeight}`],
    ['Color depth', `${screen.colorDepth}-bit`],
    ['Touch points', String(navigator.maxTouchPoints || 0)],
    ['Language', navigator.language || '—'],
    ['Time zone', Intl.DateTimeFormat().resolvedOptions().timeZone || '—'],
    ['System theme', dark],
    ['Reduced motion', matchMedia('(prefers-reduced-motion: reduce)').matches ? 'Yes' : 'No'],
    ['Secure context', window.isSecureContext ? 'Yes (HTTPS)' : 'No'],
    ['Cookies', navigator.cookieEnabled ? 'Enabled' : 'Disabled'],
    ...(gpu && !specs ? [['GPU', gpu]] : [])
  ];
  $('#sysKv').replaceChildren(...sys.map(([a, b]) => kvEl(a, b)));

  report.length = 0;
  report.push('biscotti report', `Device: ${name} (${sub})`, ...(rec && rec.approx ? ['Note: closest match, data may be inaccurate'] : []), ...hw.map(([a, b, c]) => `${a}: ${b}${c ? ' ' + c : ''}`), ...sw.map(([a, b]) => `${a}: ${b}`), ...sys.map(([a, b]) => `${a}: ${b}`));
  paintExactHint();
}

function readMiss() {
  const m = store.get('biscotti.exactMiss', null);
  return !!m && m.v === DB_V && m.model === dev.model && Date.now() - (Number(m.at) || 0) < RETRY_MS;
}

function readRec(key) {
  const c = store.get(key, null);
  if (!c || c.v !== DB_V || c.model !== dev.model || typeof c.name !== 'string' || !c.name || !Array.isArray(c.hw)) return null;
  const pair = x => Array.isArray(x) && x.length === 2 ? [safe(x[0], 40), safe(x[1], 120)] : null;
  return {
    model: c.model, brand: safe(c.brand, 30), market: safe(c.market, 60), name: safe(c.name, 90),
    hw: c.hw.map(pair).filter(Boolean), launch: safe(c.launch, 30), at: Number(c.at) || 0,
    approx: c.approx === true, picked: c.picked === true
  };
}
const readExact = () => readRec('biscotti.spec');
const readPick = () => readRec('biscotti.pick');

const pick = { items: null, found: [], chosen: null, timer: 0 };
const norm = t => t.toLowerCase().replace(/[^a-z0-9+]+/g, ' ').trim();

function pickIndex() {
  if (!pick.items) {
    pick.items = Promise.all(['smartphones', 'tablets'].map(async kind => {
      const list = listOf(await getJSON(`${SPEC_API}${kind}/index.json`, 45000));
      return list.map(e => {
        const label = fullName(brandLabel(e.brand), safe(e.name, 90).trim() || pretty(e.slug));
        return { kind, slug: e.slug, label, text: norm(label) };
      });
    })).then(all => all.flat()).catch(err => { pick.items = null; throw err; });
  }
  return pick.items;
}

function searchPick(items, query) {
  const words = norm(query).split(' ').filter(Boolean);
  const phrase = words.join(' ');
  const seen = new Set();
  const hits = [];
  for (const it of items) {
    if (seen.has(it.text) || !words.every(w => it.text.includes(w))) continue;
    seen.add(it.text);
    const rank = it.text.startsWith(phrase) ? 0 : words.every(w => ` ${it.text}`.includes(` ${w}`)) ? 1 : 2;
    hits.push({ it, rank, own: it.kind === (dev.p.tablet ? 'tablets' : 'smartphones') ? 0 : 1 });
  }
  return hits
    .sort((a, b) => a.rank - b.rank || a.own - b.own || a.it.text.length - b.it.text.length)
    .slice(0, 6)
    .map(h => h.it);
}

function paintPick() {
  $('#pickTitle').textContent = dev.model ? 'Device not in database' : 'Umm... device not in database';
  $('#pickCard').hidden = !(settings.exact && dev.exactState === 'miss' && !dev.rec);
  $('#pickReset').hidden = !(settings.exact && dev.rec && dev.rec.picked);
}

function showPick(step) {
  $('#pickAsk').hidden = step !== 'ask';
  $('#pickSure').hidden = step !== 'sure';
}

function resetPick() {
  clearTimeout(pick.timer);
  pick.found = [];
  pick.chosen = null;
  $('#pickInput').value = '';
  $('#pickList').replaceChildren();
  $('#pickStatus').textContent = '';
  showPick('ask');
}

async function loadPick() {
  const status = $('#pickStatus');
  status.textContent = 'Loading device list\u2026';
  try {
    const items = await pickIndex();
    status.textContent = '';
    return items;
  } catch {
    status.textContent = 'Couldn\u2019t load the device list. Check your connection and try again';
    return null;
  }
}

async function runPick() {
  const query = $('#pickInput').value;
  if (!norm(query)) { pick.found = []; $('#pickList').replaceChildren(); $('#pickStatus').textContent = ''; return; }
  const items = await loadPick();
  if (!items || $('#pickInput').value !== query) return;
  pick.found = searchPick(items, query);
  $('#pickList').replaceChildren(...pick.found.map((it, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    const sub = document.createElement('small');
    b.type = 'button';
    b.className = 'pick-opt ripple';
    b.dataset.i = i;
    b.append(it.label);
    sub.textContent = it.kind === 'tablets' ? 'Tablet' : 'Phone';
    b.append(sub);
    li.append(b);
    return li;
  }));
  $('#pickStatus').textContent = pick.found.length ? '' : 'No devices found. Try fewer words';
}

async function confirmPick() {
  const c = pick.chosen;
  const yes = $('#pickYes');
  yes.disabled = true;
  try {
    const d = await resolveSoc(await getJSON(`${SPEC_API}${c.kind}/${c.slug}/index.json`, 15000));
    const rec = { model: dev.model, brand: '', market: c.label, name: c.label, hw: specRows(d), launch: launchOS(d), at: Date.now(), approx: false, picked: true };
    if (!rec.hw.length) throw new Error('No specs');
    store.set('biscotti.pick', { v: DB_V, ...rec });
    dev.rec = rec;
    dev.exactState = 'ok';
    resetPick();
    paintDevice();
  } catch {
    toast('Couldn\u2019t load that device. Try another one');
  }
  yes.disabled = false;
}

$('#pickInput').addEventListener('focus', () => { if (!pick.items) loadPick(); });
$('#pickInput').addEventListener('input', () => {
  clearTimeout(pick.timer);
  pick.timer = setTimeout(runPick, 150);
});
$('#pickList').addEventListener('click', e => {
  const b = e.target.closest('.pick-opt');
  if (!b) return;
  pick.chosen = pick.found[Number(b.dataset.i)];
  $('#pickName').textContent = pick.chosen.label;
  showPick('sure');
  buzz(8);
});
$('#pickYes').addEventListener('click', confirmPick);
$('#pickNo').addEventListener('click', () => {
  resetPick();
  $('#pickInput').focus();
});
$('#pickReset').addEventListener('click', () => {
  store.set('biscotti.pick', null);
  dev.rec = null;
  dev.exactState = 'miss';
  paintDevice();
});

async function resolveExact(force) {
  if (!settings.exact) return;
  if (!dev.lookup) {
    dev.rec = dev.rec || readPick();
    dev.exactState = dev.rec ? 'ok' : 'miss';
    paintDevice();
    return;
  }
  let rec = dev.rec || readPick() || readExact();
  if (!rec && !force && readMiss()) { dev.exactState = 'miss'; paintExactHint(); return; }
  if (rec && (rec.hw.length || (!force && Date.now() - rec.at < RETRY_MS))) {
    dev.rec = rec; dev.exactState = rec.hw.length ? 'ok' : 'nospec'; paintDevice(); return;
  }
  if (!navigator.onLine) {
    if (rec) { dev.rec = rec; dev.exactState = 'nospec'; paintDevice(); } else { dev.exactState = 'fail'; paintExactHint(); }
    return;
  }
  dev.exactState = 'loading'; paintExactHint();
  try {
    if (!rec) {
      const hit = await findModel(dev.model);
      if (!hit) { store.set('biscotti.exactMiss', { v: DB_V, model: dev.model, at: Date.now() }); dev.exactState = 'miss'; paintExactHint(); return; }
      rec = { model: dev.model, ...hit, hw: [], launch: '', at: 0 };
    }
    const found = await findSpecs(rec, dev.p.tablet, dev.model);
    rec.hw = found ? specRows(found.d) : [];
    rec.launch = found ? launchOS(found.d) : '';
    if (found && found.approx) rec.approx = true;
    rec.at = Date.now();
    store.set('biscotti.spec', { v: DB_V, ...rec });
    dev.rec = rec;
    dev.exactState = rec.hw.length ? 'ok' : 'nospec';
  } catch { dev.exactState = 'fail'; }
  paintDevice();
}

async function renderDevice() {
  const p = parseUA();
  let sub = deviceKind(p), osLine = p.os, model = '';
  const uad = navigator.userAgentData;
  if (uad?.getHighEntropyValues) {
    try {
      const h = await uad.getHighEntropyValues(['platformVersion', 'model', 'architecture']);
      if (h.platformVersion && p.os !== 'Unknown OS') osLine = `${p.os} ${h.platformVersion.split('.').slice(0, p.os === 'Windows' ? 3 : 2).join('.')}`;
      if (h.model) { model = safe(h.model, 40); sub = model; }
      else if (h.architecture) sub += ', ' + safe(h.architecture, 10);
    } catch {}
  }
  const dpr = window.devicePixelRatio || 1;
  const mem = navigator.deviceMemory ? `${navigator.deviceMemory}${navigator.deviceMemory >= 8 ? '+' : ''} GB` : 'Hidden';
  Object.assign(dev, { p, sub, osLine, model, dpr, mem, gpu: gpuName(), lookup: p.os === 'Android' && !!model && model !== 'K' });
  if (dev.rec && dev.rec.model !== model) dev.rec = null;
  setIcon($('#devIcon'), deviceIcon(p));
  bind('ua', navigator.userAgent);

  if (settings.exact && !dev.rec) dev.rec = readPick() || readExact();
  paintDevice();
  resolveExact();

  if (navigator.getBattery) {
    try {
      const b = await navigator.getBattery();
      const upd = () => {
        const pct = Math.round(b.level * 100);
        $('#batPct').textContent = pct + '%';
        const f = $('#batFill'); f.style.width = pct + '%';
        f.style.background = pct <= 15 && !b.charging ? 'var(--bad)' : pct <= 30 && !b.charging ? 'var(--warn)' : 'var(--good)';
        $('#batSub').textContent = b.charging ? 'Charging' : 'On battery';
      };
      b.addEventListener('levelchange', upd); b.addEventListener('chargingchange', upd);
      upd(); $('#batCard').hidden = false;
    } catch {}
  }
}
$('#btnCopyReport').addEventListener('click', async () => {
  const lines = [...report];
  const last = store.get('biscotti.hist', [])[0];
  if (last) lines.push('', `Last speed test: ↓${fmtSpeed(last.down)} ↑${fmtSpeed(last.up)} ${unit().label}, ${Math.round(last.ping)} ms ping`);
  toast(await copy(lines.join('\n')) ? 'Report copied (no IP included)' : 'Couldn\'t copy');
});

async function refreshAll(force) {
  renderConn();
  await Promise.allSettled([loadIP(force), checkReach()]);
}
$('#btnRefresh').addEventListener('click', async e => {
  const b = e.currentTarget; b.classList.add('spin');
  await refreshAll(true); renderDevice();
  setTimeout(() => b.classList.remove('spin'), 600);
  toast('Refreshed');
});

function applyLen() {
  const l = lim();
  $('#dataHint span').textContent = `Uses up to about ${Math.round((l.dl + l.ul) / 1e6)}\u00a0MB of data. Servers are Cloudflare's.`;
  $('#lenHint').textContent = `About ${Math.round(l.ms / 1000)} seconds per step, up to ${Math.round((l.dl + l.ul) / 1e6)} MB of data`;
}
function applyUnit() {
  $$('[data-unit]').forEach(e => { e.textContent = unit().label; });
  $('.g-end.r').textContent = unit().end;
  renderHistory();
  setTiles(lastTiles);
  setGauge(gTarget);
}

showView(location.hash.slice(1));
renderConn();
renderHistory();
applyUnit();
applyLen();
renderDevice();
refreshAll(false);
updatePingLoop();

let installEvent = null;
addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installEvent = e;
  $('#installBox').hidden = false;
});
addEventListener('appinstalled', () => {
  installEvent = null;
  $('#installBox').hidden = true;
  toast('biscotti installed');
});
$('#actInstall').addEventListener('click', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  $('#installBox').hidden = true;
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

})();
