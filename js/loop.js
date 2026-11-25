import { draw, stillAt, surface } from './mark.js';

const INK = [22, 21, 20];
const HOT = [238, 240, 240];
const FIRST = 0.45; // a short rest on the plain word
const REST = 0.45; // and on the finished mark
const MIDDLE = [2.0, 2.2]; // the Aurebesh stands still between these moments

// The mark at the bottom plays backwards and forwards for as long as the mouse is on it. When the mouse leaves, the
// change under way plays to its end, so it always rests on the word, the Aurebesh or the mark.
export function loopMark(box) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const still = box.querySelector('img');
  let ctx, canvas, place, raf = 0, last = 0, on = false, speed = 0, way = -1;
  let at = stillAt;
  let rest = 0;

  const size = () => {
    const r = box.getBoundingClientRect();
    const d = Math.min(devicePixelRatio || 1, 2);
    // room round the mark for the letter that turns over
    canvas.width = Math.round(r.width * 1.08 * d);
    canvas.height = Math.round(r.height * 1.4 * d);
    place = { x: canvas.width / 2, y: canvas.height / 2, scale: (r.width / 1000) * d };
    draw(ctx, at, place, place, INK, HOT);
  };
  const ready = () => {
    if (canvas) return;
    ({ canvas, ctx } = surface());
    size();
    box.append(canvas);
    still.style.visibility = 'hidden';
    new ResizeObserver(size).observe(box);
  };
  const stands = () => at <= FIRST || at >= stillAt || (at >= MIDDLE[0] && at <= MIDDLE[1]);
  const tick = (n) => {
    const dt = last ? Math.min(0.05, (n - last) / 1000) : 0;
    last = n;
    if (!on && stands()) { raf = 0; last = 0; speed = 0; rest = 0; return; }
    speed += (1 - speed) * (1 - Math.exp(-dt / 0.09));
    if (rest > 0) rest -= dt;
    else {
      const was = at;
      at += way * dt * speed;
      // never step over the still moment in one go
      if (!on && was < MIDDLE[0] && at > MIDDLE[1]) at = MIDDLE[0];
      if (!on && was > MIDDLE[1] && at < MIDDLE[0]) at = MIDDLE[1];
      if (at <= FIRST) { at = FIRST; way = 1; rest = REST; }
      if (at >= stillAt) { at = stillAt; way = -1; rest = REST; }
      draw(ctx, at, place, place, INK, HOT);
    }
    raf = requestAnimationFrame(tick);
  };
  const go = (yes) => {
    on = yes;
    if (on) ready();
    if (canvas && !raf) { last = 0; raf = requestAnimationFrame(tick); }
  };
  box.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') go(true); });
  box.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') go(false); });
  addEventListener('blur', () => go(false));
  box.addEventListener('click', (e) => { if (e.pointerType !== 'mouse') go(!on); });
}
