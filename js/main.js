import { contact } from './data.js';
import { troopers } from './stage-data.js';
import './gallery.js';
import { Stage } from './spin.js';
import { setupBuilder } from './builder.js';
import { setupAsk } from './ask.js';
import { playIntro } from './intro.js';
import { loopMark } from './loop.js';

const $ = (s) => document.querySelector(s);

// blue tab icon on this PC, orange online
if (/^(localhost|127\.)/.test(location.hostname)) $('link[rel=icon]').href = 'assets/icon-64-blue.png';

// header
const menu = $('#menu');
menu.addEventListener('click', (e) => { if (e.target.closest('a')) menu.hidePopover(); });

// trooper stage
const spin = $('#spin');
const hint = $('#spin-hint');
const stage = new Stage(spin, troopers, {
  onTurn(deg) {
    spin.setAttribute('aria-valuenow', deg);
    spin.setAttribute('aria-valuetext', `${deg} degrees`);
  },
  onFirstDrag() { hint.classList.add('done'); },
  pickTop: () => $('.picker').offsetTop,
});

const row = $('#picker-row');
for (const t of troopers) {
  const label = document.createElement('label');
  label.className = 'pick';
  label.innerHTML = `<input type="radio" name="trooper-pick" value="${t.id}"><img src="assets/spin/${t.id}/head.webp?v=${t.v}" alt="" width="240" height="240">`;
  label.firstChild.setAttribute('aria-label', `${t.name}, ${t.unit}`);
  row.append(label);
}
function pick(id, instant) {
  const t = troopers.find((x) => x.id === id);
  $('#picker-name').textContent = t.name;
  $('#picker-unit').textContent = t.unit;
  stage.show(id, instant);
}
row.addEventListener('change', (e) => pick(e.target.value));
row.hidden = troopers.length < 2;
row.querySelector('input').checked = true;
pick(troopers[0].id, true);
stage.size();

const stageBox = $('.stage');
const mark = $('.stage-mark');
const paint = $('.paint');
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 60rem)');
let queued = false;
function onScroll() {
  queued = false;
  const y = scrollY;
  const p = Math.max(0, Math.min(1, y / innerHeight));
  if (y > stageBox.offsetHeight) return;
  stage.setScroll(p);
  mark.style.transform = calm.matches ? '' : `translateY(${-p * 14}vh)`;
  paint.style.transform = narrow.matches ? '' : `translateX(${p * 20}vw)`;
  mark.style.opacity = 1 - Math.min(1, p * 1.6);
}
addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener('resize', onScroll);
onScroll();

playIntro();
loopMark($('.end-mark'));

// the address names the part of the page that is on screen, so a refresh or a copied link comes back to it
const parts = [...document.querySelectorAll('main > section[id], footer[id]')];
const here = new IntersectionObserver((es) => {
  const e = es.find((x) => x.isIntersecting);
  if (!e || (location.hash.startsWith('#kit=') && e.target.id === 'build')) return;
  const hash = e.target.id === 'top' ? '' : `#${e.target.id}`;
  if (location.hash !== hash) history.replaceState(history.state, '', location.pathname + location.search + hash);
}, { rootMargin: '-45% 0px -54.9% 0px' });

// order and contact
setupBuilder();
setupAsk();
for (const a of document.querySelectorAll('[data-contact]')) {
  a.href = contact[a.dataset.contact];
  a.hidden = !contact[a.dataset.contact];
}

// back to where the page was before the refresh, once everything above it has its size
const goBack = () => { if (window.backTo !== undefined) scrollTo({ top: window.backTo, behavior: 'instant' }); };
goBack();
document.documentElement.classList.remove('returning');
addEventListener('load', goBack); // Safari jumps to the start of the part once more
addEventListener('load', () => setTimeout(() => {
  history.scrollRestoration = 'auto';
  parts.forEach((p) => here.observe(p));
}, 500));
addEventListener('pagehide', () => { try { sessionStorage.setItem('noen-y', Math.round(scrollY)); } catch {} });
