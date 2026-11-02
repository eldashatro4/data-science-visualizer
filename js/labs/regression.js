/* Stop 4, Western: least squares, residuals, and gradient descent */
DSV.register("regression", { init() {
  const { $, css, fmt, rand, gauss, clamp } = DSV;
  let pts = [], showSquares = false, guessOn = false, drag = null, real = null, X1 = 10, Y1 = 10;
  const cx = v => clamp(v, 0, X1), cy = v => clamp(v, 0, Y1);
  const guess = { y1: 3, y9: 7 };
  const gd = { on: false, a: 0, b: 0, steps: 0, timer: null, diverged: false };

  function fit() {
    const n = pts.length; if (n < 2) return null;
    const mx = pts.reduce((s, p) => s + p.x, 0) / n, my = pts.reduce((s, p) => s + p.y, 0) / n;
    let sxx = 0, sxy = 0, syy = 0;
    for (const p of pts) { sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.y - my); syy += (p.y - my) ** 2; }
    if (sxx < 1e-9) return null;
    const b = sxy / sxx, a = my - b * mx, sse = pts.reduce((s, p) => s + (p.y - (a + b * p.x)) ** 2, 0);
    return { a, b, mse: sse / n, r2: syy > 0 ? 1 - sse / syy : 1, r: syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0 };
  }
  const mseOf = (a, b) => pts.reduce((s, p) => s + (a + b * p.x - p.y) ** 2, 0) / pts.length;
  const gx1 = () => 0.1 * X1, gx9 = () => 0.9 * X1;
  const guessAB = () => { const b = (guess.y9 - guess.y1) / (gx9() - gx1()); return { a: guess.y1 - b * gx1(), b }; };

  function gdStep() {
    const n = pts.length; let ga = 0, gb = 0;
    for (const p of pts) { const err = gd.a + gd.b * p.x - p.y; ga += err; gb += err * p.x; }
    const lr = +$("rLR").value;
    gd.a -= lr * 2 * ga / n; gd.b -= lr * 2 * gb / n; gd.steps++;
    if (!Number.isFinite(gd.a) || mseOf(gd.a, gd.b) > 1e8) gd.diverged = true;
  }
  function gdStop() { clearInterval(gd.timer); gd.timer = null; $("rGD").textContent = gd.on ? "Keep descending" : "Fit by gradient descent"; }
  function gdRun() {
    if (gd.timer) return gdStop();
    if (pts.length < 2) return;
    if (!gd.on || gd.diverged) { gd.on = true; gd.a = 0; gd.b = 0; gd.steps = 0; gd.diverged = false; }
    $("rGD").textContent = "Pause";
    const tick = () => {
      const f = fit();
      for (let i = 0; i < 5 && !gd.diverged; i++) gdStep();
      draw();
      if (gd.diverged || gd.steps >= 3000 || (f && Math.abs(mseOf(gd.a, gd.b) - f.mse) < 1e-5)) gdStop();
    };
    if (DSV.reducedMotion()) { while (!gd.diverged && gd.steps < 3000) gdStep(); draw(); gdStop(); } else gd.timer = setInterval(tick, 40);
  }
  function gdReset() { gdStop(); gd.on = false; gd.steps = 0; gd.diverged = false; $("rGD").textContent = "Fit by gradient descent"; }

  const plot = DSV.makePlot($("regressionCanvas"), 4 / 3, draw);
  function lineAt(a, b, color, width, dash = []) {
    const p = plot, c = p.ctx; DSV.clipPlot(p);
    c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash);
    c.beginPath(); c.moveTo(p.sx(0), p.sy(a)); c.lineTo(p.sx(X1), p.sy(a + X1 * b)); c.stroke(); c.restore();
  }
  function draw() {
    const p = plot, c = p.ctx; p.x1 = X1; p.y1 = Y1; DSV.drawGrid(p, DSV.range(0, X1, DSV.niceStep(X1 / 10)), DSV.range(0, Y1, DSV.niceStep(Y1 / 10)));
    const f = fit();
    if (f) {
      for (const q of pts) {
        const yh = f.a + f.b * q.x;
        if (showSquares) {
          const side = Math.abs(p.sy(q.y) - p.sy(yh)), left = p.sx(q.x) + ((f.b >= 0) === (q.y > yh) ? -side : 0);
          c.fillStyle = DSV.withAlpha(css("--line"), 0.13); c.strokeStyle = DSV.withAlpha(css("--line"), 0.4);
          c.fillRect(left, Math.min(p.sy(q.y), p.sy(yh)), side, side); c.strokeRect(left, Math.min(p.sy(q.y), p.sy(yh)), side, side);
        }
        c.strokeStyle = css("--bad"); c.lineWidth = 1.5; c.setLineDash([3, 3]);
        c.beginPath(); c.moveTo(p.sx(q.x), p.sy(q.y)); c.lineTo(p.sx(q.x), p.sy(yh)); c.stroke(); c.setLineDash([]);
      }
      lineAt(f.a, f.b, css("--line"), 3);
    }
    if (gd.on && !gd.diverged) lineAt(gd.a, gd.b, css("--accent"), 3, [10, 5]);
    if (guessOn) {
      const g = guessAB(); lineAt(g.a, g.b, css("--guess"), 3, [3, 5]);
      for (const [x, y] of [[gx1(), guess.y1], [gx9(), guess.y9]]) { c.lineWidth = 3; DSV.dot(c, p.sx(x), p.sy(y), 9, css("--sheet"), css("--guess")); }
    }
    for (const q of pts) DSV.dot(c, p.sx(q.x), p.sy(q.y), 6, css("--ink"), css("--sheet"));
    if (!pts.length) DSV.emptyText(p, "Click anywhere to add your first point");
    readout(f);
  }
  function readout(f) {
    $("rN").textContent = pts.length;
    $("rEq").textContent = f ? `ŷ = ${fmt(f.a)} ${f.b < 0 ? "−" : "+"} ${fmt(Math.abs(f.b))}x` : "ŷ = –";
    $("rR2").textContent = f ? fmt(f.r2) : "–"; $("rMSE").textContent = f ? fmt(f.mse) : "–"; $("rR").textContent = f ? fmt(f.r) : "–";
    $("rGuessBox").hidden = !guessOn; $("rGuessLegend").hidden = !guessOn;
    if (guessOn && f) { const g = guessAB(), m = mseOf(g.a, g.b), ratio = m / f.mse; $("rGuessMSE").textContent = `${fmt(m)} vs ${fmt(f.mse)}` + (ratio < 1.02 ? " (nearly perfect!)" : ` (${fmt(ratio, 1)}× larger)`); }
    $("rGDBox").hidden = !gd.on; $("rGDLegend").hidden = !gd.on;
    if (gd.on) $("rGDState").textContent = gd.diverged ? `Diverged after ${gd.steps} steps: the learning rate is too big` : `step ${gd.steps}: MSE ${fmt(mseOf(gd.a, gd.b), 3)}`;
  }
  const nearest = pos => { let best = -1, bd = 14 * 14; pts.forEach((q, i) => { const d = (plot.sx(q.x) - pos.x) ** 2 + (plot.sy(q.y) - pos.y) ** 2; if (d < bd) { bd = d; best = i; } }); return best; };
  const cv = plot.canvas;
  cv.addEventListener("pointerdown", e => {
    const pos = DSV.canvasPos(e, cv);
    if (guessOn) for (const [x, key] of [[gx1(), "y1"], [gx9(), "y9"]]) if ((plot.sx(x) - pos.x) ** 2 + (plot.sy(guess[key]) - pos.y) ** 2 < 18 * 18) { drag = { guess: key }; cv.setPointerCapture(e.pointerId); return; }
    const i = nearest(pos);
    if (i >= 0) drag = { i };
    else if (plot.inside(pos)) { pts.push({ x: cx(plot.ix(pos.x)), y: cy(plot.iy(pos.y)) }); drag = { i: pts.length - 1 }; gdReset(); }
    else return;
    cv.setPointerCapture(e.pointerId); draw();
  });
  cv.addEventListener("pointermove", e => {
    const pos = DSV.canvasPos(e, cv);
    if (!drag) { const i = nearest(pos); cv.style.cursor = i >= 0 ? "grab" : "crosshair";
      $("rHover").textContent = i >= 0 && pts[i].name ? `${pts[i].name}: ${pts[i].x.toFixed(2)}k vs ${pts[i].y.toFixed(2)}k riders a day` : "Click to add a point. Drag to move it. Double-click to remove it."; return; }
    if (drag.guess) guess[drag.guess] = cy(plot.iy(pos.y)); else { pts[drag.i] = { x: cx(plot.ix(pos.x)), y: cy(plot.iy(pos.y)) }; gdReset(); }
    draw();
  });
  cv.addEventListener("pointerup", () => { drag = null; });
  cv.addEventListener("dblclick", e => { const i = nearest(DSV.canvasPos(e, cv)); if (i >= 0) { pts.splice(i, 1); gdReset(); draw(); } });
  function randomData() { X1 = 10; Y1 = 10; guess.y1 = 3; guess.y9 = 7; $("rSource").value = "practice"; setLabels();
    const s = rand(-0.8, 0.8), m = rand(4, 6); pts = Array.from({ length: 18 }, () => { const x = rand(0.7, 9.3); return { x, y: cy(m + s * (x - 5) + gauss() * 0.9) }; }); gdReset(); draw(); }
  function realData() {
    const [xk, yk] = $("rSource").value.split("-").slice(1);
    pts = real.stations.map(s => ({ x: s[xk], y: s[yk], name: s.name }));
    X1 = Math.ceil(Math.max(...pts.map(p => p.x)) * 1.08); Y1 = Math.ceil(Math.max(...pts.map(p => p.y)) * 1.08);
    guess.y1 = 0.3 * Y1; guess.y9 = 0.7 * Y1; setLabels(xk, yk); gdReset(); draw();
  }
  function setLabels(xk, yk) {
    $("rAxes").textContent = xk ? `Each dot is one 'L' station in ${real.year}: x = average ${xk} riders per day, y = average ${yk} riders per day (thousands).` : "Practice data: random points.";
  }
  $("rRandom").onclick = randomData;
  $("rOutlier").onclick = () => { const f = fit(), x = rand(0.75, 0.95) * X1, yh = f ? f.a + f.b * x : Y1 / 2; pts.push({ x, y: yh > Y1 / 2 ? rand(0.03, 0.15) * Y1 : rand(0.85, 0.97) * Y1 }); gdReset(); draw(); };
  $("rClear").onclick = () => { pts = []; gdReset(); draw(); };
  $("rSquares").onclick = e => { showSquares = !showSquares; e.currentTarget.setAttribute("aria-pressed", showSquares); draw(); };
  $("rGuess").onclick = e => { guessOn = !guessOn; e.currentTarget.setAttribute("aria-pressed", guessOn); draw(); };
  $("rGD").onclick = gdRun;
  $("rLR").onchange = () => { gdReset(); draw(); };
  $("rSource").onchange = () => ($("rSource").value === "practice" || !real ? randomData() : realData());
  randomData();
  DSV.loadCTA().then(d => {
    real = d;
    $("rSource").querySelectorAll('option[value^="real"]').forEach(o => { if (d) o.textContent = o.textContent.replace("YEAR", d.year); else { o.disabled = true; o.textContent = o.textContent.replace("YEAR", "data") + " (run scripts/fetch_cta_data.py)"; } });
    if (d) { $("rSource").value = "real-saturday-weekday"; realData(); }
  });

  DSV.pyBox("regression", () => {
    if (!fit()) return { error: "Add at least 2 points with different x values first." };
    if (gd.timer) gdStop();                  // freeze gradient descent so Python checks the same step
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y), lr = +$("rLR").value;
    const useGD = gd.on && !gd.diverged && gd.steps > 0, snap = { a: gd.a, b: gd.b };
    const call = useGD ? `labs.gradient_descent(x, y, learning_rate=${lr}, steps=${gd.steps})` : "labs.fit_line(x, y)";
    const body = (x, y) => `import labs\n\nx = ${x}\ny = ${y}\nresult = ${call}\nprint(result["intercept"], result["slope"])`;
    return {
      run: body(DSV.lit(xs), DSV.lit(ys)) + (useGD ? '\nresult.pop("path")' : ""), show: body(DSV.short(xs), DSV.short(ys)),
      format: r => `intercept  ${r.intercept.toFixed(4)}\nslope      ${r.slope.toFixed(4)}\nMSE        ${r.mse.toFixed(4)}` + (r.r2 !== undefined ? `\nR²         ${r.r2.toFixed(4)}\nr          ${r.r.toFixed(4)}` : ""),
      compare: r => {
        const ref = useGD ? snap : fit();
        const ok = Math.abs(r.slope - ref.b) < 2e-3 && Math.abs(r.intercept - ref.a) < 2e-3;
        const what = useGD ? `gradient descent after ${gd.steps} steps` : "least squares";
        return { ok, msg: ok ? `✓ Python matches the plot (${what}): same slope and intercept.` : "Python and the plot differ slightly (the data was rounded to 4 decimals)." };
      },
    };
  });
} });
