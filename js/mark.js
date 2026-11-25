// The Noen mark: NOEN, then the same word in Aurebesh, then the lettering of the logo.
// Units are the logo's own: 254 high, 1000 wide when finished. Everything is a pure function of time in seconds.

const times = { hold0: 0.8, read: 1.2, hold1: 0.2, join: 1.9, hold2: 1.4 };
export const marks = (() => {
  const a = times.hold0, b = a + times.read, c = b + times.hold1, d = c + times.join;
  return { read: [a, b], join: [c, d] };
})();

const WHITE = [238, 240, 240], ORANGE = [207, 98, 64];

// ---------------------------------------------------------------- easing
const clamp = (x) => Math.min(1, Math.max(0, x));
function bezier(x1, y1, x2, y2) {
  const f = (a, b, u) => 3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (f(x1, x2, m) < x) lo = m; else hi = m; }
    return f(y1, y2, (lo + hi) / 2);
  };
}
const inOut = bezier(0.77, 0, 0.175, 1);
const out = bezier(0.23, 1, 0.32, 1);
const drive = bezier(0.7, 0, 0.2, 1);
const ramp = (t, a, b, e = inOut) => e(clamp((t - a) / (b - a)));
const bump = (x) => Math.sin(Math.PI * clamp(x)) ** 1.3;
const lerp = (a, b, k) => a + (b - a) * k;
// a dock: overshoots a little and settles
const spring = (t, w = 26, z = 0.42) => (t <= 0 ? 0 : Math.exp(-z * w * t) * Math.sin(w * Math.sqrt(1 - z * z) * t));

// ---------------------------------------------------------------- shapes
const quad = (a, b, c, d, y0 = 0, y1 = 254) => [[a, y0], [b, y0], [d, y1], [c, y1]];
const box = (x0, x1, y0, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const K = 24;
function curve(p0, c, p1) {
  const o = [];
  for (let i = 0; i <= K; i++) { const u = i / K; o.push([(1 - u) ** 2 * p0[0] + 2 * u * (1 - u) * c[0] + u * u * p1[0], (1 - u) ** 2 * p0[1] + 2 * u * (1 - u) * c[1] + u * u * p1[1]]); }
  return o;
}
function along(pts, n = K) { // evenly spaced points on a polyline
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const o = [];
  for (let i = 0; i <= n; i++) {
    const s = (L.at(-1) * i) / n;
    let k = 1;
    while (k < L.length - 1 && L[k] < s) k++;
    const u = L[k] === L[k - 1] ? 0 : (s - L[k - 1]) / (L[k] - L[k - 1]);
    o.push([lerp(pts[k - 1][0], pts[k][0], u), lerp(pts[k - 1][1], pts[k][1], u)]);
  }
  return o;
}

// Nern: hook, leg, leg. The plain version of the hook is the N's left stem.
const hook = [
  [85, 254], ...curve([42.1, 254], [-4.3, 244.8], [-4.3, 165.4]), ...curve([-4.3, 88.6], [-4.3, 9.2], [42.1, 0]),
  [63.9, 0], [63.9, 40.9], ...curve([59.7, 40.9], [38.4, 40.9], [38.4, 88.6]), ...curve([38.4, 165.4], [38.4, 213.1], [59.7, 213.1]), [85, 213.1],
];
const hookPlain = [
  [42.6, 254], ...along([[29.53, 254], [0, 254], [0, 165.4]]), ...along([[0, 88.6], [0, 0], [29.53, 0]]),
  [42.6, 0], [42.6, 20], ...along([[42.6, 20], [42.6, 88.6]]), ...along([[42.6, 165.4], [42.6, 234]]), [42.6, 234],
];

const W = 42.6;
// each letter: Latin pieces and Aurebesh pieces, same order, same number of points
const N = {
  w: [222, 283.5], x0: [0, -4.3],
  parts: [
    { from: hookPlain, to: hook, at: 0.10 },
    { from: quad(0, 54, 168, 222), to: quad(146.9, 194.4, 59.4, 109.8), at: 0.0 },
    { from: quad(222 - W, 222, 222 - W, 222), to: quad(149, 196, 232.2, 279.2), at: 0.05 },
  ],
};
const mirror = (p, c) => p.map(([x, y]) => [2 * c - x, y]).reverse();
const oL = [[24, 0], [W, 0], [W, 254], [24, 254], [0, 230], [0, 24]];
const oLa = [[90.7, 0], [142.4, 0], [28.6, 254], [14.1, 254], [-4.6, 216.5], [90.7, 0]];
// its cut corners fill up while the word closes, so no gap shows between the letters (hidden in the finished logo)
const oLb = [[90.7, 0], [142.4, 0], [28.6, 254], [-21, 254], [-4.6, 216.5], [90.7, 0]];
const OW = 232;
const O = {
  w: [OW, 341.6], x0: [0, -4.6],
  parts: [
    { from: oL, to: oLa, end: oLb, at: 0.0 },
    { from: mirror(oL, OW / 2), to: mirror(oLa, 166.2), end: mirror(oLb, 166.2).map(([x, y]) => [Math.min(x, 345), y]), at: 0.0 },
    { from: box(24, OW - 24, 0, W), to: box(90.7, 241.7, 0, 40.9), at: 0.0 },
    { from: quad(30, OW - 30, 24, OW - 24, 254 - W, 254), to: quad(46.9, 285.5, 14.1, 318.3, 213.1, 254), end: quad(46.9, 285.5, 0, 330, 213.1, 254), at: 0.0 },
  ],
};
const EW = 178;
const E = {
  w: [EW, 282.5], x0: [0, -5.5],
  parts: [
    { from: quad(0, W, 0, W), to: quad(-5.5, 41.6, 77.7, 124.9), at: 0.08 },
    { from: quad(0, W, 0, W), to: quad(163, 214.4, 79.7, 126.8), at: 0.04 },
    { from: quad(0, W, 0, W), to: quad(200.3, 242.9, 200.3, 242.9), at: 0.0 },
    { from: box(0, EW, 0, W), to: box(163, 277, 0, 40.9), end: box(163, 275, 0, 40.9), at: 0.0 }, // a hair shorter in the mark, so its corner sits inside the N
    // these two only belong to the E: they slide back into the stem first
    { from: box(0, EW - 14, 106, 148), to: box(0, W, 106, 148), gone: true },
    { from: box(0, EW, 254 - W, 254), to: box(0, W, 254 - W, 254), gone: true },
  ],
};
const letters = [N, O, E, N];

// where each letter stands: Latin, Aurebesh, logo
const row = (gap, k) => {
  const total = letters.reduce((s, l) => s + l.w[k], 0) + gap * 3;
  let x = -total / 2;
  return letters.map((l) => { const at = x - l.x0[k]; x += l.w[k] + gap; return at; });
};
const LATIN = row(40, 0), AUREK = row(30, 1);
const LOGO = [4.3 - 500, 268.9 - 500, 488.2 - 500, 720.8 - 500];

// when the word closes up, in seconds from the start of the joining
const CLOSE = [0.6, 1.3];

// when the last letters meet, and when nothing moves any more
export const lockAt = marks.join[0] + CLOSE[0] + 0.52 * (CLOSE[1] - CLOSE[0]);
export const stillAt = marks.join[0] + CLOSE[1] + 0.55;

// ---------------------------------------------------------------- one moment
function pieces(t) {
  const r = t - marks.read[0];
  const j = t - marks.join[0];
  const out_ = [];

  // the joining: the last letter turns over, then the whole word closes up in one move and locks at once
  const lean = ramp(j, 0, 0.4, out) * (1 - ramp(j, CLOSE[0], CLOSE[1], drive));
  const spin = ramp(j, 0.1, 0.92, drive);
  const dock = ramp(j, CLOSE[0], CLOSE[1], drive);
  const fillUp = ramp(j, CLOSE[0] - 0.1, CLOSE[0] + 0.3, out);
  const push = ramp(j, CLOSE[0] + 0.1, CLOSE[1] + 0.14, drive); // grows only once the word is narrow enough
  const lock = 1 + 0.012 * spring(j - CLOSE[1] + 0.05, 20, 0.5);

  letters.forEach((L, i) => {
    const d = i * 0.1; // the translation runs through the word from left to right
    const px = ramp(r, 0.05, 0.85); // the word makes room all at once
    let x = lerp(LATIN[i], AUREK[i], px);
    x = lerp(x, LOGO[i], dock) + [-10, -4, 4, 52][i] * lean;
    const rot = i === 3 ? spin * Math.PI : 0;
    const flash = (u, a, b) => clamp((u - a) / 0.09) * (1 - clamp((u - b) / 0.16));
    const heat = Math.max(flash(r, d + 0.08, d + 0.74), i === 3 ? flash(j, 0.08, 0.74) : 0);
    const c = [137.45, 127];
    L.parts.forEach((p, k) => {
      let pts;
      if (p.gone) {
        const back = ramp(r, d + (k - 4) * 0.05, d + 0.3 + (k - 4) * 0.05);
        if (back >= 1) return;
        pts = p.from.map((q, n) => [lerp(q[0], p.to[n][0], back), q[1]]);
      } else {
        const a = d + 0.12 + p.at;
        const m = ramp(r, a, a + 0.66);
        pts = p.from.map((q, n) => [lerp(q[0], p.to[n][0], m), lerp(q[1], p.to[n][1], m)]);
        if (p.end && fillUp > 0) pts = pts.map((q, n) => [lerp(q[0], p.end[n][0], fillUp), lerp(q[1], p.end[n][1], fillUp)]);
      }
      const co = Math.cos(rot), si = Math.sin(rot);
      out_.push({
        letter: i,
        heat,
        pts: pts.map(([px_, py]) => {
          const u = px_ - c[0], v = py - c[1];
          const X = rot ? c[0] + u * co - v * si : px_, Y = rot ? c[1] + u * si + v * co : py;
          return [X + x, Y - 127];
        }),
      });
    });
  });

  return { parts: out_, push, lock };
}

// ---------------------------------------------------------------- drawing
const area = (p) => p.reduce((s, q, i) => { const n = p[(i + 1) % p.length]; return s + q[0] * n[1] - n[0] * q[1]; }, 0);
function trace(path, pts) {
  const p = area(pts) < 0 ? [...pts].reverse() : pts;
  path.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) path.lineTo(p[i][0], p[i][1]);
  path.closePath();
}
// how much smaller the word is before it closes up (the Aurebesh is wider than the logo)
export const SMALL = 0.74;

// three moments of the open shutter on top of each other, for a soft edge on what moves
export function draw(ctx, t, from, to, ink = WHITE, hot = ORANGE) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1 / 3;
  for (const d of [-1, 0, 1]) {
    const s = pieces(t + d / 360);
    const f = to.scale * lerp(SMALL, 1, s.push) * s.lock;
    ctx.setTransform(f, 0, 0, f, lerp(from.x, to.x, s.push), lerp(from.y, to.y, s.push));
    const sets = new Map();
    for (const p of s.parts) {
      const k = Math.round(p.heat * 24) / 24;
      if (!sets.has(k)) sets.set(k, new Path2D());
      trace(sets.get(k), p.pts);
    }
    for (const [k, path] of sets) {
      ctx.fillStyle = `rgb(${ink.map((w, i) => Math.round(lerp(w, hot[i], k))).join(' ')})`;
      ctx.fill(path, 'nonzero');
    }
  }
}

// drawn by the processor: the graphics card smooths edges with only four samples
export function surface() {
  const canvas = document.createElement('canvas');
  return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }) };
}
