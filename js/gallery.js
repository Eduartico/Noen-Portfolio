import { showcases, scenes } from './data.js';

const $ = (s) => document.querySelector(s);
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const src = (id, w) => `assets/work/${id}-${w}.webp`;

function tile(item, label, sizes, set, n) {
  const b = document.createElement('button');
  b.type = 'button';
  const i = new Image();
  i.loading = 'lazy';
  i.decoding = 'async';
  i.sizes = sizes;
  i.srcset = `${src(item.id, 640)} 640w, ${src(item.id, 1280)} 1280w`;
  i.src = src(item.id, 1280);
  i.alt = label;
  if (item.at) i.style.objectPosition = item.at;
  const cap = document.createElement('span');
  cap.textContent = item.title;
  b.append(i, cap);
  b.addEventListener('click', () => open(set, n, i));
  return b;
}

// showcases
for (const show of showcases) {
  const art = document.createElement('article');
  art.className = 'show';
  art.id = `show-${show.id}`;
  const h = document.createElement('h3');
  h.textContent = show.title;
  const ul = document.createElement('ul');
  ul.className = 'strip';
  ul.tabIndex = 0;
  ul.setAttribute('aria-label', show.title);
  show.items.forEach((item, n) => {
    const li = document.createElement('li');
    li.append(tile(item, `${item.title}, ${show.title}`, '(max-width: 40rem) 72vw, 25vw', show.items, n));
    ul.append(li);
  });
  art.append(h, ul);
  $('#shows').append(art);
}

// scenes
for (const s of scenes) {
  const li = document.createElement('li');
  li.className = 'tile';
  li.style.setProperty('--span', s.span);
  li.style.setProperty('--rows', s.rows);
  const set = [s, ...(s.more || []).map((id) => ({ id, title: s.title }))];
  li.append(tile(s, s.title, `(max-width: 40rem) 100vw, ${Math.round((s.span / 12) * 100)}vw`, set, 0));
  $('#wall').append(li);
}

// full view
const box = $('#box');
const film = $('#box-film');
const img = new Image();
box.prepend(img);
let set = [];
let at = 0;

function fill(n) {
  at = (n + set.length) % set.length;
  img.src = src(set[at].id, 2400);
  img.alt = set[at].title;
  $('#box-title').textContent = set[at].title;
  [...film.children].forEach((b, k) => b.setAttribute('aria-current', k === at));
  film.children[at]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' });
}

async function open(items, n, from) {
  set = items;
  film.replaceChildren(...(items.length > 1 ? items.map((item, k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', `${item.title}, picture ${k + 1}`);
    const t = new Image();
    t.src = src(item.id, 640);
    t.alt = '';
    b.append(t);
    b.onclick = () => fill(k);
    return b;
  }) : []));
  $('#box-prev').hidden = $('#box-next').hidden = items.length < 2;
  const pre = new Image();
  pre.src = src(items[n].id, 2400);
  await Promise.race([pre.decode().catch(() => {}), new Promise((r) => setTimeout(r, 350))]);
  const go = () => { box.showModal(); fill(n); };
  if (!document.startViewTransition || calm.matches) return go();
  from.style.viewTransitionName = 'shot';
  const vt = document.startViewTransition(() => {
    from.style.viewTransitionName = '';
    img.style.viewTransitionName = 'shot';
    go();
  });
  vt.finished.finally(() => { img.style.viewTransitionName = ''; });
}

$('#box-prev').onclick = () => fill(at - 1);
$('#box-next').onclick = () => fill(at + 1);
box.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') fill(at - 1);
  if (e.key === 'ArrowRight') fill(at + 1);
});
let sx = null;
img.addEventListener('pointerdown', (e) => { sx = e.isPrimary ? e.clientX : null; });
img.addEventListener('pointerup', (e) => {
  if (sx === null) return;
  const dx = e.clientX - sx;
  sx = null;
  if (Math.abs(dx) > 48 && set.length > 1) fill(at + (dx < 0 ? 1 : -1));
});
img.addEventListener('dragstart', (e) => e.preventDefault());
