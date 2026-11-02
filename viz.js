// viz.js — интерактивные рисунки курса (canvas, без зависимостей).
// Разметка: <figure class="fig" data-fig="имя"><figcaption>…</figcaption></figure>
// Каждое имя регистрируется в FIGS; рисунок перерисовывается при изменении размера,
// перетаскивании, смене языка и (для анимаций) каждый кадр, пока он виден.
(function () {
'use strict';

const C = {
  bg: '#0e111a', grid: '#1b1f30', axis: '#363b58', text: '#eceef5', muted: '#7a7f9a',
  math: '#3e8ef7', math3: '#8ec5ff', green: '#3ecf8e', amber: '#f7c948',
  purple: '#8b7cf8', coral: '#f76e6e', pink: '#e879f9',
};
const T = (ru, en) => (window.LANG === 'en' ? en : ru);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PI = Math.PI, TAU = 2 * Math.PI;
const fmt = (v, d = 2) => (Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v).toFixed(d);

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
// расходящаяся шкала: −1 коралловый, 0 фон, +1 синий
function divColor(v) {
  v = clamp(v, -1, 1);
  const b = [19, 22, 34], c = v >= 0 ? [62, 142, 247] : [247, 110, 110], t = Math.pow(Math.abs(v), 0.8);
  return [b[0] + (c[0] - b[0]) * t, b[1] + (c[1] - b[1]) * t, b[2] + (c[2] - b[2]) * t];
}
// последовательная шкала 0..1 (тёмно-синий → фиолетовый → голубой → зелёный → янтарный)
const SEQ = [[18, 22, 44], [58, 46, 128], [40, 112, 196], [52, 190, 150], [247, 201, 72]];
function seqColor(t) {
  t = clamp(t, 0, 1) * (SEQ.length - 1);
  const i = Math.min(SEQ.length - 2, Math.floor(t)), f = t - i, a = SEQ[i], b = SEQ[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

// численные производные
const H = 1e-4;
function divNum(F, x, y) {
  return (F(x + H, y)[0] - F(x - H, y)[0]) / (2 * H) + (F(x, y + H)[1] - F(x, y - H)[1]) / (2 * H);
}
function curlNum(F, x, y) {
  return (F(x + H, y)[1] - F(x - H, y)[1]) / (2 * H) - (F(x, y + H)[0] - F(x, y - H)[0]) / (2 * H);
}
function gradNum(f, x, y) {
  return [(f(x + H, y) - f(x - H, y)) / (2 * H), (f(x, y + H) - f(x, y - H)) / (2 * H)];
}

// ───────────────────────── View: система координат внутри прямоугольника ─────────────────────────
class View {
  constructor(ctx, rect, range, equal = true) {
    this.ctx = ctx; this.rect = rect; this.range = range;
    const [x0, x1, y0, y1] = range;
    let sx = rect.w / (x1 - x0), sy = rect.h / (y1 - y0);
    if (equal) { sx = sy = Math.min(sx, sy); }
    this.sx = sx; this.sy = sy;
    this.ox = rect.x + rect.w / 2 - ((x0 + x1) / 2) * sx;
    this.oy = rect.y + rect.h / 2 + ((y0 + y1) / 2) * sy;
    const a = this.inv(rect.x, rect.y + rect.h), b = this.inv(rect.x + rect.w, rect.y);
    this.xmin = a[0]; this.ymin = a[1]; this.xmax = b[0]; this.ymax = b[1];
  }
  X(x) { return this.ox + x * this.sx; }
  Y(y) { return this.oy - y * this.sy; }
  inv(px, py) { return [(px - this.ox) / this.sx, (this.oy - py) / this.sy]; }
  contains(px, py) { const r = this.rect; return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; }
  clip(fn) { const c = this.ctx, r = this.rect; c.save(); c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip(); fn(); c.restore(); }
  frame(col = C.axis) { const c = this.ctx, r = this.rect; c.strokeStyle = col; c.lineWidth = 1; c.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1); }

  line(x1, y1, x2, y2, col = C.text, lw = 1.5, dash) {
    const c = this.ctx; c.save(); c.strokeStyle = col; c.lineWidth = lw; if (dash) c.setLineDash(dash);
    c.beginPath(); c.moveTo(this.X(x1), this.Y(y1)); c.lineTo(this.X(x2), this.Y(y2)); c.stroke(); c.restore();
  }
  poly(pts, col = C.text, lw = 1.5, close = false, fill, dash) {
    if (pts.length < 2) return;
    const c = this.ctx; c.save(); c.beginPath(); if (dash) c.setLineDash(dash);
    c.moveTo(this.X(pts[0][0]), this.Y(pts[0][1]));
    for (let i = 1; i < pts.length; i++) c.lineTo(this.X(pts[i][0]), this.Y(pts[i][1]));
    if (close) c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (col) { c.strokeStyle = col; c.lineWidth = lw; c.stroke(); }
    c.restore();
  }
  // стрелка в пикселях
  arrowPx(x1, y1, x2, y2, col = C.text, lw = 1.6, head = 7) {
    const c = this.ctx, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
    if (L < 0.5) return;
    const h = Math.min(head, L * 0.6), ux = dx / L, uy = dy / L;
    c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2 - ux * h * 0.7, y2 - uy * h * 0.7); c.stroke();
    c.beginPath(); c.moveTo(x2, y2);
    c.lineTo(x2 - ux * h - uy * h * 0.45, y2 - uy * h + ux * h * 0.45);
    c.lineTo(x2 - ux * h + uy * h * 0.45, y2 - uy * h - ux * h * 0.45);
    c.closePath(); c.fill(); c.restore();
  }
  arrow(x, y, dx, dy, col, lw, head) { this.arrowPx(this.X(x), this.Y(y), this.X(x + dx), this.Y(y + dy), col, lw, head); }
  circle(x, y, r, stroke, fill, lw = 1.5, dash) {
    const c = this.ctx; c.save(); c.beginPath(); if (dash) c.setLineDash(dash);
    c.arc(this.X(x), this.Y(y), r * this.sx, 0, TAU);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
    c.restore();
  }
  dot(x, y, rpx = 4, fill = C.text, stroke) {
    const c = this.ctx; c.beginPath(); c.arc(this.X(x), this.Y(y), rpx, 0, TAU);
    c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); }
  }
  text(s, x, y, o = {}) { this.textPx(s, this.X(x), this.Y(y), o); }
  textPx(s, px, py, o = {}) {
    const c = this.ctx; c.save();
    c.font = `${o.bold ? '700 ' : ''}${o.size || 12}px ${o.mono ? 'JetBrains Mono,Fira Code,monospace' : '-apple-system,Segoe UI,sans-serif'}`;
    c.textAlign = o.align || 'left'; c.textBaseline = o.base || 'middle';
    if (o.bg) {
      const w = c.measureText(s).width, h = (o.size || 12) + 6;
      let bx = px - (c.textAlign === 'center' ? w / 2 : c.textAlign === 'right' ? w : 0) - 4;
      c.fillStyle = o.bg; c.fillRect(bx, py - h / 2, w + 8, h);
    }
    c.fillStyle = o.color || C.text; c.fillText(s, px, py); c.restore();
  }
  axes(o = {}) {
    const col = o.color || C.axis;
    this.clip(() => {
      if (o.grid) {
        const st = o.grid;
        for (let x = Math.ceil(this.xmin / st) * st; x <= this.xmax; x += st) this.line(x, this.ymin, x, this.ymax, C.grid, 1);
        for (let y = Math.ceil(this.ymin / st) * st; y <= this.ymax; y += st) this.line(this.xmin, y, this.xmax, y, C.grid, 1);
      }
      this.line(this.xmin, 0, this.xmax, 0, col, 1);
      this.line(0, this.ymin, 0, this.ymax, col, 1);
    });
    if (o.labels !== false) {
      this.textPx(o.xl || 'x', this.rect.x + this.rect.w - 8, this.Y(0) - 9, { color: C.muted, align: 'right', size: 12 });
      this.textPx(o.yl || 'y', this.X(0) + 8, this.rect.y + 10, { color: C.muted, size: 12 });
    }
  }
  // тепловая карта функции f(x,y) → [r,g,b]
  heat(colorAt, res = 3) {
    const r = this.rect, W = Math.max(1, Math.ceil(r.w / res)), Hh = Math.max(1, Math.ceil(r.h / res));
    const off = View._off || (View._off = document.createElement('canvas'));
    off.width = W; off.height = Hh;
    const oc = off.getContext('2d'), img = oc.createImageData(W, Hh), d = img.data;
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const p = this.inv(r.x + (i + .5) * res, r.y + (j + .5) * res), col = colorAt(p[0], p[1]), k = 4 * (j * W + i);
      d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
    }
    oc.putImageData(img, 0, 0);
    const c = this.ctx; c.save(); c.imageSmoothingEnabled = true; c.drawImage(off, r.x, r.y, W * res, Hh * res); c.restore();
  }
  // линии уровня (marching squares)
  contours(f, levels, col = 'rgba(255,255,255,.35)', lw = 1, cell = 6) {
    const r = this.rect, nx = Math.ceil(r.w / cell) + 1, ny = Math.ceil(r.h / cell) + 1, v = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const p = this.inv(r.x + i * cell, r.y + j * cell); v[j * nx + i] = f(p[0], p[1]); }
    const c = this.ctx; c.save(); c.strokeStyle = col; c.lineWidth = lw; c.beginPath();
    const lerp = (a, b, L) => (L - a) / (b - a);
    for (const L of levels) {
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = v[j * nx + i], b = v[j * nx + i + 1], cc = v[(j + 1) * nx + i + 1], d = v[(j + 1) * nx + i];
        const pts = [];
        const x0 = r.x + i * cell, y0 = r.y + j * cell;
        if ((a < L) !== (b < L)) pts.push([x0 + lerp(a, b, L) * cell, y0]);
        if ((b < L) !== (cc < L)) pts.push([x0 + cell, y0 + lerp(b, cc, L) * cell]);
        if ((d < L) !== (cc < L)) pts.push([x0 + lerp(d, cc, L) * cell, y0 + cell]);
        if ((a < L) !== (d < L)) pts.push([x0, y0 + lerp(a, d, L) * cell]);
        if (pts.length >= 2) { c.moveTo(pts[0][0], pts[0][1]); c.lineTo(pts[1][0], pts[1][1]); }
        if (pts.length === 4) { c.moveTo(pts[2][0], pts[2][1]); c.lineTo(pts[3][0], pts[3][1]); }
      }
    }
    c.stroke(); c.restore();
  }
  // «ёжик» стрелок векторного поля
  quiver(F, o = {}) {
    const step = o.step || 34, r = this.rect, maxLen = step * (o.fill || 0.82);
    const samples = [];
    let mmax = 1e-9;
    for (let py = r.y + step / 2; py < r.y + r.h; py += step) for (let px = r.x + step / 2; px < r.x + r.w; px += step) {
      const p = this.inv(px, py), v = F(p[0], p[1]); if (!v || !isFinite(v[0]) || !isFinite(v[1])) continue;
      const m = Math.hypot(v[0], v[1]); mmax = Math.max(mmax, m); samples.push([px, py, v[0], v[1], m]);
    }
    const ref = o.ref || mmax;
    for (const [px, py, vx, vy, m] of samples) {
      if (m < 1e-9) { this.ctx.fillStyle = rgba(C.muted, .6); this.ctx.fillRect(px - 1, py - 1, 2, 2); continue; }
      const t = clamp(m / ref, 0, 1), L = maxLen * (o.uniform ? 0.8 : Math.max(0.18, Math.sqrt(t)));
      const col = o.color || `rgb(${seqColor(0.35 + 0.65 * t).map(Math.round).join(',')})`;
      const ux = vx / m, uy = -vy / m;
      this.arrowPx(px - ux * L / 2, py - uy * L / 2, px + ux * L / 2, py + uy * L / 2, col, o.lw || 1.4, 5.5);
    }
  }
  // линия тока (RK2) от точки
  stream(F, x, y, o = {}) {
    const pts = [[x, y]], ds = o.ds || 0.03, n = o.n || 300, dir = o.back ? -1 : 1;
    for (let i = 0; i < n; i++) {
      let v = F(x, y), m = Math.hypot(v[0], v[1]); if (m < 1e-6 || !isFinite(m)) break;
      const mx = x + dir * ds * v[0] / m / 2, my = y + dir * ds * v[1] / m / 2;
      v = F(mx, my); m = Math.hypot(v[0], v[1]); if (m < 1e-6 || !isFinite(m)) break;
      x += dir * ds * v[0] / m; y += dir * ds * v[1] / m; pts.push([x, y]);
      if (x < this.xmin - .5 || x > this.xmax + .5 || y < this.ymin - .5 || y > this.ymax + .5) break;
      if (o.stop && o.stop(x, y, i)) break;
    }
    this.clip(() => this.poly(pts, o.color || rgba(C.math3, .35), o.lw || 1.2, false, null, o.dash));
    return pts;
  }
}

// псевдо-3D проекция: азимут az, наклон el; возвращает 2D-точку мира
function proj3(az, el) {
  const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  const f = (x, y, z) => [x * ca - y * sa, (x * sa + y * ca) * se + z * ce];
  f.depth = (x, y, z) => -(x * sa + y * ca) * ce + z * se; // больше = ближе к зрителю
  return f;
}

// ───────────────────────── mount: связывает canvas, элементы управления и рисунок ─────────────────────────
const REDRAW = [];
function mount(fig, spec) {
  const cv = document.createElement('canvas');
  cv.className = 'fig-canvas';
  cv.style.aspectRatio = String(1 / (spec.aspect || 0.6));
  fig.insertBefore(cv, fig.firstChild);
  const ctx = cv.getContext('2d');
  const st = Object.assign({ t: 0 }, spec.state || {});
  Object.keys(fig.dataset).forEach(k => { if (k !== 'fig' && k in st) st[k] = isNaN(+fig.dataset[k]) ? fig.dataset[k] : +fig.dataset[k]; });
  const g = { ctx, w: 0, h: 0, cv, st };
  g.view = (rect, range, equal) => new View(ctx, rect, range, equal);
  g.full = (range, equal, pad = 0) => new View(ctx, { x: pad, y: pad, w: g.w - 2 * pad, h: g.h - 2 * pad }, range, equal);

  const draw = () => {
    const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
    const d = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    ctx.setTransform(d, 0, 0, d, 0, 0); g.w = w; g.h = h;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
    spec.draw(g, st);
  };
  g.redraw = draw;

  // элементы управления
  const labels = [];
  if (spec.controls && spec.controls.length) {
    const box = document.createElement('div'); box.className = 'fig-ctrl';
    fig.insertBefore(box, cv.nextSibling);
    spec.controls.forEach(c => {
      const wrap = document.createElement('label'); wrap.className = 'fig-ctl';
      const lab = document.createElement('span'); wrap.appendChild(lab);
      let inp;
      if (c.type === 'select') {
        inp = document.createElement('select');
        c.options.forEach(([val]) => { const o = document.createElement('option'); o.value = val; inp.appendChild(o); });
        inp.value = st[c.key];
        inp.addEventListener('change', () => { st[c.key] = inp.value; c.onChange && c.onChange(st); draw(); });
        labels.push(() => { [...inp.options].forEach((o, i) => { const L = c.options[i]; o.textContent = T(L[1], L[2] || L[1]); }); });
      } else if (c.type === 'button') {
        inp = document.createElement('button'); inp.type = 'button'; inp.className = 'fig-btn';
        inp.addEventListener('click', () => { c.onClick(st); draw(); });
        labels.push(() => { inp.textContent = T(c.label[0], c.label[1]); });
      } else {
        inp = document.createElement('input'); inp.type = 'range';
        inp.min = c.min; inp.max = c.max; inp.step = c.step || (c.max - c.min) / 100; inp.value = st[c.key];
        const val = document.createElement('b'); wrap.appendChild(inp); wrap.appendChild(val);
        const upd = () => { val.textContent = c.fmt ? c.fmt(st[c.key]) : (+st[c.key]).toFixed(2); };
        inp.addEventListener('input', () => { st[c.key] = +inp.value; upd(); c.onChange && c.onChange(st); draw(); });
        upd();
      }
      if (c.type !== 'button' && c.label) labels.push(() => { lab.textContent = T(c.label[0], c.label[1]); });
      if (inp.parentNode !== wrap) wrap.appendChild(inp);
      box.appendChild(wrap);
    });
  }
  const relabel = () => labels.forEach(f => f());
  relabel();

  // перетаскивание / наведение
  if (spec.pointer) {
    cv.style.cursor = 'crosshair'; cv.style.touchAction = 'none';
    let down = false;
    const ev = (e, type) => {
      const r = cv.getBoundingClientRect();
      if (spec.pointer(st, e.clientX - r.left, e.clientY - r.top, type, g) !== false) draw();
    };
    cv.addEventListener('pointerdown', e => { down = true; cv.setPointerCapture(e.pointerId); ev(e, 'down'); });
    cv.addEventListener('pointermove', e => ev(e, down ? 'drag' : 'hover'));
    cv.addEventListener('pointerup', e => { down = false; ev(e, 'up'); });
    cv.addEventListener('pointerleave', e => { if (!down) ev(e, 'leave'); });
  }

  if (window.ResizeObserver) new ResizeObserver(draw).observe(cv); else window.addEventListener('resize', draw);
  REDRAW.push(() => { relabel(); draw(); });

  if (spec.anim) {
    let last = 0;
    const loop = ts => {
      requestAnimationFrame(loop);
      if (cv.offsetParent === null) { last = 0; return; }
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
      if (st.paused) return;
      st.t += dt; spec.step && spec.step(st, dt, g); draw();
    };
    requestAnimationFrame(loop);
  }
  draw();
}

// ───────────────────────── общие поля ─────────────────────────
const FIELDS = {
  uniform: { f: (x, y) => [1, 0.35], ru: 'однородное (1, 0.35)', en: 'uniform (1, 0.35)' },
  source: { f: (x, y) => [x, y], ru: 'источник (x, y)', en: 'source (x, y)' },
  sink: { f: (x, y) => [-x, -y], ru: 'сток (−x, −y)', en: 'sink (−x, −y)' },
  rot: { f: (x, y) => [-y, x], ru: 'вращение (−y, x)', en: 'rotation (−y, x)' },
  shear: { f: (x, y) => [y, 0], ru: 'сдвиг (y, 0)', en: 'shear (y, 0)' },
  saddle: { f: (x, y) => [x, -y], ru: 'седло (x, −y)', en: 'saddle (x, −y)' },
  stretch: { f: (x, y) => [x, 0], ru: 'растяжение (x, 0)', en: 'stretch (x, 0)' },
  vortex: { f: (x, y) => { const r2 = x * x + y * y + 1e-9; return [-y / r2, x / r2]; }, ru: 'точечный вихрь (−y, x)/r²', en: 'point vortex (−y, x)/r²' },
  spiral: { f: (x, y) => [x - y, x + y], ru: 'спираль (x−y, x+y)', en: 'spiral (x−y, x+y)' },
};
const fieldOpts = keys => keys.map(k => [k, FIELDS[k].ru, FIELDS[k].en]);

// стандартная подпись-панель со значениями в углу
function panel(g, lines, x = 10, y = 10, align = 'left') {
  const c = g.ctx; c.save(); c.font = '12px JetBrains Mono,Fira Code,monospace';
  const w = Math.max(...lines.map(l => c.measureText(l[0]).width)) + 16, h = lines.length * 18 + 8;
  const bx = align === 'right' ? g.w - x - w : x;
  c.fillStyle = 'rgba(11,13,20,.82)'; c.strokeStyle = C.axis; c.lineWidth = 1;
  c.beginPath(); c.roundRect ? c.roundRect(bx, y, w, h, 6) : c.rect(bx, y, w, h); c.fill(); c.stroke();
  lines.forEach((l, i) => { c.fillStyle = l[1] || C.text; c.textBaseline = 'middle'; c.fillText(l[0], bx + 8, y + 13 + i * 18); });
  c.restore();
}

const FIGS = {};

// ═════════════════════════ Модуль 01 — Градиент ═════════════════════════
// рельеф «две горы и впадина»
const hills = (x, y) => 3 * Math.exp(-((x - 1.1) ** 2 + (y - 0.4) ** 2) / 1.1)
  + 2 * Math.exp(-((x + 1.4) ** 2 + (y + 0.6) ** 2) / 0.7) - 1.2 * Math.exp(-((x + 0.6) ** 2 + (y - 1.3) ** 2) / 0.5);
const hillLevels = Array.from({ length: 16 }, (_, i) => -1 + i * 0.27);

FIGS['scalar-map'] = fig => mount(fig, {
  aspect: 0.58, state: { hx: 1.1, hy: 0.4, hover: false },
  pointer(st, px, py, type, g) { if (type === 'leave') { st.hover = false; return; } const p = g.v.inv(px, py); st.hx = p[0]; st.hy = p[1]; st.hover = true; },
  draw(g, st) {
    const v = g.v = g.full([-3.2, 3.2, -2, 2.2], true);
    v.heat((x, y) => seqColor((hills(x, y) + 1.2) / 4.3));
    v.contours(hills, hillLevels, 'rgba(255,255,255,.28)', 1);
    v.contours(hills, [1.5], C.amber, 2);
    v.axes({ labels: true });
    const val = hills(st.hx, st.hy);
    v.dot(st.hx, st.hy, 5, C.text, C.bg);
    v.text(`f = ${fmt(val)}`, st.hx + 0.12, st.hy + 0.18, { color: C.text, bg: 'rgba(11,13,20,.75)', mono: true });
    panel(g, [[T('f(x,y) — «высота» в точке', 'f(x,y) — “height” at a point'), C.muted],
      [T('жёлтая линия: f = 1.5', 'yellow line: f = 1.5'), C.amber], [T('наведите курсор на карту', 'hover over the map'), C.muted]]);
    // шкала
    const cx = g.w - 26, top = 16, bh = g.h - 32;
    for (let i = 0; i < bh; i++) { const c = seqColor(1 - i / bh); g.ctx.fillStyle = `rgb(${c.map(Math.round)})`; g.ctx.fillRect(cx, top + i, 10, 1); }
    v.textPx(T('выше', 'high'), cx - 4, top + 6, { align: 'right', color: C.muted, size: 11 });
    v.textPx(T('ниже', 'low'), cx - 4, top + bh - 6, { align: 'right', color: C.muted, size: 11 });
  },
});

const GRAD_FIELDS = {
  bowl: { f: (x, y) => x * x + y * y, g: (x, y) => [2 * x, 2 * y], ru: 'f = x² + y² (чаша)', en: 'f = x² + y² (bowl)', lv: [0.25, 1, 2.25, 4, 6.25, 9] },
  saddle: { f: (x, y) => x * x - y * y, g: (x, y) => [2 * x, -2 * y], ru: 'f = x² − y² (седло)', en: 'f = x² − y² (saddle)', lv: [-6, -4, -2, -1, -0.25, 0, 0.25, 1, 2, 4, 6] },
  x2y: { f: (x, y) => x * x * y, g: (x, y) => [2 * x * y, x * x], ru: 'f = x²y', en: 'f = x²y', lv: [-6, -3, -1.5, -0.5, 0, 0.5, 1.5, 3, 6] },
  plane: { f: (x, y) => x + 0.5 * y, g: () => [1, 0.5], ru: 'f = x + y/2 (наклонная плоскость)', en: 'f = x + y/2 (tilted plane)', lv: [-3, -2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3] },
};
FIGS['grad-field'] = fig => mount(fig, {
  aspect: 0.62, state: { field: 'bowl' },
  controls: [{ type: 'select', key: 'field', label: ['Поле', 'Field'], options: Object.keys(GRAD_FIELDS).map(k => [k, GRAD_FIELDS[k].ru, GRAD_FIELDS[k].en]) }],
  draw(g, st) {
    const F = GRAD_FIELDS[st.field], v = g.full([-2.6, 2.6, -2.1, 2.1], true);
    const fmin = -6, fmax = 6;
    v.heat((x, y) => divColor(F.f(x, y) / 7));
    v.contours(F.f, F.lv, 'rgba(255,255,255,.4)', 1.2);
    v.axes();
    v.quiver(F.g, { step: 40, color: C.green, lw: 1.6 });
    panel(g, [['∇f — ' + T('зелёные стрелки', 'green arrows'), C.green], [T('белые линии — уровни f', 'white lines — levels of f'), C.muted],
      [T('синий: f > 0, красный: f < 0', 'blue: f > 0, red: f < 0'), C.muted]]);
  },
});

FIGS['partial-slice'] = fig => mount(fig, {
  aspect: 0.52, state: { x0: 1.2, y0: 0.8 },
  pointer(st, px, py, type, g) {
    if (type !== 'down' && type !== 'drag') return false;
    if (!g.v.contains(px, py)) return false;
    const p = g.v.inv(px, py); st.x0 = clamp(p[0], -1.9, 1.9); st.y0 = clamp(p[1], -1.9, 1.9);
  },
  draw(g, st) {
    const f = (x, y) => x * x * y, S = Math.min(g.h - 20, g.w * 0.42);
    const v = g.v = g.view({ x: 10, y: 10, w: S, h: S }, [-2, 2, -2, 2], true);
    v.heat((x, y) => divColor(f(x, y) / 8));
    v.contours(f, [-6, -4, -2, -1, -0.3, 0.3, 1, 2, 4, 6], 'rgba(255,255,255,.3)');
    v.axes();
    v.line(-2, st.y0, 2, st.y0, C.amber, 2, [6, 4]);
    v.line(st.x0, -2, st.x0, 2, C.pink, 2, [6, 4]);
    v.dot(st.x0, st.y0, 6, C.text, C.bg);
    v.text('P', st.x0 + .12, st.y0 + .18, { bold: true });
    v.frame();
    const gx = 2 * st.x0 * st.y0, gy = st.x0 * st.x0;
    const R = { x: S + 40, w: g.w - S - 54 }, hh = (g.h - 40) / 2;
    // срез вдоль x
    const a = g.view({ x: R.x, y: 14, w: R.w, h: hh }, [-2, 2, -8, 8], false);
    a.axes({ xl: 'x', yl: `f(x, ${fmt(st.y0, 1)})` });
    const pa = []; for (let x = -2; x <= 2.001; x += .04) pa.push([x, f(x, st.y0)]);
    a.clip(() => { a.poly(pa, C.amber, 2.2); a.line(st.x0 - 1, f(st.x0, st.y0) - gx, st.x0 + 1, f(st.x0, st.y0) + gx, C.text, 1.4, [4, 3]); });
    a.dot(st.x0, f(st.x0, st.y0), 5, C.text);
    a.frame();
    a.textPx(`∂f/∂x = 2xy = ${fmt(gx)}`, R.x + 8, 28, { color: C.amber, mono: true, bg: 'rgba(11,13,20,.75)' });
    // срез вдоль y
    const b = g.view({ x: R.x, y: 26 + hh, w: R.w, h: hh }, [-2, 2, -8, 8], false);
    b.axes({ xl: 'y', yl: `f(${fmt(st.x0, 1)}, y)` });
    const pb = []; for (let y = -2; y <= 2.001; y += .04) pb.push([y, f(st.x0, y)]);
    b.clip(() => { b.poly(pb, C.pink, 2.2); b.line(st.y0 - 1, f(st.x0, st.y0) - gy, st.y0 + 1, f(st.x0, st.y0) + gy, C.text, 1.4, [4, 3]); });
    b.dot(st.y0, f(st.x0, st.y0), 5, C.text);
    b.frame();
    b.textPx(`∂f/∂y = x² = ${fmt(gy)}`, R.x + 8, 40 + hh, { color: C.pink, mono: true, bg: 'rgba(11,13,20,.75)' });
    v.textPx(T('тащите точку P', 'drag point P'), 18, S, { color: C.muted, base: 'bottom', size: 11, bg: 'rgba(11,13,20,.7)' });
  },
});

function descent(f, x, y, sgn, n = 400) {
  const pts = [[x, y]];
  for (let i = 0; i < n; i++) {
    const gr = gradNum(f, x, y), m = Math.hypot(gr[0], gr[1]); if (m < 1e-3) break;
    x += sgn * 0.03 * gr[0] / m; y += sgn * 0.03 * gr[1] / m; pts.push([x, y]);
  }
  return pts;
}
FIGS['steepest'] = fig => mount(fig, {
  aspect: 0.58, state: { px: -0.2, py: -0.5 },
  pointer(st, px, py, type, g) { if (type !== 'down' && type !== 'drag') return false; const p = g.v.inv(px, py); st.px = p[0]; st.py = p[1]; },
  draw(g, st) {
    const v = g.v = g.full([-3.2, 3.2, -2, 2.2], true);
    v.heat((x, y) => seqColor((hills(x, y) + 1.2) / 4.3));
    v.contours(hills, hillLevels, 'rgba(255,255,255,.28)');
    v.contours(hills, [hills(st.px, st.py)], C.amber, 2);
    v.clip(() => {
      v.poly(descent(hills, st.px, st.py, -1), C.coral, 2, false, null, [2, 4]);
      v.poly(descent(hills, st.px, st.py, +1), C.green, 2, false, null, [2, 4]);
    });
    const gr = gradNum(hills, st.px, st.py), m = Math.hypot(gr[0], gr[1]) || 1e-9, L = 0.9, ux = gr[0] / m, uy = gr[1] / m;
    v.line(st.px - uy * L, st.py + ux * L, st.px + uy * L, st.py - ux * L, C.amber, 2.5);
    v.arrow(st.px, st.py, ux * L, uy * L, C.green, 3, 11);
    v.arrow(st.px, st.py, -ux * L, -uy * L, C.coral, 3, 11);
    v.dot(st.px, st.py, 5, C.text, C.bg);
    v.text('∇f', st.px + ux * (L + .2), st.py + uy * (L + .2), { color: C.green, bold: true, align: 'center', size: 14 });
    v.text('−∇f', st.px - ux * (L + .25), st.py - uy * (L + .25), { color: C.coral, bold: true, align: 'center', size: 14 });
    panel(g, [[`|∇f| = ${fmt(m)}`, C.text], [T('зелёный — подъём, красный — спуск', 'green — ascent, red — descent'), C.muted],
      [T('жёлтый — касательная к уровню', 'yellow — tangent to level line'), C.amber], [T('кликните / тащите точку', 'click / drag the point'), C.muted]]);
  },
});

FIGS['directional'] = fig => mount(fig, {
  aspect: 0.5, state: { th: 0.7 },
  controls: [{ type: 'range', key: 'th', label: ['Угол θ между e и ∇f', 'Angle θ between e and ∇f'], min: 0, max: 6.283, step: 0.01, fmt: v => `${Math.round(v * 180 / PI)}°` }],
  pointer(st, px, py, type, g) {
    if ((type !== 'down' && type !== 'drag') || !g.v.contains(px, py)) return false;
    const p = g.v.inv(px, py); st.th = (Math.atan2(p[1], p[0]) - g.base + TAU * 2) % TAU;
    const inp = fig.querySelector('input'); if (inp) { inp.value = st.th; inp.dispatchEvent(new Event('input')); }
  },
  draw(g, st) {
    const S = Math.min(g.h - 20, g.w * 0.46), G = 1.6, base = g.base = 0.45;
    const v = g.v = g.view({ x: 10, y: 10, w: S, h: S }, [-2.1, 2.1, -2.1, 2.1], true);
    v.axes({ grid: 0.5, labels: false });
    const gx = G * Math.cos(base), gy = G * Math.sin(base), a = base + st.th, ex = Math.cos(a), ey = Math.sin(a), d = G * Math.cos(st.th);
    // круг производных по направлению: |∇f|cosθ в полярных координатах — окружность с диаметром ∇f
    v.circle(gx / 2, gy / 2, G / 2, rgba(C.purple, .7), rgba(C.purple, .08), 1.5, [4, 3]);
    v.circle(0, 0, 1, rgba(C.muted, .5), null, 1, [3, 3]);
    v.arrow(0, 0, gx, gy, C.green, 3, 11);
    v.arrow(0, 0, ex, ey, C.amber, 2.6, 10);
    v.line(ex * d, ey * d, gx, gy, C.muted, 1, [3, 3]);
    v.line(0, 0, ex * d, ey * d, d >= 0 ? C.math : C.coral, 6);
    v.text('∇f', gx + .15, gy + .12, { color: C.green, bold: true, size: 14 });
    v.text('e', ex * 1.15, ey * 1.15, { color: C.amber, bold: true, size: 14, align: 'center' });
    v.frame();
    // график |∇f| cos θ
    const R = { x: S + 40, y: 14, w: g.w - S - 54, h: S - 8 };
    const b = g.view(R, [0, TAU, -2, 2], false);
    b.axes({ xl: 'θ', yl: '∂f/∂e', grid: 0 });
    [PI / 2, PI, 3 * PI / 2].forEach((t, i) => { b.line(t, -2, t, 2, C.grid, 1); b.text(['π/2', 'π', '3π/2'][i], t, -1.85, { color: C.muted, align: 'center', size: 11 }); });
    const pts = []; for (let t = 0; t <= TAU + .001; t += .03) pts.push([t, G * Math.cos(t)]);
    b.poly(pts, C.purple, 2);
    b.line(st.th, 0, st.th, d, d >= 0 ? C.math : C.coral, 3);
    b.dot(st.th, d, 5, C.text);
    b.frame();
    b.textPx(`∂f/∂e = |∇f| cos θ = ${fmt(d)}`, R.x + 8, R.y + 14, { mono: true, color: C.text, bg: 'rgba(11,13,20,.75)' });
    b.textPx(T('макс. при θ=0, ноль при θ=π/2', 'max at θ=0, zero at θ=π/2'), R.x + 8, R.y + 34, { color: C.muted, size: 11 });
  },
});

// ═════════════════════════ Модуль 02 — Дивергенция ═════════════════════════
FIGS['vfields'] = fig => mount(fig, {
  aspect: 0.6, state: { field: 'source' },
  controls: [{ type: 'select', key: 'field', label: ['Поле', 'Field'], options: fieldOpts(['uniform', 'source', 'sink', 'rot', 'shear', 'saddle', 'spiral']) }],
  draw(g, st) {
    const F = FIELDS[st.field].f, v = g.full([-2.5, 2.5, -1.6, 1.6], true);
    v.axes({ grid: 0.5 });
    for (let k = 0; k < 14; k++) {
      const a = k / 14 * TAU, x = 1.5 * Math.cos(a) + 0.01, y = 1.0 * Math.sin(a) + 0.013;
      v.stream(F, x, y, { n: 250 }); v.stream(F, x, y, { n: 250, back: true });
    }
    v.quiver(F, { step: 36 });
    const dv = divNum(F, 0.3, 0.2), cr = curlNum(F, 0.3, 0.2);
    panel(g, [[`div F = ${fmt(dv, 1)}`, dv > 0 ? C.math : dv < 0 ? C.coral : C.muted], [`rot F = ${fmt(cr, 1)}`, cr ? C.amber : C.muted]], 10, 10, 'right');
  },
});

function boxFlux(F, cx, cy, a, n = 40) { // поток через квадрат со стороной 2a; F·n по каждой стороне
  const sides = [], h = 2 * a / n;
  const S = [[[1, 0], (t) => [cx + a, cy - a + t]], [[-1, 0], (t) => [cx - a, cy - a + t]], [[0, 1], (t) => [cx - a + t, cy + a]], [[0, -1], (t) => [cx - a + t, cy - a]]];
  let tot = 0;
  for (const [nv, p] of S) { let s = 0; for (let i = 0; i < n; i++) { const q = p((i + .5) * h), f = F(q[0], q[1]); s += (f[0] * nv[0] + f[1] * nv[1]) * h; } sides.push(s); tot += s; }
  return { sides, tot };
}
FIGS['div-box'] = fig => mount(fig, {
  aspect: 0.6, state: { field: 'stretch', a: 0.5, cx: 0.8, cy: 0.3 },
  controls: [
    { type: 'select', key: 'field', label: ['Поле', 'Field'], options: fieldOpts(['uniform', 'stretch', 'source', 'sink', 'rot', 'saddle']) },
    { type: 'range', key: 'a', label: ['Полусторона кубика a', 'Half-side a'], min: 0.1, max: 1, step: 0.01 },
  ],
  pointer(st, px, py, type, g) { if (type !== 'down' && type !== 'drag') return false; const p = g.v.inv(px, py); st.cx = p[0]; st.cy = p[1]; },
  draw(g, st) {
    const F = FIELDS[st.field].f, v = g.v = g.full([-2.6, 2.6, -1.6, 1.6], true), a = st.a;
    v.axes({ grid: 0.5 });
    v.quiver(F, { step: 34, color: rgba(C.math3, .35) });
    const { sides, tot } = boxFlux(F, st.cx, st.cy, a);
    v.poly([[st.cx - a, st.cy - a], [st.cx + a, st.cy - a], [st.cx + a, st.cy + a], [st.cx - a, st.cy + a]], C.text, 2, true, tot > 1e-6 ? rgba(C.math, .18) : tot < -1e-6 ? rgba(C.coral, .18) : rgba(C.muted, .1));
    // стрелки F на гранях: зелёные — вытекает, красные — втекает
    const N = 4, nrm = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    nrm.forEach((nv) => {
      for (let i = 0; i < N; i++) {
        const t = -a + (i + .5) * 2 * a / N, px = st.cx + (nv[0] ? nv[0] * a : t), py = st.cy + (nv[1] ? nv[1] * a : t);
        const f = F(px, py), fn = f[0] * nv[0] + f[1] * nv[1], sc = 0.28;
        v.arrow(px - f[0] * sc / 2, py - f[1] * sc / 2, f[0] * sc, f[1] * sc, fn > 1e-6 ? C.green : fn < -1e-6 ? C.coral : C.muted, 2, 7);
      }
    });
    const area = 4 * a * a, dv = divNum(F, st.cx, st.cy);
    panel(g, [
      [T('поток наружу ∮F·n dl', 'outward flux ∮F·n dl') + ` = ${fmt(tot, 3)}`, C.text],
      [T('площадь', 'area') + ` = ${fmt(area, 3)}`, C.muted],
      [T('поток / площадь', 'flux / area') + ` = ${fmt(tot / area, 3)}`, C.amber],
      [`div F (${T('в центре', 'at center')}) = ${fmt(dv, 3)}`, C.math],
      [T('зелёные — вытекает, красные — втекает', 'green — out, red — in'), C.muted],
    ]);
  },
});

// частицы, переносимые полем
function particleFig(fields, def, opts = {}) {
  return fig => mount(fig, {
    aspect: 0.56, anim: true, state: { field: def, P: null },
    controls: [{ type: 'select', key: 'field', label: ['Поле', 'Field'], options: fields.map(k => [k, (FIELDS[k] || EXTRA[k]).ru, (FIELDS[k] || EXTRA[k]).en]), onChange: st => { st.P = null; } },
      { type: 'button', label: ['⏯ пауза', '⏯ pause'], onClick: st => { st.paused = !st.paused; } }],
    step(st, dt, g) {
      if (!g.v) return;
      const F = (FIELDS[st.field] || EXTRA[st.field]).f, v = g.v, n = opts.n || 500;
      const rnd = () => [v.xmin + Math.random() * (v.xmax - v.xmin), v.ymin + Math.random() * (v.ymax - v.ymin)];
      if (!st.P) { st.P = []; for (let i = 0; i < n; i++) { const p = rnd(); st.P.push({ x: p[0], y: p[1], age: Math.random() * 4 }); } }
      const sp = opts.speed || 0.6;
      for (const p of st.P) {
        const f = F(p.x, p.y); p.x += f[0] * dt * sp; p.y += f[1] * dt * sp; p.age += dt;
        const out = p.x < v.xmin || p.x > v.xmax || p.y < v.ymin || p.y > v.ymax;
        const tooClose = Math.hypot(p.x, p.y) < 0.05 && st.field === 'sink';
        if (out || tooClose || p.age > (opts.life || 6)) {
          // источник рождает частицы в центре, остальные — по всей области
          if (st.field === 'source') { const a = Math.random() * TAU, r = 0.05 + Math.random() * 0.1; p.x = r * Math.cos(a); p.y = r * Math.sin(a); }
          else { const q = rnd(); p.x = q[0]; p.y = q[1]; }
          p.age = 0;
        }
      }
    },
    draw(g, st) {
      const F = (FIELDS[st.field] || EXTRA[st.field]).f, v = g.v = g.full(opts.range || [-2.6, 2.6, -1.5, 1.5], true);
      if (opts.heatDiv) v.heat((x, y) => divColor(divNum(F, x, y) / opts.heatDiv), 6);
      v.quiver(F, { step: 44, color: rgba(C.math3, .22) });
      if (st.P) {
        const c = g.ctx; c.fillStyle = C.amber;
        for (const p of st.P) { const a = Math.min(1, p.age * 2); c.globalAlpha = a; c.fillRect(v.X(p.x) - 1.3, v.Y(p.y) - 1.3, 2.6, 2.6); }
        c.globalAlpha = 1;
      }
      const dv = divNum(F, 0.2, 0.1);
      panel(g, [[`div F ${dv > 0.01 ? '> 0' : dv < -0.01 ? '< 0' : '= 0'}`, dv > 0.01 ? C.math : dv < -0.01 ? C.coral : C.green],
        [dv > 0.01 ? T('частицы рождаются и разрежаются', 'particles are born and thin out') : dv < -0.01 ? T('частицы сгущаются и исчезают', 'particles crowd and vanish') : T('плотность частиц не меняется', 'particle density stays constant'), C.muted]]);
    },
  });
}
const EXTRA = {
  cells: { f: (x, y) => [Math.sin(x * 1.3) * Math.cos(y * 1.3), -Math.cos(x * 1.3) * Math.sin(y * 1.3)], ru: 'ячейки (sin x cos y, −cos x sin y)', en: 'cells (sin x cos y, −cos x sin y)' },
  wave: { f: (x, y) => [Math.sin(x), Math.cos(y)], ru: '(sin x, cos y)', en: '(sin x, cos y)' },
  dipole: {
    f: (x, y) => { const a = [x + 1, y], b = [x - 1, y], ra = a[0] ** 2 + a[1] ** 2 + .02, rb = b[0] ** 2 + b[1] ** 2 + .02; return [a[0] / ra - b[0] / rb, a[1] / ra - b[1] / rb]; },
    ru: 'источник + сток', en: 'source + sink',
  },
};
FIGS['particles'] = particleFig(['source', 'sink', 'uniform', 'rot', 'stretch'], 'source');
FIGS['solenoidal'] = particleFig(['cells', 'rot', 'shear', 'source'], 'cells', { n: 700, speed: 0.8, life: 9, range: [-3, 3, -1.7, 1.7] });

FIGS['div-heat'] = fig => mount(fig, {
  aspect: 0.6, state: { field: 'wave', hx: 0, hy: 0, hover: false },
  controls: [{ type: 'select', key: 'field', label: ['Поле', 'Field'], options: [['wave', '(sin x, cos y)', '(sin x, cos y)'], ['dipole', 'источник + сток', 'source + sink'], ['cells', 'ячейки (div = 0)', 'cells (div = 0)'], ['source', '(x, y)', '(x, y)']] }],
  pointer(st, px, py, type, g) { if (type === 'leave') { st.hover = false; return; } const p = g.v.inv(px, py); st.hx = p[0]; st.hy = p[1]; st.hover = true; },
  draw(g, st) {
    const F = (EXTRA[st.field] || FIELDS[st.field]).f, v = g.v = g.full([-3, 3, -1.8, 1.8], true);
    const sc = st.field === 'dipole' ? 6 : 1.8;
    v.heat((x, y) => divColor(divNum(F, x, y) / sc), 4);
    v.quiver(F, { step: 34, color: 'rgba(236,238,245,.75)' });
    if (st.hover) {
      const d = divNum(F, st.hx, st.hy);
      v.dot(st.hx, st.hy, 4, C.text);
      v.text(`div F = ${fmt(d)}`, st.hx + .12, st.hy + .2, { mono: true, bg: 'rgba(11,13,20,.8)', color: d > 0 ? C.math3 : d < 0 ? C.coral : C.text });
    }
    panel(g, [[T('синий: div > 0 (источники)', 'blue: div > 0 (sources)'), C.math], [T('красный: div < 0 (стоки)', 'red: div < 0 (sinks)'), C.coral], [T('наведите курсор', 'hover to read div'), C.muted]]);
  },
});

// ═════════════════════════ Модуль 03 — Ротор ═════════════════════════
FIGS['paddle'] = fig => mount(fig, {
  aspect: 0.58, anim: true, state: { field: 'shear', cx: 0.6, cy: 0.6, ang: 0, P: null },
  controls: [{ type: 'select', key: 'field', label: ['Поле', 'Field'], options: fieldOpts(['rot', 'shear', 'uniform', 'source', 'vortex', 'saddle']), onChange: st => { st.P = null; } }],
  pointer(st, px, py, type, g) { if (type !== 'down' && type !== 'drag') return false; const p = g.v.inv(px, py); st.cx = p[0]; st.cy = p[1]; },
  step(st, dt, g) {
    const F = FIELDS[st.field].f;
    st.ang += 0.5 * curlNum(F, st.cx, st.cy) * dt * 0.8;
    if (!g.v) return;
    const v = g.v;
    if (!st.P) { st.P = []; for (let i = 0; i < 260; i++) st.P.push([v.xmin + Math.random() * (v.xmax - v.xmin), v.ymin + Math.random() * (v.ymax - v.ymin)]); }
    for (const p of st.P) {
      const f = F(p[0], p[1]); const m = Math.hypot(f[0], f[1]), k = m > 3 ? 3 / m : 1;
      p[0] += f[0] * k * dt * 0.8; p[1] += f[1] * k * dt * 0.8;
      if (p[0] < v.xmin || p[0] > v.xmax || p[1] < v.ymin || p[1] > v.ymax || Math.random() < 0.003) { p[0] = v.xmin + Math.random() * (v.xmax - v.xmin); p[1] = v.ymin + Math.random() * (v.ymax - v.ymin); }
    }
  },
  draw(g, st) {
    const F = FIELDS[st.field].f, v = g.v = g.full([-2.6, 2.6, -1.5, 1.5], true);
    v.axes({ grid: 0.5 });
    v.quiver(F, { step: 38, color: rgba(C.math3, .4), ref: st.field === 'vortex' ? 1.5 : undefined });
    if (st.P) { g.ctx.fillStyle = rgba(C.amber, .55); for (const p of st.P) g.ctx.fillRect(v.X(p[0]) - 1, v.Y(p[1]) - 1, 2, 2); }
    // вертушка
    const R = 0.42, cr = curlNum(F, st.cx, st.cy);
    v.circle(st.cx, st.cy, R, rgba(C.text, .4), rgba(C.bg, .4), 1);
    for (let k = 0; k < 4; k++) {
      const a = st.ang + k * PI / 2, ex = Math.cos(a) * R, ey = Math.sin(a) * R;
      v.line(st.cx, st.cy, st.cx + ex, st.cy + ey, k === 0 ? C.pink : C.text, 3);
      v.dot(st.cx + ex, st.cy + ey, 3.5, k === 0 ? C.pink : C.text);
    }
    v.dot(st.cx, st.cy, 4, C.amber);
    // скорости на концах лопастей
    for (let k = 0; k < 4; k++) { const a = k * PI / 2, x = st.cx + Math.cos(a) * R, y = st.cy + Math.sin(a) * R, f = F(x, y), m = Math.hypot(f[0], f[1]), s = m > 2 ? 0.5 / m : 0.25; v.arrow(x, y, f[0] * s, f[1] * s, C.green, 1.8, 6); }
    panel(g, [[`rot F = ${fmt(cr)}`, Math.abs(cr) > 1e-3 ? C.amber : C.muted],
      [Math.abs(cr) < 1e-3 ? T('вертушка не вращается', 'paddle wheel does not spin') : cr > 0 ? T('вращение против часовой', 'spins counter-clockwise') : T('вращение по часовой', 'spins clockwise'), C.muted],
      [T('тащите вертушку', 'drag the paddle wheel'), C.muted]]);
  },
});

FIGS['righthand'] = fig => mount(fig, {
  aspect: 0.55, anim: true, state: { dir: 1, az: 0.6 },
  controls: [{ type: 'select', key: 'dir', label: ['Вращение', 'Rotation'], options: [['1', 'против часовой (вид сверху)', 'counter-clockwise (from above)'], ['-1', 'по часовой (вид сверху)', 'clockwise (from above)']] }],
  step(st, dt) { st.az += dt * 0.15; },
  draw(g, st) {
    const dir = +st.dir, P = proj3(st.az, 0.42), v = g.full([-2.4, 2.4, -1.3, 1.7], true);
    const L = (a, b, col, lw, dash) => { const p = P(...a), q = P(...b); v.line(p[0], p[1], q[0], q[1], col, lw, dash); };
    const A = (a, b, col, lw, h) => { const p = P(...a), q = P(...b); v.arrow(p[0], p[1], q[0] - p[0], q[1] - p[1], col, lw, h); };
    // плоскость xy
    for (let i = -2; i <= 2; i++) { L([i * .5, -1, 0], [i * .5, 1, 0], C.grid, 1); L([-1, i * .5, 0], [1, i * .5, 0], C.grid, 1); }
    A([0, 0, 0], [1.3, 0, 0], C.muted, 1.2, 7); A([0, 0, 0], [0, 1.3, 0], C.muted, 1.2, 7);
    const px = P(1.42, 0, 0), py = P(0, 1.42, 0); v.text('x', px[0], px[1], { color: C.muted }); v.text('y', py[0], py[1], { color: C.muted });
    // кольцевые стрелки
    const ring = []; for (let t = 0; t <= TAU + .01; t += .05) ring.push(P(0.8 * Math.cos(t), 0.8 * Math.sin(t), 0));
    v.poly(ring, rgba(C.amber, .5), 2);
    for (let k = 0; k < 6; k++) {
      const t = k / 6 * TAU + st.t * 0.8 * dir, t2 = t + 0.35 * dir;
      A([0.8 * Math.cos(t), 0.8 * Math.sin(t), 0], [0.8 * Math.cos(t2), 0.8 * Math.sin(t2), 0], C.amber, 2.5, 10);
    }
    // ротор вдоль z
    A([0, 0, 0], [0, 0, 1.25 * dir], C.pink, 3.5, 13);
    const tz = P(0, 0, 1.4 * dir); v.text('rot F', tz[0] + .1, tz[1], { color: C.pink, bold: true, size: 14 });
    v.text('z', P(0, 0, 1.6)[0] - .15, P(0, 0, 1.6)[1], { color: C.muted });
    panel(g, [[T('правило правой руки:', 'right-hand rule:'), C.text],
      [T('4 пальца — по вращению,', '4 fingers along the rotation,'), C.amber],
      [T('большой палец — вдоль rot F', 'thumb along rot F'), C.pink]]);
  },
});

function loopFig(defField, fields, opts = {}) {
  return fig => mount(fig, {
    aspect: 0.6, state: { field: defField, cx: opts.cx ?? 0.4, cy: opts.cy ?? 0.2, R: opts.R ?? 0.9 },
    controls: [
      ...(fields.length > 1 ? [{ type: 'select', key: 'field', label: ['Поле', 'Field'], options: fields.map(k => [k, (FIELDS[k] || EXTRA2[k]).ru, (FIELDS[k] || EXTRA2[k]).en]) }] : []),
      { type: 'range', key: 'R', label: ['Радиус контура R', 'Loop radius R'], min: 0.15, max: 1.5, step: 0.01 },
    ],
    pointer(st, px, py, type, g) { if (type !== 'down' && type !== 'drag') return false; const p = g.v.inv(px, py); st.cx = p[0]; st.cy = p[1]; },
    draw(g, st) {
      const FF = FIELDS[st.field] || EXTRA2[st.field], F = FF.f, v = g.v = g.full([-2.7, 2.7, -1.65, 1.65], true);
      if (opts.heatCurl) v.heat((x, y) => divColor(curlNum(F, x, y) / opts.heatCurl), 5);
      v.axes({ grid: opts.heatCurl ? 0 : 0.5 });
      v.quiver(F, { step: 36, color: rgba(C.math3, .45), ref: FF.ref });
      // циркуляция по окружности
      const N = 720, R = st.R; let circ = 0;
      for (let i = 0; i < N; i++) {
        const t = (i + .5) / N * TAU, x = st.cx + R * Math.cos(t), y = st.cy + R * Math.sin(t), f = F(x, y);
        circ += (f[0] * -Math.sin(t) + f[1] * Math.cos(t)) * R * TAU / N;
      }
      // ∬ rot F dA по кругу (полярная сетка)
      let flux = 0; const nr = 40, nt = 80;
      for (let i = 0; i < nr; i++) for (let j = 0; j < nt; j++) {
        const r = (i + .5) / nr * R, t = (j + .5) / nt * TAU;
        flux += curlNum(F, st.cx + r * Math.cos(t), st.cy + r * Math.sin(t)) * r * (R / nr) * (TAU / nt);
      }
      v.circle(st.cx, st.cy, R, C.text, rgba(C.text, .04), 1.5);
      const M = 24;
      for (let i = 0; i < M; i++) {
        const t = i / M * TAU, x = st.cx + R * Math.cos(t), y = st.cy + R * Math.sin(t), f = F(x, y), tx = -Math.sin(t), ty = Math.cos(t);
        const ft = f[0] * tx + f[1] * ty, s = clamp(ft, -2.5, 2.5) * 0.16;
        v.arrow(x, y, tx * s, ty * s, ft > 1e-6 ? C.green : ft < -1e-6 ? C.coral : C.muted, 2.4, 7);
      }
      // направление обхода
      v.arrow(st.cx + R * Math.cos(0.9), st.cy + R * Math.sin(0.9), -Math.sin(0.9) * .01, Math.cos(0.9) * .01, C.text, 1, 9);
      const A = PI * R * R, lines = [
        [T('Γ = ∮ F·dr', 'Γ = ∮ F·dr') + ` = ${fmt(circ, 3)}`, C.amber],
        [`∬ rot F dA = ${fmt(flux, 3)}`, C.pink],
        [`Γ / ${T('площадь', 'area')} = ${fmt(circ / A, 3)}`, C.text],
        [`rot F (${T('центр', 'center')}) = ${fmt(curlNum(F, st.cx, st.cy), 3)}`, C.muted],
        [T('зелёный: F по обходу, красный: против', 'green: F along loop, red: against'), C.muted],
      ];
      panel(g, opts.noFlux ? lines.filter((_, i) => i !== 1) : lines);
    },
  });
}
const EXTRA2 = {
  blob: { f: (x, y) => { const e = Math.exp(-(x * x + y * y) / 0.6); return [-y * e * 2, x * e * 2]; }, ru: 'вихрь-«пятно» (−y, x)·e^(−r²)', en: 'vortex blob (−y, x)·e^(−r²)' },
  twin: {
    f: (x, y) => { const a = Math.exp(-((x + 1) ** 2 + y * y) / 0.4), b = Math.exp(-((x - 1) ** 2 + y * y) / 0.4); return [-y * a * 3 + y * b * 3, (x + 1) * a * 3 - (x - 1) * b * 3]; },
    ru: 'два вихря разных знаков', en: 'two opposite vortices',
  },
  gradxy: { f: (x, y) => [y, x], ru: 'F = (y, x) = ∇(xy)', en: 'F = (y, x) = ∇(xy)' },
};
FIGS['circulation'] = loopFig('rot', ['rot', 'shear', 'uniform', 'source', 'vortex', 'spiral'], { noFlux: true });
FIGS['stokes-circle'] = loopFig('rot', ['rot'], { cx: 0, cy: 0, R: 1, noFlux: false });
FIGS['stokes-vortex'] = loopFig('blob', ['blob', 'twin', 'shear', 'vortex', 'gradxy'], { heatCurl: 3, cx: 0.5, cy: 0.1, R: 0.7 });

FIGS['irrot'] = fig => mount(fig, {
  aspect: 0.6, state: { bx: 1.3, by: 1.0 },
  pointer(st, px, py, type, g) { if (type !== 'down' && type !== 'drag') return false; const p = g.v.inv(px, py); st.bx = clamp(p[0], -2.4, 2.4); st.by = clamp(p[1], -1.5, 1.5); },
  draw(g, st) {
    const phi = (x, y) => x * y, F = (x, y) => [y, x], v = g.v = g.full([-2.6, 2.6, -1.6, 1.6], true);
    v.heat((x, y) => divColor(phi(x, y) / 3), 4);
    v.contours(phi, [-3, -2, -1.2, -0.6, -0.2, 0.2, 0.6, 1.2, 2, 3], 'rgba(255,255,255,.35)');
    v.quiver(F, { step: 38, color: rgba(C.green, .8) });
    const ax = -1.5, ay = -0.6;
    // путь 1: прямая; путь 2: ломаная через угол; путь 3: дуга
    const path1 = [], path2 = [[ax, ay], [ax, st.by], [st.bx, st.by]], path3 = [];
    for (let i = 0; i <= 60; i++) { const s = i / 60; path1.push([ax + (st.bx - ax) * s, ay + (st.by - ay) * s]); path3.push([ax + (st.bx - ax) * s, ay + (st.by - ay) * s - 1.2 * Math.sin(PI * s)]); }
    const work = pts => { let s = 0; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], m = F((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); s += m[0] * (b[0] - a[0]) + m[1] * (b[1] - a[1]); } return s; };
    const dense = p => { const out = []; for (let i = 0; i < p.length - 1; i++) for (let k = 0; k < 40; k++) { const s = k / 40; out.push([p[i][0] + (p[i + 1][0] - p[i][0]) * s, p[i][1] + (p[i + 1][1] - p[i][1]) * s]); } out.push(p[p.length - 1]); return out; };
    v.clip(() => { v.poly(path1, C.amber, 2.5); v.poly(path2, C.pink, 2.5); v.poly(path3, C.purple, 2.5); });
    v.dot(ax, ay, 6, C.text, C.bg); v.text('A', ax - .15, ay - .15, { bold: true });
    v.dot(st.bx, st.by, 6, C.text, C.bg); v.text('B', st.bx + .12, st.by + .15, { bold: true });
    panel(g, [[T('∫ F·dr по трём путям A→B:', '∫ F·dr along three paths A→B:'), C.text],
      [`${T('прямая', 'straight')}:   ${fmt(work(path1), 3)}`, C.amber], [`${T('ломаная', 'polyline')}:  ${fmt(work(dense(path2)), 3)}`, C.pink],
      [`${T('дуга', 'arc')}:     ${fmt(work(path3), 3)}`, C.purple], [`φ(B) − φ(A) = ${fmt(phi(st.bx, st.by) - phi(ax, ay), 3)}`, C.green],
      [T('тащите точку B', 'drag point B'), C.muted]]);
  },
});

// ═════════════════════════ Модуль 04 — Поток ═════════════════════════
FIGS['scalar-flux'] = fig => mount(fig, {
  aspect: 0.6, state: { n: 6, az: 0.7 },
  controls: [{ type: 'range', key: 'n', label: ['Разбиение N×N', 'Partition N×N'], min: 1, max: 30, step: 1, fmt: v => `${v}×${v}` }],
  pointer(st, px, py, type, g) { if (type !== 'drag') return false; st.az = (px / g.w) * TAU; },
  draw(g, st) {
    const zf = (x, y) => 0.45 * Math.sin(1.4 * x) * Math.cos(1.2 * y), Tf = (x, y, z) => 1.5 + 0.5 * x + 1.2 * z;
    const P = proj3(st.az, 0.5), v = g.full([-2.2, 2.2, -1.5, 1.4], true), n = st.n, a = 1.6;
    const cells = []; let sum = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x0 = -a + 2 * a * i / n, x1 = x0 + 2 * a / n, y0 = -a + 2 * a * j / n, y1 = y0 + 2 * a / n;
      const q = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => [x, y, zf(x, y)]);
      const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2, zm = zf(xm, ym);
      // площадь ячейки ≈ |r_x × r_y| dx dy
      const hx = 2 * a / n, zx = (zf(xm + 1e-4, ym) - zf(xm - 1e-4, ym)) / 2e-4, zy = (zf(xm, ym + 1e-4) - zf(xm, ym - 1e-4)) / 2e-4;
      const dS = Math.sqrt(1 + zx * zx + zy * zy) * hx * hx, Tv = Tf(xm, ym, zm);
      sum += Tv * dS;
      cells.push({ q, Tv, d: P.depth(xm, ym, zm) });
    }
    cells.sort((A, B) => A.d - B.d);
    for (const c of cells) {
      const col = seqColor((c.Tv - 0.3) / 2.6).map(Math.round);
      v.poly(c.q.map(p => P(...p)), n > 18 ? null : 'rgba(11,13,20,.6)', 1, true, `rgb(${col})`);
    }
    panel(g, [[T('T(x,y,z) = 1.5 + 0.5x + 1.2z', 'T(x,y,z) = 1.5 + 0.5x + 1.2z'), C.muted], [`Σ T(Mᵢ)·ΔSᵢ = ${fmt(sum, 4)}`, C.amber],
      [T('N → ∞: сумма → ∬ T dS', 'N → ∞: sum → ∬ T dS'), C.text], [T('тащите для поворота', 'drag to rotate'), C.muted]]);
  },
});

FIGS['flux-angle'] = fig => mount(fig, {
  aspect: 0.55, state: { th: 0.6 },
  controls: [{ type: 'range', key: 'th', label: ['Угол θ между F и n', 'Angle θ between F and n'], min: 0, max: 3.1416, step: 0.01, fmt: v => `${Math.round(v * 180 / PI)}°` }],
  draw(g, st) {
    const v = g.full([-2.6, 2.6, -1.5, 1.5], true), L = 1.1, th = st.th;
    // поле: горизонтальные линии тока слева направо
    const sp = 0.2;
    // площадка повернута так, что нормаль n образует угол θ с осью x
    const nx = Math.cos(th), ny = Math.sin(th), tx = -ny, ty = nx;
    const crossesSeg = y => { // линия y=const пересекает отрезок [-L,L]·t ?
      if (Math.abs(ty) < 1e-9) return Math.abs(y) < 1e-9; const s = y / ty; return Math.abs(s) <= L; };
    let cnt = 0;
    for (let y = -1.5 + sp / 2; y < 1.5; y += sp) {
      const hit = crossesSeg(y); if (hit) cnt++;
      const xHit = hit && Math.abs(ty) > 1e-9 ? tx * (y / ty) : null;
      if (hit) { v.line(-2.6, y, xHit, y, rgba(C.math, .9), 1.6); v.line(xHit, y, 2.6, y, rgba(C.math, .45), 1.6, [4, 4]); }
      else v.line(-2.6, y, 2.6, y, rgba(C.muted, .25), 1);
      if (y > -1.4 && y < 1.4) v.arrow(-2.3, y, 0.3, 0, hit ? C.math : rgba(C.muted, .4), 1.4, 6);
    }
    // проекция площадки на плоскость, перпендикулярную F
    const proj = L * Math.abs(ty);
    v.line(-2.0, -proj, -2.0, proj, C.amber, 5);
    v.text(T('проекция ⟂F', 'projection ⟂F'), -2.0, proj + 0.18, { color: C.amber, align: 'center', size: 11 });
    v.line(-L * tx, -L * ty, L * tx, L * ty, C.text, 5);
    v.arrow(0, 0, nx * 0.8, ny * 0.8, C.green, 3, 11);
    v.text('n', nx * 0.95, ny * 0.95 + 0.05, { color: C.green, bold: true, size: 14 });
    v.text('F', 2.35, 1.35, { color: C.math, bold: true, size: 14 });
    v.text('dS', L * tx + .12, L * ty, { color: C.text, bold: true });
    const fl = Math.cos(th);
    panel(g, [[`F·n dS = |F| dS cos θ = ${fmt(fl * 2 * L, 3)}`, Math.abs(fl) < 1e-3 ? C.muted : fl > 0 ? C.green : C.coral],
      [T('пересекающих линий', 'lines crossing') + `: ${cnt}`, C.math],
      [Math.abs(fl) < 0.02 ? T('θ = 90°: поле скользит, поток 0', 'θ = 90°: field grazes, flux 0') : fl > 0 ? T('θ < 90°: поток положителен', 'θ < 90°: flux positive') : T('θ > 90°: поток отрицателен', 'θ > 90°: flux negative'), C.muted]], 10, 10, 'right');
  },
});

FIGS['mobius'] = fig => mount(fig, {
  aspect: 0.55, anim: true, state: { u: 0 },
  controls: [{ type: 'button', label: ['⏯ пауза', '⏯ pause'], onClick: st => { st.paused = !st.paused; } }],
  step(st, dt) { st.u = (st.u + dt * 0.5) % (2 * TAU); },
  draw(g, st) {
    const W = g.w / 2;
    // слева — сфера (двусторонняя), справа — лист Мёбиуса (односторонний)
    const vs = g.view({ x: 0, y: 10, w: W, h: g.h - 40 }, [-1.6, 1.6, -1.5, 1.5], true);
    vs.circle(0, 0, 1, C.text, rgba(C.math, .08), 2);
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; vs.arrow(Math.cos(a), Math.sin(a), Math.cos(a) * .4, Math.sin(a) * .4, C.green, 2, 8); }
    vs.textPx(T('замкнутая поверхность: n наружу', 'closed surface: n outward'), W / 2, g.h - 14, { align: 'center', color: C.muted, size: 12 });
    const P = proj3(0.5, 0.75), vm = g.view({ x: W, y: 24, w: W, h: g.h - 48 }, [-1.6, 1.6, -1.15, 1.15], true);
    const M = (u, w) => [(1 + w / 2 * Math.cos(u / 2)) * Math.cos(u), (1 + w / 2 * Math.cos(u / 2)) * Math.sin(u), w / 2 * Math.sin(u / 2)];
    const quads = [];
    const NU = 60, NW = 4;
    for (let i = 0; i < NU; i++) for (let j = 0; j < NW; j++) {
      const u0 = i / NU * TAU, u1 = (i + 1) / NU * TAU, w0 = -1 + 2 * j / NW, w1 = w0 + 2 / NW;
      const q = [M(u0, w0), M(u1, w0), M(u1, w1), M(u0, w1)], c = M((u0 + u1) / 2, (w0 + w1) / 2);
      quads.push({ q, d: P.depth(...c) });
    }
    quads.sort((a, b) => a.d - b.d);
    for (const q of quads) vm.poly(q.q.map(p => P(...p)), 'rgba(139,124,248,.5)', .7, true, 'rgba(139,124,248,.16)');
    // нормаль вдоль средней линии
    const u = st.u, du = 1e-3;
    const ru = [(M(u + du, 0)[0] - M(u - du, 0)[0]) / (2 * du), (M(u + du, 0)[1] - M(u - du, 0)[1]) / (2 * du), (M(u + du, 0)[2] - M(u - du, 0)[2]) / (2 * du)];
    const rw = [(M(u, .01)[0] - M(u, -.01)[0]) / .02, (M(u, .01)[1] - M(u, -.01)[1]) / .02, (M(u, .01)[2] - M(u, -.01)[2]) / .02];
    let n = [ru[1] * rw[2] - ru[2] * rw[1], ru[2] * rw[0] - ru[0] * rw[2], ru[0] * rw[1] - ru[1] * rw[0]];
    const nl = Math.hypot(...n); n = n.map(c => c / nl * 0.6);
    const p0 = M(u, 0), a = P(...p0), b = P(p0[0] + n[0], p0[1] + n[1], p0[2] + n[2]);
    const lap = st.u >= TAU;
    vm.arrow(a[0], a[1], b[0] - a[0], b[1] - a[1], lap ? C.coral : C.green, 3, 10);
    const s0 = P(...M(0, 0)); vm.dot(s0[0], s0[1], 4, C.amber);
    vm.textPx(lap ? T('2-й круг: n смотрит в другую сторону!', 'lap 2: n points the other way!') : T('1-й круг: переносим нормаль', 'lap 1: transporting the normal'),
      W + W / 2, g.h - 14, { align: 'center', color: lap ? C.coral : C.muted, size: 12 });
    vm.textPx(T('лист Мёбиуса: одна сторона', 'Möbius strip: one side'), W + W / 2, 14, { align: 'center', color: C.purple, size: 12 });
  },
});

const FLUX_FIELDS = ['uniform', 'source', 'sink', 'rot', 'stretch', 'saddle'];
FIGS['closed-flux'] = fig => mount(fig, {
  aspect: 0.6, state: { field: 'source', shape: 'circle', cx: 0.4, cy: 0.1 },
  controls: [{ type: 'select', key: 'field', label: ['Поле', 'Field'], options: fieldOpts(FLUX_FIELDS) },
    { type: 'select', key: 'shape', label: ['Контур', 'Contour'], options: [['circle', 'окружность', 'circle'], ['square', 'квадрат', 'square'], ['blob', 'клякса', 'blob']] }],
  pointer(st, px, py, type, g) { if (type !== 'down' && type !== 'drag') return false; const p = g.v.inv(px, py); st.cx = p[0]; st.cy = p[1]; },
  draw(g, st) {
    const F = FIELDS[st.field].f, v = g.v = g.full([-2.7, 2.7, -1.65, 1.65], true);
    v.axes({ grid: 0.5 });
    v.quiver(F, { step: 36, color: rgba(C.math3, .4) });
    const rad = t => st.shape === 'blob' ? 0.9 + 0.25 * Math.sin(3 * t) + 0.12 * Math.cos(5 * t) : st.shape === 'square' ? 0.85 / Math.max(Math.abs(Math.cos(t)), Math.abs(Math.sin(t))) : 0.95;
    const N = 1440, pts = [];
    for (let i = 0; i <= N; i++) { const t = i / N * TAU, r = rad(t); pts.push([st.cx + r * Math.cos(t), st.cy + r * Math.sin(t)]); }
    let flux = 0;
    for (let i = 0; i < N; i++) { const a = pts[i], b = pts[i + 1], m = F((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); flux += m[0] * (b[1] - a[1]) - m[1] * (b[0] - a[0]); }
    v.poly(pts, C.text, 2, true, rgba(C.text, .04));
    for (let k = 0; k < 28; k++) {
      const i = Math.floor(k / 28 * N), a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = dy / l, ny = -dx / l;
      const f = F(a[0], a[1]), fn = f[0] * nx + f[1] * ny, s = clamp(fn, -2.5, 2.5) * 0.17;
      v.arrow(a[0], a[1], nx * s, ny * s, fn > 1e-6 ? C.green : fn < -1e-6 ? C.coral : C.muted, 2.2, 7);
    }
    // площадь области и среднее div
    let area = 0; for (let i = 0; i < N; i++) area += (pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]) / 2;
    panel(g, [[`Φ = ∮ F·n dl = ${fmt(flux, 3)}`, flux > 1e-3 ? C.green : flux < -1e-3 ? C.coral : C.text],
      [`div F · ${T('площадь', 'area')} = ${fmt(divNum(F, 0, 0) * area, 3)}`, C.math],
      [T('стрелки: (F·n)n — вытекание / втекание', 'arrows: (F·n)n — outflow / inflow'), C.muted], [T('тащите контур', 'drag the contour'), C.muted]]);
  },
});

// ═════════════════════════ Модуль 05 — Гаусс / Модуль 06 — Стокс: разбиение на ячейки ═════════════════════════
function cellsFig(mode) {
  // mode 'flux' — Гаусс: потоки через грани; 'circ' — Стокс: циркуляции по рёбрам
  return fig => mount(fig, {
    aspect: 0.6, state: { n: 3, show: 'all' },
    controls: [{ type: 'range', key: 'n', label: ['Число ячеек N×N', 'Cells N×N'], min: 1, max: 10, step: 1, fmt: v => `${v}×${v}` },
      { type: 'select', key: 'show', label: ['Показать', 'Show'], options: [['all', 'все грани', 'all edges'], ['outer', 'только внешние', 'outer only']] }],
    draw(g, st) {
      const F = mode === 'flux' ? ((x, y) => [0.6 * x * x + 0.4, 0.5 * y + 0.3 * x * y]) : ((x, y) => [-y + 0.3 * x * y, x + 0.25 * x * x]);
      const S = Math.min(g.h - 24, g.w * 0.56), v = g.view({ x: 12, y: 12, w: S, h: S }, [-1.25, 1.25, -1.25, 1.25], true);
      const n = st.n, a = 1, h = 2 * a / n, Q = 8;
      v.quiver(F, { step: 30, color: rgba(C.math3, .22) });
      // интеграл по одному ребру
      const edge = (x0, y0, x1, y1) => {
        let s = 0; for (let k = 0; k < Q; k++) {
          const t = (k + .5) / Q, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, f = F(x, y), dx = (x1 - x0) / Q, dy = (y1 - y0) / Q;
          s += mode === 'flux' ? f[0] * dy - f[1] * dx : f[0] * dx + f[1] * dy;
        } return s;
      };
      let sumCells = 0, sumDiv = 0, outer = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x0 = -a + i * h, y0 = -a + j * h, xm = x0 + h / 2, ym = y0 + h / 2;
        const E = [[x0, y0, x0 + h, y0], [x0 + h, y0, x0 + h, y0 + h], [x0 + h, y0 + h, x0, y0 + h], [x0, y0 + h, x0, y0]];
        let cell = 0;
        E.forEach(([p, q, r, s], k) => {
          const val = edge(p, q, r, s); cell += val;
          const isOuter = (k === 0 && j === 0) || (k === 1 && i === n - 1) || (k === 2 && j === n - 1) || (k === 3 && i === 0);
          if (isOuter) outer += val;
          if (st.show === 'outer' && !isOuter) return;
          const col = isOuter ? C.amber : rgba(C.muted, .65);
          // рисуем стрелку на ребре, чуть сдвинутую внутрь ячейки
          const mx = (p + r) / 2, my = (q + s) / 2, ix = (xm - mx) * 0.22, iy = (ym - my) * 0.22, len = h * 0.3;
          if (mode === 'circ') {
            const ex = (r - p) / h, ey = (s - q) / h, sg = Math.sign(val) || 1;
            v.arrow(mx + ix - ex * len / 2 * sg, my + iy - ey * len / 2 * sg, ex * len * sg, ey * len * sg, col, isOuter ? 2.2 : 1.4, 6);
          } else {
            const nx = (s - q) / h, ny = -(r - p) / h, sg = Math.sign(val) || 1;
            v.arrow(mx + ix * 0.5, my + iy * 0.5, nx * len * 0.8 * sg, ny * len * 0.8 * sg, val > 0 ? (isOuter ? C.green : rgba(C.green, .45)) : (isOuter ? C.coral : rgba(C.coral, .45)), isOuter ? 2.2 : 1.3, 6);
          }
        });
        sumCells += cell;
        sumDiv += (mode === 'flux' ? divNum(F, xm, ym) : curlNum(F, xm, ym)) * h * h;
      }
      for (let i = 0; i <= n; i++) { v.line(-a + i * h, -a, -a + i * h, a, rgba(C.text, .35), 1); v.line(-a, -a + i * h, a, -a + i * h, rgba(C.text, .35), 1); }
      v.poly([[-a, -a], [a, -a], [a, a], [-a, a]], C.text, 2, true);
      const x = S + 30, lines = mode === 'flux' ? [
        [T('Σ потоков всех ячеек', 'Σ fluxes of all cells'), C.muted], [`= ${fmt(sumCells, 4)}`, C.text],
        [T('поток через внешнюю границу', 'flux through outer boundary'), C.muted], [`= ${fmt(outer, 4)}`, C.amber],
        [T('Σ div F·ΔV (центры ячеек)', 'Σ div F·ΔV (cell centers)'), C.muted], [`= ${fmt(sumDiv, 4)}`, C.math],
        ['', C.muted], [T('внутренние грани: поток', 'inner faces: flux leaving'), C.muted], [T('из одной ячейки = поток', 'one cell = flux entering'), C.muted], [T('в соседнюю → сокращаются', 'its neighbour → cancel'), C.muted],
      ] : [
        [T('Σ циркуляций всех ячеек', 'Σ circulations of cells'), C.muted], [`= ${fmt(sumCells, 4)}`, C.text],
        [T('циркуляция по внешнему краю', 'circulation along outer edge'), C.muted], [`= ${fmt(outer, 4)}`, C.amber],
        [T('Σ rot F·ΔS (центры ячеек)', 'Σ rot F·ΔS (cell centers)'), C.muted], [`= ${fmt(sumDiv, 4)}`, C.pink],
        ['', C.muted], [T('общее ребро соседи', 'neighbours traverse a shared'), C.muted], [T('проходят в разные стороны', 'edge in opposite directions'), C.muted], [T('→ вклады сокращаются', '→ contributions cancel'), C.muted],
      ];
      lines.forEach((l, i) => v.textPx(l[0], x, 24 + i * 19, { color: l[1], mono: l[0].startsWith('='), size: 12.5 }));
    },
  });
}
FIGS['gauss-cells'] = cellsFig('flux');
FIGS['stokes-cells'] = cellsFig('circ');

FIGS['gauss-drag'] = fig => mount(fig, {
  aspect: 0.6, state: { cx: -0.9, cy: 0.2, R: 0.8, shape: 'circle' },
  controls: [{ type: 'range', key: 'R', label: ['Размер поверхности', 'Surface size'], min: 0.2, max: 1.8, step: 0.01 },
    { type: 'select', key: 'shape', label: ['Форма', 'Shape'], options: [['circle', 'окружность', 'circle'], ['blob', 'клякса', 'blob'], ['square', 'квадрат', 'square']] }],
  pointer(st, px, py, type, g) { if (type !== 'down' && type !== 'drag') return false; const p = g.v.inv(px, py); st.cx = p[0]; st.cy = p[1]; },
  draw(g, st) {
    const Q = [[-1.2, 0.2, 1], [1.1, 0.5, -1], [0.3, -0.8, 2]];
    const F = (x, y) => { let fx = 0, fy = 0; for (const [qx, qy, q] of Q) { const dx = x - qx, dy = y - qy, r2 = dx * dx + dy * dy + 1e-6; fx += q * dx / r2; fy += q * dy / r2; } return [fx, fy]; };
    const v = g.v = g.full([-2.7, 2.7, -1.65, 1.65], true);
    for (const [qx, qy, q] of Q) for (let k = 0; k < 8 * Math.abs(q); k++) {
      const a = k / (8 * Math.abs(q)) * TAU + 0.2, x = qx + 0.08 * Math.cos(a), y = qy + 0.08 * Math.sin(a);
      v.stream(F, x, y, { n: 260, back: q < 0, color: rgba(C.math3, .28), stop: (x, y) => Q.some(([a, b, c]) => c * q < 0 && Math.hypot(x - a, y - b) < 0.07) });
    }
    v.quiver(F, { step: 40, color: rgba(C.math3, .5), ref: 3 });
    const rad = t => st.R * (st.shape === 'blob' ? 1 + 0.28 * Math.sin(3 * t) + 0.15 * Math.cos(5 * t + 1) : st.shape === 'square' ? 0.9 / Math.max(Math.abs(Math.cos(t)), Math.abs(Math.sin(t))) : 1);
    const N = 2000, pts = [];
    for (let i = 0; i <= N; i++) { const t = i / N * TAU, r = rad(t); pts.push([st.cx + r * Math.cos(t), st.cy + r * Math.sin(t)]); }
    let flux = 0;
    for (let i = 0; i < N; i++) { const a = pts[i], b = pts[i + 1], m = F((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); flux += m[0] * (b[1] - a[1]) - m[1] * (b[0] - a[0]); }
    const inside = (x, y) => { const dx = x - st.cx, dy = y - st.cy; return Math.hypot(dx, dy) < rad(Math.atan2(dy, dx)); };
    let qin = 0; Q.forEach(([x, y, q]) => { if (inside(x, y)) qin += q; });
    v.poly(pts, C.amber, 2.5, true, rgba(C.amber, .06));
    for (const [qx, qy, q] of Q) {
      const isIn = inside(qx, qy);
      v.dot(qx, qy, 11, q > 0 ? C.math : C.coral, isIn ? C.amber : C.bg);
      v.text((q > 0 ? '+' : '−') + Math.abs(q), qx, qy, { align: 'center', bold: true, color: '#000', size: 11 });
    }
    panel(g, [[`Φ = ∮ E·n dl = ${fmt(flux, 3)}`, C.amber], [`Φ / 2π = ${fmt(flux / TAU, 3)}`, C.text],
      [`Σ q ${T('внутри', 'inside')} = ${qin}`, C.green], [T('тащите контур, меняйте форму', 'drag the contour, change shape'), C.muted]]);
  },
});

FIGS['gauss-sphere'] = fig => mount(fig, {
  aspect: 0.5, state: { R: 1.0, az: 0.5 },
  controls: [{ type: 'range', key: 'R', label: ['Радиус R', 'Radius R'], min: 0.3, max: 1.4, step: 0.01 }],
  draw(g, st) {
    const W = g.w * 0.55, P = proj3(0.5, 0.35), v = g.view({ x: 0, y: 0, w: W, h: g.h }, [-1.9, 1.9, -1.7, 1.7], true), R = st.R;
    // каркас сферы
    for (let k = -2; k <= 2; k++) { const z = R * k / 3, r = Math.sqrt(R * R - z * z), pts = []; for (let t = 0; t <= TAU + .01; t += .06) pts.push(P(r * Math.cos(t), r * Math.sin(t), z)); v.poly(pts, rgba(C.text, .25), 1); }
    for (let k = 0; k < 6; k++) { const ph = k / 6 * PI, pts = []; for (let t = 0; t <= TAU + .01; t += .06) pts.push(P(R * Math.sin(t) * Math.cos(ph), R * Math.sin(t) * Math.sin(ph), R * Math.cos(t))); v.poly(pts, rgba(C.text, .25), 1); }
    // поле F = r: стрелки на поверхности, длина = R (нормальная компонента)
    const arr = [];
    for (let i = 1; i < 6; i++) for (let j = 0; j < 10; j++) {
      const th = i / 6 * PI, ph = j / 10 * TAU, n = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
      arr.push({ n, d: P.depth(...n) });
    }
    arr.sort((a, b) => a.d - b.d);
    for (const { n, d } of arr) {
      const a = P(n[0] * R, n[1] * R, n[2] * R), b = P(n[0] * R * 1.45, n[1] * R * 1.45, n[2] * R * 1.45);
      v.arrow(a[0], a[1], b[0] - a[0], b[1] - a[1], d > 0 ? C.green : rgba(C.green, .35), 1.8, 7);
    }
    // справа — сравнение двух величин
    const x = W + 10, bw = g.w - W - 30, maxV = 4 * PI * 1.4 ** 3, val = 4 * PI * R ** 3;
    const bar = (y, lbl, col) => {
      g.ctx.fillStyle = C.grid; g.ctx.fillRect(x, y, bw, 22);
      g.ctx.fillStyle = col; g.ctx.fillRect(x, y, bw * val / maxV, 22);
      v.textPx(lbl, x, y - 10, { color: C.muted, size: 12 });
      v.textPx(fmt(val, 3), x + 6, y + 11, { color: '#000', bold: true, mono: true, size: 12 });
    };
    bar(50, T('∯ F·n dS = R · 4πR²', '∯ F·n dS = R · 4πR²'), C.green);
    bar(115, T('∭ div F dV = 3 · ⁴⁄₃πR³', '∭ div F dV = 3 · ⁴⁄₃πR³'), C.math);
    v.textPx('F = r = (x, y, z),  div F = 3', x, 170, { color: C.text, mono: true, size: 12 });
    v.textPx(T('на сфере F ∥ n и |F| = R', 'on the sphere F ∥ n and |F| = R'), x, 192, { color: C.muted, size: 12 });
  },
});

// ═════════════════════════ Модуль 06 — Стокс ═════════════════════════
FIGS['stokes-surfaces'] = fig => mount(fig, {
  aspect: 0.58, anim: true, state: { hgt: 1.0, az: 0.5 },
  controls: [{ type: 'range', key: 'hgt', label: ['Выпуклость поверхности h', 'Surface bulge h'], min: -1.2, max: 1.6, step: 0.01 },
    { type: 'button', label: ['⏯ вращение', '⏯ rotation'], onClick: st => { st.paused = !st.paused; } }],
  step(st, dt) { st.az += dt * 0.25; },
  draw(g, st) {
    const P = proj3(st.az, 0.45), v = g.full([-1.9, 1.9, -1.3, 1.8], true), h = st.hgt;
    const S = (r, t) => [r * Math.cos(t), r * Math.sin(t), h * (1 - r * r)];
    const quads = [];
    const NR = 8, NT = 36;
    for (let i = 0; i < NR; i++) for (let j = 0; j < NT; j++) {
      const r0 = i / NR, r1 = (i + 1) / NR, t0 = j / NT * TAU, t1 = (j + 1) / NT * TAU;
      quads.push({ q: [S(r0, t0), S(r1, t0), S(r1, t1), S(r0, t1)], d: P.depth(...S((r0 + r1) / 2, (t0 + t1) / 2)) });
    }
    quads.sort((a, b) => a.d - b.d);
    for (const q of quads) v.poly(q.q.map(p => P(...p)), 'rgba(232,121,249,.35)', .7, true, 'rgba(232,121,249,.10)');
    // нормали (правило правого винта: обход против часовой сверху → n вверх)
    for (const [r, t] of [[0, 0], [0.55, 0.3], [0.55, 2.4], [0.55, 4.4], [0.85, 1.3], [0.85, 3.5], [0.85, 5.5]]) {
      const p = S(r, t), dzdr = -2 * h * r, n = [-dzdr * Math.cos(t), -dzdr * Math.sin(t), 1], l = Math.hypot(...n), k = 0.45 / l;
      const a = P(...p), b = P(p[0] + n[0] * k, p[1] + n[1] * k, p[2] + n[2] * k);
      v.arrow(a[0], a[1], b[0] - a[0], b[1] - a[1], C.green, 2.2, 8);
    }
    // граница L — одна и та же окружность
    const ring = []; for (let t = 0; t <= TAU + .01; t += .04) ring.push(P(Math.cos(t), Math.sin(t), 0));
    v.poly(ring, C.amber, 3);
    for (let k = 0; k < 4; k++) { const t = k / 4 * TAU + 0.4, a = P(Math.cos(t), Math.sin(t), 0), b = P(Math.cos(t + .25), Math.sin(t + .25), 0); v.arrow(a[0], a[1], b[0] - a[0], b[1] - a[1], C.amber, 3, 12); }
    panel(g, [[T('L = ∂S — один и тот же край', 'L = ∂S — the same boundary'), C.amber], [T('S — любая натянутая поверхность', 'S — any surface spanning it'), C.pink],
      [T('n согласована с обходом L', 'n agrees with direction of L'), C.green], [T('поток rot F не зависит от h', 'flux of rot F does not depend on h'), C.muted]]);
  },
});

FIGS['classify'] = fig => mount(fig, {
  aspect: 0.32,
  draw(g, st) {
    const items = [
      { F: (x, y) => [x, y], t: [T('потенциальное', 'potential'), 'F = (x, y)'], d: 'div = 2', r: 'rot = 0', c: C.math },
      { F: (x, y) => [-y, x], t: [T('соленоидальное', 'solenoidal'), 'F = (−y, x)'], d: 'div = 0', r: 'rot = 2', c: C.amber },
      { F: (x, y) => [x, -y], t: [T('гармоническое', 'harmonic'), 'F = (x, −y)'], d: 'div = 0', r: 'rot = 0', c: C.green },
      { F: (x, y) => [x - y, x + y], t: [T('общего вида', 'general'), 'F = (x−y, x+y)'], d: 'div = 2', r: 'rot = 2', c: C.coral },
    ];
    const W = g.w / 4, top = 44, bot = 36;
    items.forEach((it, i) => {
      const v = g.view({ x: i * W + 6, y: top, w: W - 12, h: g.h - top - bot }, [-1.2, 1.2, -1.2, 1.2], true);
      v.frame(); v.quiver(it.F, { step: Math.max(18, (W - 12) / 7), color: it.c, lw: 1.3 });
      v.textPx(it.t[0], i * W + W / 2, 14, { align: 'center', bold: true, color: it.c, size: 13 });
      v.textPx(it.t[1], i * W + W / 2, 31, { align: 'center', mono: true, color: C.muted, size: 11 });
      v.textPx(`${it.d}, ${it.r}`, i * W + W / 2, g.h - 16, { align: 'center', mono: true, color: C.text, size: 11 });
    });
  },
});

// ───────────────────────── запуск ─────────────────────────
function init() {
  document.querySelectorAll('figure.fig[data-fig]').forEach(fig => {
    const f = FIGS[fig.dataset.fig];
    if (f && !fig.dataset.mounted) { fig.dataset.mounted = '1'; try { f(fig); } catch (e) { console.error('fig', fig.dataset.fig, e); } }
  });
  const prev = window.onLangChange;
  window.onLangChange = function () { if (prev) prev(); REDRAW.forEach(f => f()); };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
window.FIELD_VIZ = { FIGS, View, mount };
})();
