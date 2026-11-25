const KEEP = 72;
const SOFT = 16;
const COARSE = 24;
const LANES = Math.max(3, Math.min(8, (navigator.hardwareConcurrency || 8) - 2));
const mod = (n, m) => ((n % m) + m) % m;
// speeds in degrees per millisecond: the fastest free spin, its drag, and the brake that brings it to a stop
const FAST = 1.1, FREE = 620, SLOW = 0.2, BRAKE = 0.0016;

// tiny dark copy of a frame; drawn large it becomes a soft shadow
function shade(b) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(b.width / SOFT) + 4;
  c.height = Math.ceil(b.height / SOFT) + 4;
  const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(b, 2, 2, b.width / SOFT, b.height / SOFT);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#100d0b';
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

// One trooper: downloads its frames coarse to fine, decodes the ones near the current angle.
class Reel {
  constructor(t, onReady) {
    this.t = t;
    this.onReady = onReady;
    this.blobs = new Array(t.frames);
    this.bitmaps = new Map();
    this.pending = new Set();
    this.asked = new Set();
    this.scale = 1;
  }

  // frames are decoded at the size they are drawn
  fit(scale) {
    const s = Math.min(1, Math.ceil(scale * 20) / 20);
    if (s === this.scale) return;
    this.scale = s;
    for (const f of this.bitmaps.values()) f.b.close();
    this.bitmaps.clear();
  }

  async load(step) {
    const jobs = [];
    const first = Math.round((this.t.start / 360) * this.t.frames);
    for (let i = 0; i < this.t.frames; i += step) {
      const n = mod(first + i, this.t.frames);
      if (!this.asked.has(n)) { this.asked.add(n); jobs.push(n); }
    }
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const n = jobs[next++];
        try {
          const r = await fetch(`assets/spin/${this.t.id}/${String(n).padStart(3, '0')}.webp?v=${this.t.v}`);
          if (!r.ok) continue;
          this.blobs[n] = await r.blob();
          this.onReady(this, n);
        } catch { this.asked.delete(n); }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  }

  nearest(n, has) {
    const N = this.t.frames;
    for (let d = 0; d <= N / 2; d++) {
      for (const k of [mod(n + d, N), mod(n - d, N)]) if (has(k)) return k;
    }
    return -1;
  }

  // frames every reel keeps, so even a very fast turn has a picture close by
  coarse(n) { return n % Math.max(1, Math.round(this.t.frames / COARSE)) === 0; }

  // starts on the most urgent frames; what nobody needs any more never gets in line
  plan(list) {
    for (const n of list) {
      if (this.pending.size >= LANES) return;
      this.decode(n);
    }
  }

  decode(n) {
    if (this.bitmaps.has(n) || this.pending.has(n) || !this.blobs[n]) return;
    this.pending.add(n);
    const { scale } = this;
    const size = async () => {
      if (!this.wide) { const p = await createImageBitmap(this.blobs[n]); this.wide = p.width; this.high = p.height; p.close(); }
      const opt = scale < 1 ? { resizeWidth: Math.round(this.wide * scale), resizeHeight: Math.round(this.high * scale), resizeQuality: 'medium' } : undefined;
      return createImageBitmap(this.blobs[n], ...(opt ? [opt] : []));
    };
    size().then((b) => {
      this.pending.delete(n);
      if (scale !== this.scale) { b.close(); this.onReady(this, n); return; }
      this.bitmaps.set(n, { b });
      if (this.bitmaps.size > KEEP) {
        for (const old of this.bitmaps.keys()) {
          if (this.coarse(old)) continue;
          this.bitmaps.get(old).b.close();
          this.bitmaps.delete(old);
          break;
        }
      }
      this.onReady(this, n);
    }, () => this.pending.delete(n));
  }

  take(n) {
    const f = this.bitmaps.get(n);
    if (f) { this.bitmaps.delete(n); this.bitmaps.set(n, f); }
    return f;
  }

  // the picture for an angle: the two frames either side of it and how far it is between them. pace = frames it moves per tick
  at(angle, pace) {
    const N = this.t.frames;
    const x = (angle / 360) * N;
    const n = mod(Math.round(x), N);
    const quick = Math.abs(pace) > 1.1;
    const want = [this.nearest(n, (k) => this.blobs[k])];
    if (quick) for (let k = 1; k <= 7; k++) want.push(mod(Math.round(x + pace * k), N));
    else {
      const dir = pace < 0 ? -1 : 1;
      want.push(mod(Math.floor(x), N), mod(Math.floor(x) + 1, N));
      for (let d = 1; d <= 6; d++) want.push(mod(n + d * dir, N));
      for (let d = 1; d <= 3; d++) want.push(mod(n - d * dir, N));
    }
    const gap = Math.max(1, Math.round(N / COARSE));
    for (let d = 0; d < N; d += gap) want.push(mod(Math.round(n / gap) * gap + d, N));
    this.plan(want.filter((k) => k >= 0));
    if (!quick) {
      const a = mod(Math.floor(x), N), b = mod(Math.floor(x) + 1, N);
      if (this.bitmaps.has(a) && this.bitmaps.has(b)) {
        const f = x - Math.floor(x);
        const u = Math.max(0, Math.min(1, (f - 0.2) / 0.6));
        return { a: this.take(a), b: this.take(b), f: u * u * (3 - 2 * u) };
      }
    }
    const got = this.nearest(n, (k) => this.bitmaps.has(k));
    return got < 0 ? null : { a: this.take(got), f: 0 };
  }
}

export class Stage {
  constructor(root, troopers, { onTurn, onFirstDrag, pickTop } = {}) {
    this.root = root;
    this.pickTop = pickTop;
    this.canvas = root.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.calm = matchMedia('(prefers-reduced-motion: reduce)');
    this.narrow = matchMedia('(max-width: 60rem)');
    this.fine = matchMedia('(hover: hover) and (pointer: fine)');
    this.onTurn = onTurn;
    this.onFirstDrag = onFirstDrag;
    this.reels = new Map(troopers.map((t) => [t.id, new Reel(t, () => this.wake())]));

    this.angle = 0;
    this.speed = 0;
    this.lean = 0;
    this.leanTo = 0;
    this.scroll = 0;
    this.scrollTo = 0;
    this.shift = 0;
    this.held = false;
    this.cur = null;
    this.prev = null;
    this.mix = 1;
    this.dir = 1;
    this.raf = 0;
    this.last = 0;
    this.stop = null;
    this.melt = document.createElement('canvas');
    this.load = [];
    this.going = 0;
    this.lite = (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4;
    // the full set only downloads once somebody moves, scrolls or taps
    this.touched = new Promise((go) => {
      for (const type of ['pointermove', 'pointerdown', 'keydown', 'scroll']) addEventListener(type, go, { once: true, passive: true });
    });

    new ResizeObserver(() => this.size()).observe(root);
    this.bind();
    this.size();
  }

  async show(id, instant) {
    const reel = this.reels.get(id);
    if (!reel || reel === this.cur) return;
    const ids = [...this.reels.keys()];
    if (this.cur) {
      this.dir = ids.indexOf(id) > ids.indexOf(this.cur.t.id) ? 1 : -1;
      this.prev = this.cur;
      this.prevAngle = this.view();
    }
    this.cur = reel;
    this.speed = 0;
    this.stop = null;
    this.angle = Math.round(reel.t.start / this.step()) * this.step();
    this.mix = instant || !this.prev ? 1 : 0;
    this.wake();
    const { frames } = reel.t;
    await reel.load(frames / 8);
    this.wake();
    await reel.load(frames / 24);
    await this.touched;
    if (navigator.connection?.saveData) return;
    if (this.cur === reel) await reel.load(frames / 96);
    for (const r of this.reels.values()) if (r !== this.cur) await r.load(frames / 8);
    if (this.cur === reel && this.fine.matches) await reel.load(1);
  }

  view() { return this.angle + this.lean + this.scroll; }

  step() { return this.cur ? 360 / this.cur.t.frames : 2; }

  // the last bit of a spin: an even brake, a touch softer or harder so that it ends exactly on a frame
  settle() {
    const s = this.step();
    const from = this.angle;
    const rest = this.view() - this.angle;
    const v = this.speed;
    const to = Math.round((from + Math.sign(v) * (v * v) / (2 * BRAKE) + rest) / s) * s - rest;
    const by = to - from;
    this.speed = 0;
    // without a push, or with the nearest frame behind it, it only glides there
    const ms = Math.abs(v) > 0.02 && by * v > 0 ? (2 * by) / v : 120;
    this.stop = { from, by, t: 0, ms: Math.max(60, Math.min(260, ms)) };
  }

  bind() {
    const el = this.root;
    let x = 0, t = 0, id = null, moved = false;
    el.addEventListener('pointerdown', (e) => {
      if (id !== null || e.button) return;
      id = e.pointerId; x = e.clientX; t = e.timeStamp; moved = false;
      this.speed = 0; this.held = true; this.stop = null;
      el.setPointerCapture(id);
      el.classList.add('held');
      this.wake();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId === id) {
        const perPx = 360 / Math.max(420, Math.min(el.clientWidth, 900));
        const dx = (e.clientX - x) * perPx;
        const dt = Math.max(1, e.timeStamp - t);
        this.angle -= dx;
        this.speed = this.speed * 0.6 + (-dx / dt) * 0.4;
        x = e.clientX; t = e.timeStamp;
        if (!moved && Math.abs(dx) > 0.8) { moved = true; this.onFirstDrag?.(); }
        this.wake();
      }
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null; this.held = false;
      el.classList.remove('held');
      if (e.timeStamp - t > 80 || this.calm.matches) this.speed = 0;
      this.speed = Math.max(-FAST, Math.min(FAST, this.speed));
      if (Math.abs(this.speed) < SLOW) this.settle();
      this.wake();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('keydown', (e) => {
      const k = { ArrowLeft: 10, ArrowRight: -10, PageUp: 90, PageDown: -90 }[e.key];
      if (!k) return;
      e.preventDefault();
      this.speed = 0;
      this.stop = null;
      this.angle += k;
      this.settle();
      this.onFirstDrag?.();
      this.wake();
    });
    addEventListener('pointermove', (e) => {
      if (this.held || this.lite || this.calm.matches || !this.fine.matches || e.pointerType !== 'mouse') return;
      const step = this.step();
      const to = Math.round((-(e.clientX / innerWidth - 0.5) * 76) / step) * step;
      if (to === this.leanTo) return;
      this.leanTo = to;
      this.wake();
    }, { passive: true });
  }

  setScroll(p) {
    const s = this.calm.matches ? 0 : p * 22;
    const shift = this.narrow.matches ? 0 : p;
    const to = Math.round(s / this.step()) * this.step();
    if (to === this.scrollTo && shift === this.shift) return;
    this.scrollTo = to;
    this.shift = shift;
    this.wake();
  }

  size() {
    const r = this.root.getBoundingClientRect();
    if (!r.width) return;
    const d = Math.min(devicePixelRatio || 1, this.lite ? 1 : 2);
    this.w = r.width; this.h = r.height; this.d = d;
    this.floor = this.narrow.matches ? this.pickTop() - 34 : r.height * 0.925;
    this.size1 = this.narrow.matches ? Math.min(this.floor * 0.8, r.width * 1.5) : r.height * 0.8;
    this.root.parentElement.style.setProperty('--floor', `${this.floor + (this.narrow.matches ? 34 : 14)}px`);
    this.canvas.width = Math.round(r.width * d);
    this.canvas.height = Math.round(r.height * d);
    for (const reel of this.reels.values()) reel.fit((this.size1 / reel.t.tall) * d);
    this.draw();
  }

  wake() { if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame((t) => this.tick(t)); } }

  tick(t) {
    const dt = this.last ? Math.min(40, t - this.last) : 16;
    this.last = t;
    const was = this.view();
    let busy = this.held;
    if (!this.held && this.speed) {
      this.angle += this.speed * dt;
      this.speed = Math.sign(this.speed) * Math.max(0, (Math.abs(this.speed) + BRAKE * 0.4 * FREE) * Math.exp(-dt / FREE) - BRAKE * 0.4 * FREE);
      if (Math.abs(this.speed) < SLOW) this.settle();
      busy = true;
    }
    if (this.stop) {
      const s = this.stop;
      s.t = Math.min(1, s.t + dt / s.ms);
      this.angle = s.from + s.by * (1 - (1 - s.t) ** 2);
      if (s.t === 1) this.stop = null;
      busy = true;
    }
    // follows the cursor at a limited pace and arrives on a whole frame instead of creeping towards it
    for (const k of ['lean', 'scroll']) {
      const d = this[`${k}To`] - this[k];
      if (!d) continue;
      const go = Math.max(Math.abs(d) * (1 - Math.exp(-dt / 130)), this.step() * (dt / 90));
      this[k] = go >= Math.abs(d) ? this[`${k}To`] : this[k] + Math.sign(d) * go;
      busy = true;
    }
    this.pace(dt, busy);
    if (this.mix < 1) {
      this.mix = Math.min(1, this.mix + dt / 720);
      if (this.mix === 1) this.prev = null;
      busy = true;
    }
    this.going = (this.view() - was) / this.step();
    this.draw();
    this.raf = busy ? requestAnimationFrame((n) => this.tick(n)) : 0;
  }

  // a computer that cannot keep up gets plain frames at normal sharpness
  pace(dt, busy) {
    if (this.lite || !busy || !this.cur || this.mix < 1) { this.load.length = 0; return; }
    this.load.push(dt);
    if (this.load.length < 40) return;
    const slow = this.load.filter((x) => x > 30).length;
    this.load.length = 0;
    if (slow > 16) {
      this.lite = true;
      this.leanTo = 0;
      this.size();
    }
  }

  draw() {
    const { ctx, w, h, d } = this;
    if (!w || !this.cur) return;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const ease = 1 - (1 - this.mix) ** 4;
    const calm = this.calm.matches;
    if (this.prev && this.mix < 1) {
      this.put(this.prev, this.prevAngle + (calm ? 0 : this.dir * 97 * ease), calm ? 0 : -this.dir * ease * w * 0.8, calm ? 1 - ease : 1);
    }
    const a = this.mix < 1 && !calm ? this.view() - this.dir * 127 * (1 - ease) : this.view();
    this.put(this.cur, a, calm ? 0 : this.dir * (1 - ease) * w * 0.8, calm && this.prev ? ease : 1);

    const deg = Math.round(mod(this.view(), 360)) % 360;
    if (deg !== this.deg) { this.deg = deg; this.onTurn?.(deg); }
  }

  put(reel, angle, dx, alpha) {
    const p = reel.at(angle, reel === this.cur ? this.going : 0);
    if (!p || alpha <= 0) return;
    const soft = (p.a.soft ||= shade(p.a.b));
    let { b } = p.a;
    if (p.f > 0 && !this.lite) {
      const m = this.melt;
      if (m.width !== b.width || m.height !== b.height) { m.width = b.width; m.height = b.height; }
      const x = m.getContext('2d');
      x.globalCompositeOperation = 'copy';
      x.globalAlpha = 1 - p.f;
      x.drawImage(b, 0, 0);
      x.globalCompositeOperation = 'lighter';
      x.globalAlpha = p.f;
      x.drawImage(p.b.b, 0, 0);
      b = m;
    } else if (p.f >= 0.5 && p.b) b = p.b.b;
    this.root.classList.add('ready');
    const { ctx, w, h } = this;
    const { tall, foot } = reel.t;
    const s = this.size1 / tall;
    const ground = this.floor;
    const cx = w / 2 + dx + this.shift * w * 0.2;
    ctx.globalAlpha = alpha;
    const q = (reel.wide * s) / p.a.b.width;
    const fw = b.width * q, fh = b.height * q;
    const gx = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gx.addColorStop(0, 'rgba(12,10,9,.62)');
    gx.addColorStop(1, 'rgba(12,10,9,0)');
    ctx.save();
    ctx.translate(cx, ground - tall * s * 0.012);
    ctx.scale(tall * s * 0.34, tall * s * 0.05);
    ctx.fillStyle = gx;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
    const x = cx - fw / 2, y = ground - fh + foot * s;
    const k = SOFT * q, off = this.size1 * 0.028;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = alpha * 0.55;
    ctx.drawImage(soft, x - 2 * k + off, y - 2 * k + off * 0.5, soft.width * k, soft.height * k);
    ctx.globalAlpha = alpha;
    ctx.drawImage(b, x, y, fw, fh);
    ctx.globalAlpha = 1;
  }
}
