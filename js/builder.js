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
      l.innerHTML = `<input type="radio" name="pose" value="${p.id}"><img src="assets/poses/${p.id}.webp" alt="" width="760" height="988" loading="lazy" decoding="async"><span></span>`;
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
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'piece-swap';
    b.textContent = 'Switch to Phase 2 for headgear';
    b.addEventListener('click', () => toggle('h_p2'));
    box.append(b);
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
