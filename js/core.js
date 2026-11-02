/* Touch the Data: shared helpers, plotting, the Orange Line router and the in-browser Python runner. */
"use strict";
const DSV = (() => {
  const $ = id => document.getElementById(id);
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "–");
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, lo = 0, hi = 10) => Math.max(lo, Math.min(hi, v));
  function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const range = (a, b, s = 1) => { const r = []; for (let v = a; v <= b + 1e-9; v += s) r.push(+v.toFixed(6)); return r; };
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const sd = (a, ddof = 1) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - ddof)); };
  function quantile(sorted, p) {            // numpy's default "linear" method
    const pos = (sorted.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  const normCdf = z => { const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
  const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  function niceStep(raw) { const e = 10 ** Math.floor(Math.log10(raw || 1)); const f = raw / e; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e; }
  const withAlpha = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, "0");

  /* ---------- plots ---------- */
  const plots = [];
  function makePlot(canvas, aspect, draw, opts = {}) {
    const p = { canvas, ctx: canvas.getContext("2d"), w: 0, h: 0, draw,
      pad: { l: 40, r: 14, t: 14, b: 32, ...(opts.pad || {}) }, x0: 0, x1: 10, y0: 0, y1: 10, minH: opts.minH || 300 };
    p.sx = x => p.pad.l + (x - p.x0) / (p.x1 - p.x0) * (p.w - p.pad.l - p.pad.r);
    p.sy = y => p.h - p.pad.b - (y - p.y0) / (p.y1 - p.y0) * (p.h - p.pad.t - p.pad.b);
    p.ix = px => p.x0 + (px - p.pad.l) / (p.w - p.pad.l - p.pad.r) * (p.x1 - p.x0);
    p.iy = py => p.y0 + (p.h - p.pad.b - py) / (p.h - p.pad.t - p.pad.b) * (p.y1 - p.y0);
    p.inside = pos => pos.x >= p.pad.l && pos.x <= p.w - p.pad.r && pos.y >= p.pad.t && pos.y <= p.h - p.pad.b;
    p.resize = () => {
      const w = canvas.clientWidth; if (!w) return;
      const h = Math.max(p.minH, Math.min(w / aspect, window.innerHeight * 0.72));
      const dpr = window.devicePixelRatio || 1;
      canvas.style.height = h + "px"; canvas.width = w * dpr; canvas.height = h * dpr;
      p.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); p.w = w; p.h = h; p.draw();
    };
    new ResizeObserver(() => p.resize()).observe(canvas);
    plots.push(p);
    return p;
  }
  function drawGrid(p, xTicks, yTicks, xLabel = v => v, yLabel = v => v, clear = true) {
    const c = p.ctx; if (clear) c.clearRect(0, 0, p.w, p.h);
    c.font = "12px " + css("--body"); c.fillStyle = css("--ink-soft"); c.lineWidth = 1; c.strokeStyle = css("--grid"); c.textAlign = "center";
    for (const x of xTicks) { c.beginPath(); c.moveTo(p.sx(x), p.pad.t); c.lineTo(p.sx(x), p.h - p.pad.b); c.stroke(); c.fillText(xLabel(x), p.sx(x), p.h - p.pad.b + 18); }
    c.textAlign = "right";
    for (const y of yTicks) { c.beginPath(); c.moveTo(p.pad.l, p.sy(y)); c.lineTo(p.w - p.pad.r, p.sy(y)); c.stroke(); c.fillText(yLabel(y), p.pad.l - 8, p.sy(y) + 4); }
    c.strokeStyle = css("--axis"); c.beginPath(); c.moveTo(p.pad.l, p.pad.t); c.lineTo(p.pad.l, p.h - p.pad.b); c.lineTo(p.w - p.pad.r, p.h - p.pad.b); c.stroke();
  }
  function clipPlot(p) { const c = p.ctx; c.save(); c.beginPath(); c.rect(p.pad.l, p.pad.t, p.w - p.pad.l - p.pad.r, p.h - p.pad.t - p.pad.b); c.clip(); }
  function dot(c, x, y, r, fill, ring) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } if (ring) { c.strokeStyle = ring; c.lineWidth = 2; c.stroke(); } }
  function emptyText(p, text) { const c = p.ctx; c.fillStyle = css("--ink-soft"); c.textAlign = "center"; c.font = "16px " + css("--body"); c.fillText(text, p.w / 2, p.h / 2); }
  function canvasPos(e, canvas) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  /* ---------- Orange Line router ---------- */
  const STOPS = [
    { id: "sampling", stop: "Midway", title: "Sampling" },
    { id: "eda", stop: "Pulaski", title: "Summary statistics" },
    { id: "groupby", stop: "Kedzie", title: "Group by" },
    { id: "regression", stop: "Western", title: "Regression" },
    { id: "overfit", stop: "35th/Archer", title: "Overfitting" },
    { id: "knn", stop: "Ashland", title: "Classification" },
    { id: "kmeans", stop: "Halsted", title: "Clustering" },
    { id: "abtest", stop: "Roosevelt", title: "A/B testing" },
    { id: "network", stop: "Library", title: "Networks" },
  ];
  const labs = {};           // id -> { init, show }
  const started = new Set();
  function register(id, lab) { labs[id] = lab; }
  function buildRoute() {
    const nav = $("route"); nav.innerHTML = "";
    const ol = document.createElement("ol"); ol.className = "route-line";
    STOPS.forEach((s, i) => {
      const li = document.createElement("li");
      const a = document.createElement("a"); a.href = "#" + s.id; a.id = "stop-" + s.id;
      a.innerHTML = `<span class="station" aria-hidden="true"></span><span class="stop-name">${s.stop}</span><span class="stop-topic">${s.title}</span>`;
      a.setAttribute("aria-label", `Stop ${i + 1}, ${s.stop}: ${s.title}`);
      li.appendChild(a); ol.appendChild(li);
    });
    nav.appendChild(ol);
  }
  function show(id) {
    if (!labs[id]) id = STOPS[0].id;
    STOPS.forEach(s => {
      const sec = $("lab-" + s.id), on = s.id === id;
      if (sec) sec.hidden = !on;
      const a = $("stop-" + s.id); if (a) { if (on) a.setAttribute("aria-current", "step"); else a.removeAttribute("aria-current"); }
    });
    const idx = STOPS.findIndex(s => s.id === id);
    $("prevStop").hidden = idx === 0; $("nextStop").hidden = idx === STOPS.length - 1;
    if (idx > 0) { $("prevStop").href = "#" + STOPS[idx - 1].id; $("prevStop").textContent = "Back to " + STOPS[idx - 1].stop; }
    if (idx < STOPS.length - 1) { $("nextStop").href = "#" + STOPS[idx + 1].id; $("nextStop").textContent = "Next stop: " + STOPS[idx + 1].stop; }
    if (!started.has(id)) { started.add(id); labs[id].init(); }
    requestAnimationFrame(() => plots.forEach(p => p.canvas.closest("section:not([hidden])") && p.resize()));
    $("stop-" + id)?.scrollIntoView({ block: "nearest", inline: "center", behavior: reducedMotion() ? "auto" : "smooth" });
  }
  function start() {
    buildRoute();
    const route = () => show(location.hash.slice(1));
    window.addEventListener("hashchange", () => { route(); document.querySelector("section.lab:not([hidden]) h2")?.focus({ preventScroll: true }); });
    route();
    const btn = $("themeToggle");
    const isDark = () => document.documentElement.dataset.theme === "dark";
    const label = () => { if (!btn) return; const next = isDark() ? "light" : "dark"; btn.textContent = next === "dark" ? "Dark theme" : "Light theme"; btn.setAttribute("aria-label", "Switch to " + next + " theme"); };
    btn?.addEventListener("click", () => {
      const next = isDark() ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch (e) {}
      label(); plots.forEach(p => p.draw());
    });
    label();
  }

  /* ---------- Python (Pyodide runs python/labs.py in the browser) ---------- */
  const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
  let pyReady = null;
  function loadScript(src) {
    return new Promise((ok, fail) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => fail(new Error("could not load Pyodide")); document.head.appendChild(s); });
  }
  function getPython(status) {
    if (!pyReady) pyReady = (async () => {
      status("Loading Python (the first time takes about 10 seconds)…");
      const src = await fetch("python/labs.py").then(r => { if (!r.ok) throw new Error("python/labs.py not found"); return r.text(); });
      await loadScript(PYODIDE_URL);
      const py = await loadPyodide();
      await py.loadPackage("numpy");
      py.FS.writeFile("labs.py", src);
      await py.runPythonAsync("import labs, json");
      return py;
    })().catch(err => { pyReady = null; throw err; });
    return pyReady;
  }
  const r4 = v => +(+v).toFixed(4);
  const lit = v => Array.isArray(v) ? "[" + v.map(lit).join(", ") + "]"
    : typeof v === "string" ? JSON.stringify(v)
    : typeof v === "boolean" ? (v ? "True" : "False")
    : v === null ? "None"
    : typeof v === "object" ? "{" + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ": " + lit(x)).join(", ") + "}"
    : String(r4(v));
  const short = (arr, keep = 3) => arr.length <= keep * 2 ? lit(arr) : "[" + arr.slice(0, keep).map(lit).join(", ") + ", ...]  # " + arr.length + " items";
  function highlight(code) {
    return code.replace(/[&<>]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch])
      .replace(/(#.*)$/gm, '<span class="cm">$1</span>')
      .replace(/\b(import|from|print|for|in)\b/g, '<span class="kw">$1</span>')
      .replace(/labs\.(\w+)/g, 'labs.<span class="fn">$1</span>');
  }
  function pyBox(id, build) {
    const btn = $(id + "Py"), st = $(id + "PyStatus"), codeEl = $(id + "PyCode"), outEl = $(id + "PyOut");
    const status = (msg, cls = "") => { st.textContent = msg; st.className = "pystatus " + cls; };
    btn.addEventListener("click", async () => {
      const job = build();
      if (job.error) { status(job.error, "err"); return; }
      btn.disabled = true;
      try {
        const py = await getPython(status);
        status("Running Python…");
        const result = JSON.parse(await py.runPythonAsync(job.run + "\njson.dumps(result)"));
        codeEl.innerHTML = highlight(job.show || job.run); codeEl.hidden = false;
        outEl.textContent = job.format(result); outEl.hidden = false;
        const v = job.compare(result); status(v.msg, v.ok ? "ok" : "");
      } catch (err) {
        status(location.protocol === "file:"
          ? "Python needs the page served over the web. In this folder run: python -m http.server, then open http://localhost:8000"
          : "Python could not start: " + err.message + ". Check your internet connection and try again.", "err");
      } finally { btn.disabled = false; }
    });
  }

  /* ---------- real CTA data (made by scripts/fetch_cta_data.py) ---------- */
  let ctaPromise = null;
  function loadCTA() {
    if (!ctaPromise) ctaPromise = fetch("data/cta.json").then(r => (r.ok ? r.json() : null)).catch(() => null);
    return ctaPromise;
  }
  const LINE_COLORS = { Blue: "#00A1DE", Red: "#C60C30", Orange: "#F9461C", Brown: "#62361B", Green: "#009B3A", Purple: "#522398", Pink: "#E27EA6", Yellow: "#F9E300" };

  return { loadCTA, LINE_COLORS, $, css, fmt, rand, clamp, gauss, range, mean, sd, quantile, normCdf, niceStep, withAlpha, reducedMotion,
    makePlot, drawGrid, clipPlot, dot, emptyText, canvasPos, register, start, STOPS, pyBox, lit, short, r4 };
})();
