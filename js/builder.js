import { Kit } from './kit.js';
import { areas, gear } from './gear.js';
import { poses } from './poses.js';

const $ = (s) => document.querySelector(s);
const ready = gear.filter((g) => !g.soon);
const byId = new Map(ready.map((g) => [g.id, g]));
const KEY = 'noen-kit';
const listeners = [];
export const onKit = (fn) => listeners.push(fn);

const state = { kit: ['h_p2'], pose: 'rifle-down' };
let area = areas[0].id;

// rules: one helmet, pieces that only fit some helmets, pieces that replace each other
function tidy(ids) {
  const helmet = ids.find((id) => byId.get(id)?.slot === 'helmet') || 'h_p2';
  let out = ids.filter((id) => byId.has(id));
  out = out.filter((id) => byId.get(id).slot !== 'helmet' || id === helmet);
  if (!out.includes(helmet)) out.unshift(helmet);
  out = out.filter((id) => !byId.get(id).only || byId.get(id).only.includes(helmet));
  return out.filter((id) => !byId.get(id).needs || out.includes(byId.get(id).needs));
}

function toggle(id) {
  const g = byId.get(id);
  let kit = [...state.kit];
  if (kit.includes(id)) {
    if (g.slot === 'helmet') return;
    kit = kit.filter((x) => x !== id);
  } else {
    if (g.slot) kit = kit.filter((x) => byId.get(x).slot !== g.slot);
    if (g.needs && !kit.includes(g.needs)) kit.push(g.needs);
    kit.push(id);
  }
  set(tidy(kit));
}

const code = () => [...state.kit.map((id) => id), state.pose].join('.');
export const link = () => `${location.origin}${location.pathname}#kit=${code()}`;

function parse(text) {
  const bits = text.split('.');
  const pose = bits.find((b) => poses.some((p) => p.id === b));
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
    b.innerHTML = '<span></span><i></i>';
    b.firstChild.textContent = a.name;
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

  // poses
  const row = $('#pose-row');
  for (const p of poses) {
    const l = document.createElement('label');
    l.className = 'pose';
    l.innerHTML = `<input type="radio" name="pose" value="${p.id}"><img src="assets/poses/${p.id}.webp" alt="" width="540" height="720" loading="lazy" decoding="async"><span></span>`;
    l.querySelector('span').textContent = p.name;
    row.append(l);
  }
  row.addEventListener('change', (e) => { state.pose = e.target.value; changed(); });

  $('#build-random').addEventListener('click', shuffle);
  $('#build-reset').addEventListener('click', () => { set(['h_p2']); openArea('helmet', true); });
  $('#build-full').addEventListener('click', () => look({ z: 1, y: 0.5, angle: 25 }));

  const start = location.hash.startsWith('#kit=') ? location.hash.slice(5) : stored();
  if (start) {
    const s = parse(start);
    state.kit = s.kit;
    state.pose = s.pose || state.pose;
  }
  row.querySelector(`[value="${state.pose}"]`).checked = true;
  openArea(area, false);
  if (location.hash.startsWith('#kit=')) $('#build').scrollIntoView({ behavior: 'instant' });

  // the layers only download when the builder is close to the screen
  const near = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    near.disconnect();
    set(state.kit);
    look({ z: 1, y: 0.5, angle: 25 });
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
    if (!g.soon) {
      const i = new Image();
      i.src = `assets/kit/${g.id}/thumb.webp`;
      i.alt = '';
      i.width = i.height = 192;
      b.append(i);
    }
    b.append(s);
    b.addEventListener('click', () => toggle(g.id));
    return b;
  }));
  if (!list.length && area === 'head') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'piece-swap';
    b.textContent = 'Switch to Phase 2 for headgear';
    b.addEventListener('click', () => { set(tidy(['h_p2', ...state.kit.filter((x) => byId.get(x).slot !== 'helmet')])); });
    box.append(b);
  }
}

function set(kit) {
  state.kit = kit;
  view.wear(['body', ...kit]);
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
  const kit = [helmet];
  const guns = ready.filter((g) => g.slot === 'weapon');
  if (guns.length) kit.push(take(guns).id);
  for (const a of areas) {
    if (a.id === 'helmet' || a.id === 'weapon') continue;
    const list = ready.filter((g) => g.area === a.id && (!g.only || g.only.includes(helmet)));
    if (list.length && Math.random() < 0.62) {
      const g = take(list);
      if (g.needs) kit.push(g.needs);
      kit.push(g.id);
    }
  }
  set(tidy([...new Set(kit)]));
  look({ z: 1, y: 0.5, angle: 25 });
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
    pose: poses.find((p) => p.id === state.pose).name,
  };
}

export async function picture() {
  view.cam = { x: 0.5, y: 0.5, z: 1 };
  view.to = { x: 0.5, y: 0.5, z: 1 };
  return view.picture();
}
