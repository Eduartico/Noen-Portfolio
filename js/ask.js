import { locations, vehicles } from './data.js';
import { onKit, summary, link, picture, poster } from './builder.js';
import { say } from './toast.js';

const $ = (s) => document.querySelector(s);
const KEY = 'noen-brief';

export function setupAsk() {
  const form = $('#ask');
  const f = form.elements;
  const place = $('#place');

  for (const name of ['Any of them', ...locations, 'Somewhere else']) $('#place-list').append(new Option(name));
  for (const name of vehicles) {
    const l = document.createElement('label');
    l.className = 'ride';
    l.innerHTML = '<input type="checkbox" name="ride"><span></span>';
    l.firstChild.value = name;
    l.lastChild.textContent = name;
    $('#ride-list').append(l);
  }
  const rides = [...form.querySelectorAll('[name=ride]')];

  const offer = () => f.offer.value;
  const rows = () => {
    const k = summary();
    const out = [['Helmet', k.helmet]];
    if (k.gear.length) out.push(['Gear', k.gear.join(', ')]);
    if (k.weapon) out.push(['Weapon', k.weapon]);
    out.push(['Pose', k.pose], ['Render', offer()]);
    if (offer() === 'Scene') {
      out.push(['Location', f.place.value]);
      const v = rides.filter((r) => r.checked).map((r) => r.value);
      if (v.length) out.push(['Vehicles', v.join(', ')]);
    }
    return out;
  };

  let shot = 0;
  const pic = new Image();
  pic.alt = 'Your clone';
  let seen = false;
  const card = () => {
    $('#brief-list').replaceChildren(...rows().flatMap(([a, b]) => {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = a;
      dd.textContent = b;
      return [dt, dd];
    }));
  };
  let turn = 0;
  const pose = async () => {
    const mine = ++turn;
    const blob = await picture();
    if (!blob || mine !== turn) return;
    URL.revokeObjectURL(shot);
    shot = URL.createObjectURL(blob);
    pic.src = shot;
    if (!pic.isConnected) $('.brief-card').prepend(pic);
  };
  new IntersectionObserver((es) => {
    seen = es.some((e) => e.isIntersecting);
    if (seen) pose();
  }).observe($('.brief-card'));

  const refresh = () => {
    place.hidden = offer() !== 'Scene';
    const full = rides.filter((r) => r.checked).length >= 2;
    for (const r of rides) r.disabled = full && !r.checked;
    card();
  };
  onKit(() => { card(); if (seen) pose(); });

  const keep = ['trooper', 'brief', 'refs'];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(keep.map((k) => [k, f[k].value])))); } catch {} };
  try {
    const d = JSON.parse(localStorage.getItem(KEY)) || {};
    for (const k of keep) f[k].value = d[k] ?? '';
  } catch {}

  form.addEventListener('change', refresh);
  form.addEventListener('input', save);
  $('#save-pic').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      const blob = await poster();
      if (!blob) return;
      const file = new File([blob], 'my-clone-noen.dev.jpg', { type: 'image/jpeg' });
      // phones: the share sheet saves it straight to the photos
      if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file] }); return; } catch (err) { if (err.name === 'AbortError') return; }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } finally {
      b.disabled = false;
    }
  });
  refresh();

  const text = () => {
    const lines = ['Commission brief', ''];
    if (f.trooper.value) lines.push(`Trooper: ${f.trooper.value}`);
    for (const [a, b] of rows()) lines.push(`${a}: ${b}`);
    lines.push(`His kit: ${link()}`);
    if (f.brief.value) lines.push('', f.brief.value);
    if (f.refs.value) lines.push('', 'References:', f.refs.value);
    lines.push('', 'Start now. I understand I lose the right to cancel once the final files are delivered.');
    return lines.join('\n');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(text());
      say('Brief copied. Paste it into a message to me.');
    } catch {
      say('Copying was blocked by the browser. Allow clipboard access and try again.');
    }
  });
}
