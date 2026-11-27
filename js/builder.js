import { Kit } from './kit.js';
import { areas, gear } from './gear.js';
import { poses } from './poses.js';
import { icons } from './icons.js';
import { ver } from './kit-data.js';
import { say } from './toast.js';

const $ = (s) => document.querySelector(s);
const ready = gear.filter((g) => !g.soon);
const byId = new Map(ready.map((g) => [g.id, g]));
const KEY = 'noen-kit';
const listeners = [];
export const onKit = (fn) => listeners.push(fn);

const state = { kit: ['h_p2'], pose: 'rifle-down' };
let area = areas[0].id;
const FRONT = 25;

// two pieces that cannot be worn together
const clash = (a, b) => a.id !== b.id && ((a.slot && a.slot === b.slot) || !!a.off?.includes(b.id) || !!b.off?.includes(a.id));

// rules: one helmet, pieces that only fit some helmets, later pieces push out the ones they clash with
function tidy(ids) {
  const known = ids.filter((id) => byId.has(id));
  const helmet = known.findLast((id) => byId.get(id).slot === 'helmet') || 'h_p2';
  const out = [helmet];
  for (const id of known) {
    const g = byId.get(id);
    if (g.slot === 'helmet' || out.includes(id) || (g.only && !g.only.includes(helmet))) continue;
    for (let i = out.length - 1; i > 0; i--) if (clash(g, byId.get(out[i]))) out.splice(i, 1);
    if (!clash(g, byId.get(helmet))) out.push(id);
  }
  return out.filter((id) => !byId.get(id).needs || out.includes(byId.get(id).needs));
}

const brings = (g) => (g.brings || []).filter((id) => byId.has(id));

// the pictures for a kit: some pieces look different next to others
function pictures(kit) {
  const out = [kit.map((id) => byId.get(id).body).find(Boolean) || 'body'];
  for (const id of kit) {
    const g = byId.get(id);
    const v = g.as?.find((x) => x.with.every((w) => kit.includes(w)));
    out.push(v ? v.use : id);
  }
  return out;
}

function toggle(id) {
  const g = byId.get(id);
  const was = [...state.kit];
  let kit = [...state.kit];
  if (kit.includes(id)) {
    if (g.slot === 'helmet') return;
    kit = kit.filter((x) => x !== id);
  } else {
    if (g.needs && !kit.includes(g.needs)) kit.push(g.needs);
    kit.push(id, ...brings(g));
  }
  set(tidy(kit));
  // pieces of other groups that had to come off
  const off = was.filter((x) => x !== id && !state.kit.includes(x) && byId.get(x).area !== g.area).map((x) => byId.get(x).name);
  if (off.length) say(`${new Intl.ListFormat('en').format(off)} taken off`, 'Undo', () => set(was));
}

const code = () => [...state.kit.map((id) => id), state.pose].join('.');
export const link = () => `${location.origin}${location.pathname}#kit=${code()}`;

function parse(text) {
  const bits = text.split('.');
  const pose = bits.find((b) => b === 'own' || poses.some((p) => p.id === b));
  return { kit: tidy(bits.filter((b) => byId.has(b))), pose };
}

let view;
export function setupBuilder() {
  const root = $('#build-stage');
  view = new Kit(root);
  const tabs = $('#build-areas');
  for (const a of areas) {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = `area-${a.id}`;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', 'build-options');
    b.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${icons[a.id]}"/></svg><span></span><i></i>`;
    b.querySelector('span').textContent = a.name;
    b.addEventListener('click', () => openArea(a.id, true));
    tabs.append(b);
  }
  tabs.addEventListener('keydown', (e) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const n = (areas.findIndex((a) => a.id === area) + step + areas.length) % areas.length;
    openArea(areas[n].id, true);
    tabs.children[n].focus();
  });

  // poses, eight to a page
  const form = $('#pose-form');
  for (let n = 0; n < poses.length; n += 8) {
    const page = document.createElement('div');
    page.className = 'pose-page';
    for (const p of poses.slice(n, n + 8)) {
      const l = document.createElement('label');
      l.className = 'pose';
      l.innerHTML = `<input type="radio" name="pose" value="${p.id}"><img src="assets/poses/${p.id}.webp?v=2" alt="" width="760" height="988" loading="lazy" decoding="async"><span></span>`;
      l.querySelector('span').textContent = p.name;
      page.append(l);
    }
    form.append(page);
  }
  const pages = [...form.children];
  const at = () => Math.round(form.scrollLeft / Math.max(1, form.clientWidth));
  const mark = () => {
    $('#pose-page').textContent = `${at() + 1} of ${pages.length}`;
    $('#pose-prev').disabled = at() === 0;
    $('#pose-next').disabled = at() >= pages.length - 1;
  };
  const go = (n) => form.scrollTo({ left: n * form.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  $('#pose-prev').addEventListener('click', () => go(at() - 1));
  $('#pose-next').addEventListener('click', () => go(at() + 1));
  form.addEventListener('scroll', mark, { passive: true });
  addEventListener('resize', mark);
  $('.pose-nav').hidden = pages.length < 2;
  mark();
  $('.poses').addEventListener('change', (e) => { if (e.target.name === 'pose') { state.pose = e.target.value; changed(); } });

  $('#build-random').addEventListener('click', shuffle);
  $('#build-reset').addEventListener('click', () => { set(['h_p2']); openArea('helmet', true); });
  $('#build-full').addEventListener('click', () => look({ z: 1, y: 0.5, angle: FRONT }));

  const start = location.hash.startsWith('#kit=') ? location.hash.slice(5) : stored();
  if (start) {
    const s = parse(start);
    state.kit = s.kit;
    state.pose = s.pose || state.pose;
  }
  document.querySelector(`[name=pose][value="${state.pose}"]`).checked = true;
  openArea(area, false);
  if (location.hash.startsWith('#kit=')) $('#build').scrollIntoView({ behavior: 'instant' });

  // the layers only download when the builder is close to the screen
  const near = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    near.disconnect();
    set(state.kit);
    look({ z: 1, y: 0.5, angle: FRONT });
  }, { rootMargin: '900px 0px' });
  near.observe($('#build'));
  fire();
}

function stored() { try { return localStorage.getItem(KEY); } catch { return null; } }

function look(v) {
  view.look(v);
  $('#build-full').hidden = v.z === 1;
}

function openArea(id, move) {
  area = id;
  const a = areas.find((x) => x.id === id);
  for (const b of $('#build-areas').children) {
    const on = b.id === `area-${id}`;
    b.setAttribute('aria-selected', on);
    b.tabIndex = on ? 0 : -1;
  }
  options();
  if (move) look(a.view);
}

function options() {
  const box = $('#build-options');
  box.setAttribute('aria-labelledby', `area-${area}`);
  const helmet = state.kit.find((id) => byId.get(id).slot === 'helmet');
  const list = gear.filter((g) => g.area === area && (!g.only || g.only.includes(helmet)));
  box.replaceChildren(...list.map((g) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'piece';
    b.setAttribute('aria-pressed', state.kit.includes(g.id));
    b.disabled = !!g.soon;
    const s = document.createElement('span');
    s.textContent = g.name;
    const i = new Image();
    i.src = `assets/kit/${g.id}/thumb.webp?v=${ver[g.id]}`;
    i.alt = '';
    i.width = i.height = 192;
    b.append(i, s);
    if (g.soon) {
      const w = document.createElement('small');
      w.textContent = 'Coming soon';
      b.append(w);
    }
    b.addEventListener('click', () => toggle(g.id));
    return b;
  }));
  if (!list.length && area === 'head') {
    const p = document.createElement('p');
    p.className = 'piece-none';
    p.textContent = `No headgear fits the ${byId.get(helmet).name} helmet`;
    box.append(p);
  }
}

function set(kit) {
  state.kit = kit;
  view.wear(pictures(kit));
  const at = document.activeElement?.closest?.('.piece');
  const n = at ? [...at.parentElement.children].indexOf(at) : -1;
  options();
  if (n >= 0) $('#build-options').children[n]?.focus();
  changed();
}

function changed() {
  try { localStorage.setItem(KEY, code()); } catch {}
  fire();
}

function shuffle() {
  const take = (list) => list[Math.floor(Math.random() * list.length)];
  const helmet = take(ready.filter((g) => g.slot === 'helmet')).id;
  const kit = [helmet, ...brings(byId.get(helmet))];
  const guns = ready.filter((g) => g.slot === 'weapon');
  if (guns.length) kit.push(take(guns).id);
  const free = (g) => !kit.some((id) => clash(g, byId.get(id)));
  for (const a of areas) {
    if (a.id === 'helmet' || a.id === 'weapon') continue;
    const list = ready.filter((g) => g.area === a.id && (!g.only || g.only.includes(helmet)) && free(g) && (!g.needs || free(byId.get(g.needs))));
    if (list.length && Math.random() < 0.62) {
      const g = take(list);
      if (g.needs) kit.push(g.needs);
      kit.push(g.id);
    }
  }
  set(tidy([...new Set(kit)]));
  look({ z: 1, y: 0.5, angle: FRONT });
}

function fire() {
  const counts = {};
  for (const id of state.kit) (counts[byId.get(id).area] ||= []).push(byId.get(id).name);
  for (const a of areas) {
    const i = $(`#area-${a.id} i`);
    if (i) i.textContent = (counts[a.id] || []).join(', ');
  }
  for (const fn of listeners) fn(summary());
}

export function summary() {
  return {
    helmet: byId.get(state.kit.find((id) => byId.get(id).slot === 'helmet')).name,
    gear: state.kit.filter((id) => !['helmet', 'weapon'].includes(byId.get(id).slot)).map((id) => byId.get(id).name),
    weapon: byId.get(state.kit.find((id) => byId.get(id).slot === 'weapon'))?.name,
    pose: poses.find((p) => p.id === state.pose)?.name || 'Your own, described below',
  };
}

export async function picture() {
  if (!view.on.length) view.wear(pictures(state.kit));
  return view.picture(FRONT);
}

// the picture people save: his whole frame on the builder's paint, 1080 x 1350 for Instagram
export async function poster() {
  if (!view.on.length) view.wear(pictures(state.kit));
  const [frame, paint] = await Promise.all([view.picture(FRONT, true), new Promise((ok) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => ok(null);
    i.src = 'assets/paint-flat.webp';
  }), document.fonts.load('800 36px Anybody').catch(() => {})]);
  if (!frame) return null;
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  const g = c.getContext('2d');
  g.fillStyle = '#cf6240';
  g.fillRect(0, 0, c.width, c.height);
  if (paint) {
    const s = Math.max(c.width / paint.width, c.height / paint.height);
    g.drawImage(paint, (c.width - paint.width * s) / 2, (c.height - paint.height * s) / 2, paint.width * s, paint.height * s);
  }
  const s = (c.height * 0.96) / frame.height;
  const w = frame.width * s, h = frame.height * s;
  const x = (c.width - w) / 2, y = c.height - 66 - 0.955 * h;
  const fx = c.width / 2, fy = y + 0.955 * h;
  g.save();  // the ground shadow of the builder
  g.translate(fx, fy);
  g.scale(1, 110 / 560);
  const r = 280 * s;
  const sh = g.createRadialGradient(0, 0, 0, 0, 0, r);
  sh.addColorStop(0, '#100d0b8c');
  sh.addColorStop(1, '#100d0b00');
  g.fillStyle = sh;
  g.fillRect(-r, -r, 2 * r, 2 * r);
  g.restore();
  g.drawImage(frame, x, y, w, h);
  g.font = '800 36px Anybody';
  g.fillStyle = '#161514';
  g.textBaseline = 'alphabetic';
  g.fillText('noen.dev', 46, c.height - 44);
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.92));
}
