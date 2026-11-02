/* Stop 5, 35th/Archer: model complexity, overfitting, and the train/test split */
DSV.register("overfit", { init() {
  const { $, css, fmt, rand, gauss, clamp } = DSV;
  let train = [], test = [];
  const truth = x => 5 + 2.6 * Math.sin(0.75 * x) + 0.12 * x;
  const scale = x => (x - 5) / 5;          // same scaling as labs.py keeps high-degree fits stable

  function solve(A, b) {                   // Gaussian elimination with partial pivoting
    const n = b.length, M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let piv = col; for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      [M[col], M[piv]] = [M[piv], M[col]];
      for (let r = col + 1; r < n; r++) { const f = M[r][col] / M[col][col]; for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k]; }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
    return x;
  }
  function polyfit(points, deg) {          // least squares via the normal equations; coefficients lowest power first
    const m = deg + 1, A = Array.from({ length: m }, () => new Array(m).fill(0)), b = new Array(m).fill(0);
    for (const p of points) { const t = scale(p.x), pw = [1]; for (let k = 1; k < 2 * m; k++) pw.push(pw[k - 1] * t);
      for (let i = 0; i < m; i++) { b[i] += pw[i] * p.y; for (let j = 0; j < m; j++) A[i][j] += pw[i + j]; } }
    return solve(A, b);
  }
  const predict = (coef, x) => { const t = scale(x); let y = 0; for (let k = coef.length - 1; k >= 0; k--) y = y * t + coef[k]; return y; };
  const mse = (coef, pts) => pts.reduce((s, p) => s + (predict(coef, p.x) - p.y) ** 2, 0) / pts.length;
  const maxDeg = () => Math.min(12, train.length - 1);
  function curve() { return DSV.range(0, maxDeg()).map(d => { const c = polyfit(train, d); return { d, tr: mse(c, train), te: mse(c, test) }; }); }

  function newData() {
    const n = +$("oN").value, noise = +$("oNoise").value; const all = [];
    for (let i = 0; i < n; i++) { const x = rand(0.3, 9.7); all.push({ x, y: clamp(truth(x) + gauss() * noise, -2, 12) }); }
    all.sort(() => Math.random() - 0.5);
    const cut = Math.round(n * 0.7); train = all.slice(0, cut); test = all.slice(cut);
    $("oDeg").max = maxDeg(); if (+$("oDeg").value > maxDeg()) { $("oDeg").value = maxDeg(); $("oDegOut").textContent = maxDeg(); }
    draw();
  }
  const plot = DSV.makePlot($("overfitCanvas"), 4 / 3, draw);
  plot.y0 = -2; plot.y1 = 12;
  const err = DSV.makePlot($("overfitErr"), 2.2, drawErr, { minH: 190, pad: { l: 46, r: 14, t: 12, b: 42 } });
  function draw() {
    const p = plot, c = p.ctx, deg = +$("oDeg").value;
    DSV.drawGrid(p, DSV.range(0, 10), DSV.range(-2, 12, 2));
    DSV.clipPlot(p);
    if ($("oTruth").checked) { c.strokeStyle = css("--ink-soft"); c.lineWidth = 2; c.setLineDash([2, 5]); c.beginPath(); for (let i = 0; i <= 200; i++) { const x = i / 20; i ? c.lineTo(p.sx(x), p.sy(truth(x))) : c.moveTo(p.sx(x), p.sy(truth(x))); } c.stroke(); c.setLineDash([]); }
    if (train.length > deg) {
      const coef = polyfit(train, deg); c.strokeStyle = css("--line"); c.lineWidth = 3; c.beginPath();
      for (let i = 0; i <= 400; i++) { const x = i / 40, y = predict(coef, x); i ? c.lineTo(p.sx(x), p.sy(y)) : c.moveTo(p.sx(x), p.sy(y)); } c.stroke();
      const cur = { tr: mse(coef, train), te: mse(coef, test) };
      $("oTrain").textContent = fmt(cur.tr, 3); $("oTest").textContent = fmt(cur.te, 3);
      $("oVerdict").textContent = deg <= 1 ? "Underfitting: too simple to follow the curve." : cur.te > 1.6 * cur.tr && deg >= 6 ? "Overfitting: great on training points, worse on new ones." : "A reasonable fit.";
    }
    c.restore();
    train.forEach(q => DSV.dot(c, p.sx(q.x), p.sy(q.y), 6, css("--ink"), css("--sheet")));
    test.forEach(q => { c.lineWidth = 2.5; DSV.dot(c, p.sx(q.x), p.sy(q.y), 6, css("--sheet"), css("--accent")); });
    $("oFormula").textContent = `degree ${deg}: ${deg + 1} coefficient${deg ? "s" : ""}`;
    err.draw();
  }
  function drawErr() {
    const p = err, c = p.ctx; if (!train.length) return;
    const cv = curve(), deg = +$("oDeg").value, top = Math.min(Math.max(...cv.map(r => r.te)), Math.max(4, cv[0].te * 2.5));
    p.x0 = 0; p.x1 = maxDeg(); p.y0 = 0; p.y1 = top * 1.08;
    DSV.drawGrid(p, DSV.range(0, maxDeg(), maxDeg() > 8 ? 2 : 1), DSV.range(0, p.y1, DSV.niceStep(p.y1 / 3)), v => v, v => +v.toFixed(2));
    DSV.clipPlot(p);
    const line = (key, color, dash) => { c.strokeStyle = color; c.lineWidth = 2.5; c.setLineDash(dash); c.beginPath(); cv.forEach((r, i) => { const y = p.sy(Math.min(r[key], p.y1 * 2)); i ? c.lineTo(p.sx(r.d), y) : c.moveTo(p.sx(r.d), y); }); c.stroke(); c.setLineDash([]); };
    line("tr", css("--ink"), []); line("te", css("--accent"), [6, 4]);
    c.restore();
    c.strokeStyle = css("--line"); c.lineWidth = 2; c.beginPath(); c.moveTo(p.sx(deg), p.pad.t); c.lineTo(p.sx(deg), p.h - p.pad.b); c.stroke();
    c.fillStyle = css("--ink-soft"); c.font = "12px " + css("--body"); c.textAlign = "center"; c.fillText("polynomial degree", (p.pad.l + p.w - p.pad.r) / 2, p.h - 4);
  }
  $("oDeg").oninput = e => { $("oDegOut").textContent = e.target.value; draw(); };
  $("oN").oninput = e => { $("oNOut").textContent = e.target.value; newData(); };
  $("oNoise").oninput = e => { $("oNoiseOut").textContent = (+e.target.value).toFixed(1); newData(); };
  $("oTruth").onchange = draw;
  $("oNew").onclick = newData;
  newData();

  DSV.pyBox("overfit", () => {
    const deg = +$("oDeg").value;
    const [xtr, ytr, xte, yte] = [train.map(p => p.x), train.map(p => p.y), test.map(p => p.x), test.map(p => p.y)];
    const body = (a, b, c2, d) => `import labs\n\nx_train = ${a}\ny_train = ${b}\nx_test = ${c2}\ny_test = ${d}\nresult = labs.poly_fit(x_train, y_train, x_test, y_test, degree=${deg})\nprint(result["train_mse"], result["test_mse"])`;
    return {
      run: body(...[xtr, ytr, xte, yte].map(DSV.lit)), show: body(...[xtr, ytr, xte, yte].map(v => DSV.short(v, 2))),
      format: r => `degree      ${r.degree}\ntrain MSE   ${r.train_mse.toFixed(4)}\ntest MSE    ${r.test_mse.toFixed(4)}`,
      compare: r => {
        const coef = polyfit(train, deg), tr = mse(coef, train), te = mse(coef, test);
        const close = (a, b) => Math.abs(a - b) <= 1e-3 + 2e-3 * Math.abs(b);
        const ok = close(r.train_mse, tr) && close(r.test_mse, te);
        return { ok, msg: ok ? "✓ Python (np.polyfit) matches the plot: same train and test error." : "Python and the plot differ slightly (very high degrees are numerically sensitive)." };
      },
    };
  });
} });
