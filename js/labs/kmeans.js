/* Stop 7, Halsted: k-means clustering, step by step */
DSV.register("kmeans", { init() {
  const { $, css, fmt, rand, gauss, clamp } = DSV;
  let kp = [], cents = [], start = [], assign = [], phase = "assign", iter = 0, hist = [], converged = false, timer = null;
  const colors = () => [1, 2, 3, 4, 5, 6, 7, 8].map(i => css("--c" + i));
  const shade = document.createElement("canvas");
  const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const plot = DSV.makePlot($("kmeansCanvas"), 4 / 3, draw);

  function newData() {
    kp = []; const blobs = 3 + Math.floor(Math.random() * 3);
    for (let b = 0; b < blobs; b++) { const cx = rand(1.5, 8.5), cy = rand(1.5, 8.5), s = rand(0.45, 0.8), n = 25 + Math.floor(Math.random() * 20);
      for (let i = 0; i < n; i++) kp.push({ x: clamp(cx + gauss() * s), y: clamp(cy + gauss() * s) }); }
    reset();
  }
  function initCentroids() {
    const k = +$("kmK").value; if (!kp.length) return [];
    if ($("kmInit").value === "rand") return [...kp.keys()].sort(() => Math.random() - 0.5).slice(0, k).map(i => ({ ...kp[i] }));
    const c = [{ ...kp[Math.floor(Math.random() * kp.length)] }];
    while (c.length < k) { const w = kp.map(p => Math.min(...c.map(q => d2(p, q)))), tot = w.reduce((a, b) => a + b, 0);
      let r = Math.random() * tot, j = 0; while (r > w[j] && j < w.length - 1) r -= w[j++]; c.push({ ...kp[j] }); }
    return c;
  }
  const inertia = () => kp.reduce((s, p, i) => s + (assign[i] >= 0 ? d2(p, cents[assign[i]]) : 0), 0);
  function reset() { stop(); cents = initCentroids(); start = cents.map(c => ({ ...c })); assign = kp.map(() => -1); phase = "assign"; iter = 0; hist = []; converged = false; draw(); }
  function step() {
    if (converged || !kp.length) return false;
    if (phase === "assign") {
      let changed = 0;
      kp.forEach((p, i) => { let best = 0, bd = Infinity; cents.forEach((c, j) => { const d = d2(p, c); if (d < bd) { bd = d; best = j; } }); if (assign[i] !== best) changed++; assign[i] = best; });
      if (changed === 0 && iter > 0) converged = true; else { iter++; hist.push(inertia()); phase = "move"; }
    } else {
      cents = cents.map((c, j) => { const mine = kp.filter((_, i) => assign[i] === j);
        return mine.length ? { x: mine.reduce((s, p) => s + p.x, 0) / mine.length, y: mine.reduce((s, p) => s + p.y, 0) / mine.length } : { ...kp[Math.floor(Math.random() * kp.length)] }; });
      hist[hist.length - 1] = inertia(); phase = "assign";
    }
    draw(); return !converged;
  }
  function stop() { clearInterval(timer); timer = null; $("kmRun").textContent = "Run to the end"; }
  function draw() {
    const p = plot, c = p.ctx, col = colors(); DSV.drawGrid(p, DSV.range(0, 10), DSV.range(0, 10));
    if (cents.length) {
      const cw = 110, ch = Math.round(cw * (p.h - p.pad.t - p.pad.b) / (p.w - p.pad.l - p.pad.r));
      shade.width = cw; shade.height = ch; const sc = shade.getContext("2d"), img = sc.createImageData(cw, ch);
      const rgb = col.map(h => { const s = h.replace("#", ""); return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)); });
      for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) {
        const pt = { x: (xx + 0.5) / cw * 10, y: 10 - (yy + 0.5) / ch * 10 }; let best = 0, bd = Infinity;
        cents.forEach((q, j) => { const d = d2(pt, q); if (d < bd) { bd = d; best = j; } });
        const o = (yy * cw + xx) * 4; [img.data[o], img.data[o + 1], img.data[o + 2]] = rgb[best % 8]; img.data[o + 3] = 34;
      }
      sc.putImageData(img, 0, 0); c.imageSmoothingEnabled = false; c.drawImage(shade, p.pad.l, p.pad.t, p.w - p.pad.l - p.pad.r, p.h - p.pad.t - p.pad.b);
    }
    kp.forEach((q, i) => DSV.dot(c, p.sx(q.x), p.sy(q.y), 5, assign[i] >= 0 ? col[assign[i] % 8] : css("--axis")));
    cents.forEach((q, j) => { c.lineWidth = 4; c.strokeStyle = css("--sheet"); c.beginPath(); c.arc(p.sx(q.x), p.sy(q.y), 12, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 3; c.strokeStyle = col[j % 8]; c.stroke(); DSV.dot(c, p.sx(q.x), p.sy(q.y), 4, col[j % 8]); });
    $("kmIter").textContent = iter; $("kmPhase").textContent = converged ? "Done" : phase === "assign" ? "Assign points" : "Move centroids";
    $("kmInertia").textContent = assign.some(a => a >= 0) ? fmt(inertia(), 1) : "–";
    $("kmStep").disabled = converged; if (converged) stop();
    spark();
  }
  function spark() {
    const cv = $("kmSpark"), w = cv.clientWidth, h = 70, dpr = window.devicePixelRatio || 1; if (!w) return;
    cv.width = w * dpr; cv.height = h * dpr; const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    if (!hist.length) return;
    const mx = Math.max(...hist), mn = Math.min(...hist), n = Math.max(2, hist.length);
    const X = i => 12 + i / (n - 1) * (w - 24), Y = v => mx === mn ? h / 2 : 12 + (1 - (v - mn) / (mx - mn)) * (h - 24);
    c.strokeStyle = css("--line"); c.lineWidth = 2.5; c.beginPath(); hist.forEach((v, i) => i ? c.lineTo(X(i), Y(v)) : c.moveTo(X(i), Y(v))); c.stroke();
    hist.forEach((v, i) => DSV.dot(c, X(i), Y(v), 3, css("--line")));
  }
  plot.canvas.addEventListener("pointerdown", e => {
    const pos = DSV.canvasPos(e, plot.canvas); if (!plot.inside(pos)) return;
    kp.push({ x: clamp(plot.ix(pos.x)), y: clamp(plot.iy(pos.y)) }); assign.push(-1); if (converged) { converged = false; phase = "assign"; } draw();
  });
  $("kmStep").onclick = () => { stop(); step(); };
  $("kmRun").onclick = () => {
    if (timer) return stop(); if (converged) reset();
    if (DSV.reducedMotion()) { let g = 0; while (step() && g++ < 500); return; }
    $("kmRun").textContent = "Pause"; timer = setInterval(() => { if (!step()) stop(); }, 450);
  };
  $("kmReset").onclick = reset; $("kmData").onclick = newData;
  $("kmK").oninput = e => { $("kmKOut").textContent = e.target.value; reset(); };
  $("kmInit").onchange = reset;
  newData();

  DSV.pyBox("kmeans", () => {
    if (!kp.length || !start.length) return { error: "Add some points first." };
    const P = kp.map(p => [p.x, p.y]), S = start.map(c => [c.x, c.y]);
    const body = (pts, st) => `import labs\n\npoints = ${pts}\nstart = ${st}  # same starting centroids as the plot\nresult = labs.kmeans(points, k=${S.length}, init=start)\nprint(result["inertia"], result["iterations"])`;
    return {
      run: body(DSV.lit(P), DSV.lit(S)), show: body(DSV.short(P, 2), DSV.lit(S)),
      format: r => `iterations       ${r.iterations}\nsum of squares   ${r.inertia.toFixed(2)}\nby iteration     ${r.history.map(v => v.toFixed(1)).join(" → ")}`,
      compare: r => {
        if (!converged) return { ok: false, msg: `Python ran to the end in ${r.iterations} iterations. Press “Run to the end” on the plot, then check again to compare.` };
        const ok = Math.abs(r.inertia - inertia()) < 0.05 * Math.max(1, inertia() / 100);
        return { ok, msg: ok ? `✓ Python matches the plot: same final sum of squares (${r.inertia.toFixed(1)}).` : "Python ended at a different grouping (the data was rounded to 4 decimals)." };
      },
    };
  });
} });
