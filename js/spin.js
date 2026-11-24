const KEEP = 48;
const SOFT = 16;
const mod = (n, m) => ((n % m) + m) % m;

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
    this.level = 0;
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
          const r = await fetch(`assets/spin/${this.t.id}/${String(n).padStart(3, '0')}.webp`);
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

  decode(n) {
    if (this.bitmaps.has(n) || this.pending.has(n) || !this.blobs[n]) return;
    this.pending.add(n);
    createImageBitmap(this.blobs[n]).then((b) => {
      this.pending.delete(n);
      this.bitmaps.set(n, { b, soft: shade(b) });
      if (this.bitmaps.size > KEEP) {
        const [old] = this.bitmaps.keys();
        this.bitmaps.get(old).b.close();
        this.bitmaps.delete(old);
      }
      this.onReady(this, n);
    }, () => this.pending.delete(n));
  }

  // best bitmap for an angle, and queues the frames around it
  at(angle, dir) {
    const n = mod(Math.round((angle / 360) * this.t.frames), this.t.frames);
    const want = this.nearest(n, (k) => this.blobs[k]);
    if (want >= 0) this.decode(want);
    for (let d = 1; d <= 5; d++) {
      const k = mod(n + d * (dir || 1), this.t.frames);
      this.decode(k);
    }
    const got = this.nearest(n, (k) => this.bitmaps.has(k));
    if (got < 0) return null;
    const f = this.bitmaps.get(got);
    this.bitmaps.delete(got);
    this.bitmaps.set(got, f);
    return f;
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
    this.shift = 0;
    this.held = false;
    this.cur = null;
    this.prev = null;
    this.mix = 1;
    this.dir = 1;
    this.raf = 0;
    this.last = 0;
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
    this.angle = reel.t.start;
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

  bind() {
    const el = this.root;
    let x = 0, t = 0, id = null, moved = false;
    el.addEventListener('pointerdown', (e) => {
      if (id !== null || e.button) return;
      id = e.pointerId; x = e.clientX; t = e.timeStamp; moved = false;
      this.speed = 0; this.held = true;
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
      this.wake();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('keydown', (e) => {
      const k = { ArrowLeft: 10, ArrowRight: -10, PageUp: 90, PageDown: -90 }[e.key];
      if (!k) return;
      e.preventDefault();
      this.speed = 0;
      this.angle += k;
      this.onFirstDrag?.();
      this.wake();
    });
    addEventListener('pointermove', (e) => {
      if (this.held || this.calm.matches || !this.fine.matches || e.pointerType !== 'mouse') return;
      this.leanTo = -(e.clientX / innerWidth - 0.5) * 90;
      this.wake();
    }, { passive: true });
  }

  setScroll(p) {
    const s = this.calm.matches ? 0 : p * 22;
    const shift = this.narrow.matches ? 0 : p;
    if (s === this.scroll && shift === this.shift) return;
    this.scroll = s;
    this.shift = shift;
    this.wake();
  }

  size() {
    const r = this.root.getBoundingClientRect();
    if (!r.width) return;
    const d = Math.min(devicePixelRatio || 1, 2);
    this.w = r.width; this.h = r.height; this.d = d;
    this.floor = this.narrow.matches ? this.pickTop() - 34 : r.height * 0.925;
    this.size1 = this.narrow.matches ? Math.min(this.floor * 0.8, r.width * 1.5) : r.height * 0.8;
    this.root.parentElement.style.setProperty('--floor', `${this.floor + (this.narrow.matches ? 34 : 14)}px`);
    this.canvas.width = Math.round(r.width * d);
    this.canvas.height = Math.round(r.height * d);
    this.draw();
  }

  wake() { if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame((t) => this.tick(t)); } }

  tick(t) {
    const dt = this.last ? Math.min(40, t - this.last) : 16;
    this.last = t;
    let busy = this.held;
    if (!this.held && Math.abs(this.speed) > 0.002) {
      this.angle += this.speed * dt;
      this.speed *= Math.exp(-dt / 320);
      busy = true;
    }
    const lean = this.leanTo - this.lean;
    if (Math.abs(lean) > 0.08) { this.lean += lean * (1 - Math.exp(-dt / 95)); busy = true; }
    if (this.mix < 1) {
      this.mix = Math.min(1, this.mix + dt / 720);
      if (this.mix === 1) this.prev = null;
      busy = true;
    }
    this.draw();
    this.raf = busy ? requestAnimationFrame((n) => this.tick(n)) : 0;
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
    const f = reel.at(angle, Math.sign(this.speed) || 1);
    if (!f || alpha <= 0) return;
    const { b, soft } = f;
    this.root.classList.add('ready');
    const { ctx, w, h } = this;
    const { tall, foot } = reel.t;
    const s = this.size1 / tall;
    const ground = this.floor;
    const cx = w / 2 + dx + this.shift * w * 0.2;
    ctx.globalAlpha = alpha;
    const fw = b.width * s, fh = b.height * s;
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
    const k = SOFT * s, off = this.size1 * 0.028;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = alpha * 0.55;
    ctx.drawImage(soft, x - 2 * k + off, y - 2 * k + off * 0.5, soft.width * k, soft.height * k);
    ctx.globalAlpha = alpha;
    ctx.drawImage(b, x, y, fw, fh);
    ctx.globalAlpha = 1;
  }
}
