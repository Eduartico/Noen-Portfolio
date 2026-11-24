import { size, frames, boxes } from './kit-data.js';

const mod = (n, m) => ((n % m) + m) % m;
const pad = (n) => String(n).padStart(2, '0');

const VERT = `#version 300 es
in vec2 p;
uniform vec4 box;
uniform vec3 cam;
out vec2 uv;
void main() {
  uv = p;
  vec2 q = box.xy + p * box.zw;
  q = (q - cam.xy) * cam.z;
  gl_Position = vec4(q.x * 2.0, -q.y * 2.0, 0.0, 1.0);
}`;
const FRAG = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D colour;
uniform sampler2D depth;
uniform float bias;
uniform int pass;
out vec4 o;
void main() {
  vec4 c = texture(colour, uv);
  bool solid = c.a > 0.9;
  if (c.a < 0.02 || (pass == 0) != solid) discard;
  gl_FragDepth = clamp(texture(depth, uv).r + bias, 0.0, 1.0);
  o = vec4(c.rgb * c.a, c.a);
}`;

// One piece of gear: a colour picture and a depth picture per angle.
class Part {
  constructor(id, wake) {
    this.id = id;
    this.wake = wake;
    this.box = boxes[id];
    this.got = new Array(frames);
    this.asked = new Set();
    this.level = 0;
  }

  async one(n) {
    if (this.asked.has(n)) return;
    this.asked.add(n);
    try {
      const opt = { premultiplyAlpha: 'none', colorSpaceConversion: 'none' };
      const [c, z] = await Promise.all(['c', 'z'].map(async (k) => {
        const r = await fetch(`assets/kit/${this.id}/${k}${pad(n)}.webp`);
        if (!r.ok) throw new Error(r.status);
        return r.blob();
      }));
      this.got[n] = { c, z, opt };
      this.wake();
    } catch { this.asked.delete(n); }
  }

  // coarse to fine, starting at the angle on screen
  async load(from) {
    await this.one(from);
    for (const step of [12, 6, 3, 1]) {
      const jobs = [];
      for (let i = 0; i < frames; i += step) jobs.push(mod(from + i, frames));
      let k = 0;
      await Promise.all(Array.from({ length: 5 }, async () => { while (k < jobs.length) await this.one(jobs[k++]); }));
    }
  }

  near(n) {
    for (let d = 0; d <= frames / 2; d++) {
      for (const k of [mod(n + d, frames), mod(n - d, frames)]) if (this.got[k]) return k;
    }
    return -1;
  }
}

export class Kit {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector('canvas');
    this.ground = root.querySelector('.build-shadow');
    this.gl = this.canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
    this.parts = new Map();
    this.on = [];
    this.angle = 25;
    this.turnTo = null;
    this.speed = 0;
    this.held = false;
    this.cam = { x: 0.5, y: 0.5, z: 1 };
    this.to = { x: 0.5, y: 0.5, z: 1 };
    this.tex = new Map();
    this.busy = new Set();
    this.calm = matchMedia('(prefers-reduced-motion: reduce)');
    this.raf = 0;
    if (this.gl) this.setup();
    new ResizeObserver(() => this.size()).observe(root);
    this.bind();
  }

  setup() {
    const { gl } = this;
    const make = (type, s) => { const h = gl.createShader(type); gl.shaderSource(h, s); gl.compileShader(h); return h; };
    const pr = gl.createProgram();
    gl.attachShader(pr, make(gl.VERTEX_SHADER, VERT));
    gl.attachShader(pr, make(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(pr);
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = Object.fromEntries(['box', 'cam', 'colour', 'depth', 'bias', 'pass'].map((n) => [n, gl.getUniformLocation(pr, n)]));
    gl.uniform1i(this.u.colour, 0);
    gl.uniform1i(this.u.depth, 1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  }

  wear(ids) {
    this.on = ids.filter((id) => boxes[id]);
    const n = this.frame();
    for (const id of this.on) {
      if (!this.parts.has(id)) {
        const p = new Part(id, () => this.wake());
        this.parts.set(id, p);
      }
      const p = this.parts.get(id);
      if (!p.loading) p.loading = p.load(n);
    }
    this.wake();
  }

  look({ x = 0.5, y = 0.5, z = 1, angle }) {
    this.to = { x, y, z };
    if (angle !== undefined) {
      const d = mod(angle - this.angle + 180, 360) - 180;
      this.turnTo = this.angle + d;
      this.speed = 0;
    }
    if (this.calm.matches) {
      this.cam = { ...this.to };
      if (this.turnTo !== null) { this.angle = this.turnTo; this.turnTo = null; }
    }
    this.wake();
  }

  frame() { return mod(Math.round((this.angle / 360) * frames), frames); }

  bind() {
    const el = this.root;
    let x = 0, t = 0, id = null;
    el.addEventListener('pointerdown', (e) => {
      if (id !== null || e.button) return;
      id = e.pointerId; x = e.clientX; t = e.timeStamp;
      this.speed = 0; this.turnTo = null; this.held = true;
      el.setPointerCapture(id);
      el.classList.add('held');
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const dx = (e.clientX - x) * (360 / Math.max(380, Math.min(el.clientWidth, 760)));
      const dt = Math.max(1, e.timeStamp - t);
      this.angle -= dx;
      this.speed = this.speed * 0.6 + (-dx / dt) * 0.4;
      x = e.clientX; t = e.timeStamp;
      this.wake();
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
      const k = { ArrowLeft: 15, ArrowRight: -15 }[e.key];
      if (!k) return;
      e.preventDefault();
      this.turnTo = null;
      this.angle += k;
      this.wake();
    });
  }

  size() {
    const r = this.root.getBoundingClientRect();
    if (!r.width) return;
    const d = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(r.width * d);
    this.canvas.height = Math.round(r.height * d);
    this.wake();
  }

  wake() { if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame((t) => this.tick(t)); } }

  tick(t) {
    const dt = this.last ? Math.min(40, t - this.last) : 16;
    this.last = t;
    let more = this.held;
    if (!this.held && Math.abs(this.speed) > 0.002) {
      this.angle += this.speed * dt;
      this.speed *= Math.exp(-dt / 320);
      more = true;
    }
    if (this.turnTo !== null) {
      const d = this.turnTo - this.angle;
      this.angle += d * (1 - Math.exp(-dt / 170));
      if (Math.abs(d) < 0.4) { this.angle = this.turnTo; this.turnTo = null; }
      more = true;
    }
    for (const k of ['x', 'y', 'z']) {
      const d = this.to[k] - this.cam[k];
      if (Math.abs(d) > 0.0008) { this.cam[k] += d * (1 - Math.exp(-dt / 150)); more = true; } else this.cam[k] = this.to[k];
    }
    this.draw();
    this.raf = more ? requestAnimationFrame((n) => this.tick(n)) : 0;
  }

  // GL textures for one part and angle, made in the background and kept for a while
  pair(part, n) {
    const key = `${part.id}/${n}`;
    const hit = this.tex.get(key);
    if (hit) { this.tex.delete(key); this.tex.set(key, hit); return hit; }
    const g = part.got[n];
    if (!g || this.busy.has(key)) return null;
    this.busy.add(key);
    Promise.all([createImageBitmap(g.c, g.opt), createImageBitmap(g.z, g.opt)]).then(([c, z]) => {
      const { gl } = this;
      const up = (bmp, fmt, internal) => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, internal, fmt, gl.UNSIGNED_BYTE, bmp);
        const f = internal === gl.R8 ? gl.NEAREST : gl.LINEAR;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        bmp.close();
        return t;
      };
      gl.activeTexture(gl.TEXTURE0);
      this.tex.set(key, { c: up(c, gl.RGBA, gl.RGBA8), z: up(z, gl.RED, gl.R8) });
      this.busy.delete(key);
      const limit = Math.max(60, this.on.length * 8);
      while (this.tex.size > limit) {
        const [old] = this.tex.keys();
        const o = this.tex.get(old);
        gl.deleteTexture(o.c); gl.deleteTexture(o.z);
        this.tex.delete(old);
      }
      this.wake();
    }, () => this.busy.delete(key));
    return null;
  }

  draw() {
    const { gl, canvas } = this;
    if (!gl) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const n = this.frame();
    // whole frame fits the box: height first, then width
    const ar = canvas.width / canvas.height;
    const fit = Math.min(1, ar / 0.42);
    const sy = fit * this.cam.z;
    const sx = (sy * (size[0] / size[1])) / ar;
    const list = [];
    for (const id of this.on) {
      const part = this.parts.get(id);
      const k = part.near(n);
      if (k < 0) continue;
      const t = this.pair(part, k) || this.any(part, k);
      if (t) list.push([id, part, t]);
    }
    for (const pass of [0, 1]) {
      gl.uniform1i(this.u.pass, pass);
      gl.depthMask(pass === 0);
      for (const [id, part, t] of list) {
        const [x, y, w, h] = part.box;
        gl.uniform4f(this.u.box, (x / size[0] - 0.5) * sx + 0.5, (y / size[1] - 0.5) * sy + 0.5, (w / size[0]) * sx, (h / size[1]) * sy);
        gl.uniform3f(this.u.cam, 0.5 + (this.cam.x - 0.5) * sx, 0.5 + (this.cam.y - 0.5) * sy, 1);
        gl.uniform1f(this.u.bias, id === 'body' ? 0 : -0.006);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t.c);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, t.z);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
    const w = this.root.clientWidth, h = this.root.clientHeight;
    const px = (sx * w) / size[0];
    this.ground.style.transform = `translate(${(0.5 - (this.cam.x - 0.5) * sx) * w}px, ${((0.955 - this.cam.y) * sy + 0.5) * h}px) scale(${px})`;
    this.ground.style.opacity = list.length ? 1 : 0;
  }

  // last texture we have for a part while the right one is decoding
  any(part, n) {
    let best = null, bd = 1e9;
    for (const [key, t] of this.tex) {
      const [id, k] = key.split('/');
      if (id !== part.id) continue;
      const d = Math.abs(mod(k - n + frames / 2, frames) - frames / 2);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  // the clone alone, cut out of the canvas
  picture() {
    this.draw();
    const { width: w, height: h } = this.canvas;
    const fit = Math.min(1, w / h / 0.42);
    const fw = Math.min(w, h * fit * (size[0] / size[1]) * 0.86);
    const fh = h * fit;
    const c = document.createElement('canvas');
    c.width = Math.round(fw);
    c.height = Math.round(fh);
    c.getContext('2d').drawImage(this.canvas, (w - fw) / 2, (h - fh) / 2, fw, fh, 0, 0, c.width, c.height);
    return new Promise((r) => c.toBlob(r, 'image/png'));
  }
}
