import { draw, lockAt, stillAt, surface } from './mark.js';

const root = document.documentElement;
const $ = (s) => document.querySelector(s);

// The opening: NOEN turns into the mark, then the stage behind it appears. Any click, scroll or key skips it.
export async function playIntro() {
  if (!root.classList.contains('intro')) return;
  const skip = $('.intro-skip');
  const still = $('.stage-noen');
  const mark = $('.stage-mark');
  const { canvas, ctx } = surface();
  canvas.className = 'stage-intro';
  let to, raf = 0, over = false, shown = false;
  clearTimeout(window.introGuard);

  const size = () => {
    const box = mark.parentElement.getBoundingClientRect();
    const m = mark.getBoundingClientRect();
    const d = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(box.width * d);
    canvas.height = Math.round(box.height * d);
    const scale = Math.min(m.width / 1000, m.height / 254) * d;
    to = { x: (m.left - box.left + m.width / 2) * d, y: (m.top - box.top + m.height / 2) * d, scale };
  };

  // sound, where the browser lets a page play it before the first click; it joins in late if it has to
  let audio, sound, volume, buffer, start = 0;
  const join = () => {
    if (sound || over || !start || !buffer || audio.state !== 'running') return;
    const late = (performance.now() - start) / 1000;
    volume = audio.createGain();
    volume.connect(audio.destination);
    sound = audio.createBufferSource();
    sound.buffer = buffer;
    sound.connect(volume);
    sound.start(0, late);
  };
  const load = (async () => {
    try {
      audio = new AudioContext({ latencyHint: 'interactive' });
      audio.addEventListener('statechange', join);
      audio.resume().catch(() => {});
      const r = await fetch('assets/intro.m4a');
      buffer = await audio.decodeAudioData(await r.arrayBuffer());
      if (audio.state !== 'running') await new Promise((done) => { audio.addEventListener('statechange', done, { once: true }); setTimeout(done, 350); });
    } catch { buffer = null; }
  })();

  const show = () => {
    if (shown) return;
    shown = true;
    root.classList.add('intro-show');
    setTimeout(() => root.classList.remove('intro', 'intro-show'), 1500);
  };
  const finish = (quick) => {
    if (over) return;
    over = true;
    cancelAnimationFrame(raf);
    off.abort();
    canvas.remove();
    still.remove();
    root.classList.add('intro-mark');
    show();
    if (quick) {
      root.classList.add('intro-quick');
      if (sound) {
        volume.gain.setTargetAtTime(0, audio.currentTime, 0.05);
        setTimeout(() => audio.close(), 400);
      }
      setTimeout(() => root.classList.remove('intro-quick'), 600);
    } else if (sound) sound.onended = () => audio.close();
    if (!sound) audio?.close?.().catch?.(() => {});
    setTimeout(() => root.classList.remove('intro-mark'), 1500);
  };

  const off = new AbortController();
  const any = { signal: off.signal, passive: true };
  skip.addEventListener('click', () => finish(true), any);
  addEventListener('keydown', () => finish(true), any);
  addEventListener('wheel', () => finish(true), any);
  const gone = () => scrollY > innerHeight * 0.5;
  addEventListener('scroll', () => { if (gone()) finish(true); }, any);
  addEventListener('resize', size, any);
  if (gone()) return finish(true);

  await Promise.race([load, new Promise((r) => setTimeout(r, 700))]);
  if (over) return;
  size();
  mark.parentElement.append(canvas);
  draw(ctx, 0, to, to);
  still.remove();
  start = performance.now();
  join();
  const tick = (n) => {
    if (over) return;
    const t = Math.max(0, (n - start) / 1000);
    draw(ctx, Math.min(t, stillAt), to, to);
    if (t >= lockAt + 0.06) show();
    if (t >= stillAt) return finish(false);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
