/* Stop 6, Ashland: classification with k-nearest neighbours, train/test split, confusion matrix */
DSV.register("knn", { init() {
  const { $, css, fmt, rand, gauss, clamp } = DSV;
  let train = [], test = [], addClass = 1, drag = -1;
  const shade = document.createElement("canvas");
  const color = lab => css(lab ? "--bad" : "--good");

  function predictOne(q, k) {
    const order = train.map((p, i) => ({ i, d: (p.x - q.x) ** 2 + (p.y - q.y) ** 2 })).sort((a, b) => a.d - b.d).slice(0, k);
    const votes = {}; order.forEach(o => { const l = train[o.i].label; votes[l] = (votes[l] || 0) + 1; });
    const best = Math.max(...Object.values(votes)), tied = Object.keys(votes).filter(l => votes[l] === best).map(Number);
    return tied.length === 1 ? tied[0] : train[order.find(o => tied.includes(train[o.i].label)).i].label;
  }
  function evaluate() {
    const k = +$("kK").value, preds = test.map(q => predictOne(q, k));
    const cm = { tp: 0, fp: 0, fn: 0, tn: 0 };
    test.forEach((q, i) => { const p = preds[i]; if (q.label === 1 && p === 1) cm.tp++; else if (q.label === 0 && p === 1) cm.fp++; else if (q.label === 1) cm.fn++; else cm.tn++; });
    return { preds, cm, acc: test.length ? (cm.tp + cm.tn) / test.length : NaN,
      prec: cm.tp + cm.fp ? cm.tp / (cm.tp + cm.fp) : 0, rec: cm.tp + cm.fn ? cm.tp / (cm.tp + cm.fn) : 0 };
  }
  function newData() {
    const spread = +$("kSpread").value, all = [];
    for (let i = 0; i < 70; i++) { const label = i % 2, cx = label ? 6.6 : 3.4, cy = label ? 6.2 : 3.8;
      all.push({ x: clamp(cx + gauss() * spread), y: clamp(cy + gauss() * spread), label }); }
    all.sort(() => Math.random() - 0.5); train = all.slice(0, 50); test = all.slice(50); draw();
  }
  const plot = DSV.makePlot($("knnCanvas"), 4 / 3, draw);
  function draw() {
    const p = plot, c = p.ctx, k = +$("kK").value;
    DSV.drawGrid(p, DSV.range(0, 10), DSV.range(0, 10));
    if ($("kBoundary").checked && train.length >= k) {
      const cw = 90, ch = Math.round(cw * (p.h - p.pad.t - p.pad.b) / (p.w - p.pad.l - p.pad.r));
      shade.width = cw; shade.height = ch; const sc = shade.getContext("2d"), img = sc.createImageData(cw, ch);
      const rgb = [0, 1].map(l => { const s = color(l).replace("#", ""); return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)); });
      for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) {
        const lab = predictOne({ x: (xx + 0.5) / cw * 10, y: 10 - (yy + 0.5) / ch * 10 }, k), o = (yy * cw + xx) * 4;
        [img.data[o], img.data[o + 1], img.data[o + 2]] = rgb[lab]; img.data[o + 3] = 40;
      }
      sc.putImageData(img, 0, 0); c.imageSmoothingEnabled = false;
      c.drawImage(shade, p.pad.l, p.pad.t, p.w - p.pad.l - p.pad.r, p.h - p.pad.t - p.pad.b);
    }
    const ev = evaluate();
    train.forEach(q => DSV.dot(c, p.sx(q.x), p.sy(q.y), 6, color(q.label), css("--sheet")));
    test.forEach((q, i) => { c.lineWidth = 3; DSV.dot(c, p.sx(q.x), p.sy(q.y), 7, css("--sheet"), color(q.label));
      if (ev.preds[i] !== q.label) { c.strokeStyle = css("--ink"); c.lineWidth = 2; const X = p.sx(q.x), Y = p.sy(q.y); c.beginPath(); c.moveTo(X - 4, Y - 4); c.lineTo(X + 4, Y + 4); c.moveTo(X + 4, Y - 4); c.lineTo(X - 4, Y + 4); c.stroke(); } });
    $("kAcc").textContent = test.length ? fmt(ev.acc * 100, 0) + "%" : "–";
    $("kPrec").textContent = fmt(ev.prec * 100, 0) + "%"; $("kRec").textContent = fmt(ev.rec * 100, 0) + "%";
    $("kTP").textContent = ev.cm.tp; $("kFN").textContent = ev.cm.fn; $("kFP").textContent = ev.cm.fp; $("kTN").textContent = ev.cm.tn;
  }
  const nearest = pos => { let best = -1, bd = 12 * 12; train.forEach((q, i) => { const d = (plot.sx(q.x) - pos.x) ** 2 + (plot.sy(q.y) - pos.y) ** 2; if (d < bd) { bd = d; best = i; } }); return best; };
  const cv = plot.canvas;
  cv.addEventListener("pointerdown", e => {
    const pos = DSV.canvasPos(e, cv), i = nearest(pos);
    if (i >= 0) drag = i; else if (plot.inside(pos)) { train.push({ x: clamp(plot.ix(pos.x)), y: clamp(plot.iy(pos.y)), label: addClass }); drag = train.length - 1; } else return;
    cv.setPointerCapture(e.pointerId); draw();
  });
  cv.addEventListener("pointermove", e => { const pos = DSV.canvasPos(e, cv); if (drag < 0) { cv.style.cursor = nearest(pos) >= 0 ? "grab" : "crosshair"; return; }
    train[drag] = { ...train[drag], x: clamp(plot.ix(pos.x)), y: clamp(plot.iy(pos.y)) }; draw(); });
  cv.addEventListener("pointerup", () => { drag = -1; });
  cv.addEventListener("dblclick", e => { const i = nearest(DSV.canvasPos(e, cv)); if (i >= 0) { train.splice(i, 1); draw(); } });
  $("kK").oninput = e => { $("kKOut").textContent = e.target.value; draw(); };
  $("kSpread").oninput = e => { $("kSpreadOut").textContent = (+e.target.value).toFixed(1); newData(); };
  $("kBoundary").onchange = draw;
  $("kNew").onclick = newData;
  document.querySelectorAll('input[name="kClass"]').forEach(r => r.onchange = () => { addClass = +r.value; });
  newData();

  DSV.pyBox("knn", () => {
    if (!test.length || train.length < +$("kK").value) return { error: "Need more training points than k." };
    const k = +$("kK").value;
    const tp = train.map(p => [p.x, p.y]), tl = train.map(p => p.label), qp = test.map(p => [p.x, p.y]), ql = test.map(p => p.label);
    const body = (a, b, c2, d) => `import labs\n\ntrain_points = ${a}\ntrain_labels = ${b}\ntest_points = ${c2}\ntest_labels = ${d}\npredictions = labs.knn_predict(train_points, train_labels, test_points, k=${k})\nresult = labs.classification_report(test_labels, predictions)\nresult["predictions"] = predictions\nprint(result["accuracy"], result["confusion"])`;
    return {
      run: body(...[tp, tl, qp, ql].map(DSV.lit)), show: body(DSV.short(tp, 2), DSV.short(tl, 4), DSV.short(qp, 2), DSV.short(ql, 4)),
      format: r => `accuracy    ${(r.accuracy * 100).toFixed(1)}%\nprecision   ${(r.precision * 100).toFixed(1)}%\nrecall      ${(r.recall * 100).toFixed(1)}%\nconfusion   TP ${r.confusion.tp}  FP ${r.confusion.fp}  FN ${r.confusion.fn}  TN ${r.confusion.tn}`,
      compare: r => { const ev = evaluate(); const same = r.predictions.every((v, i) => v === ev.preds[i]);
        return { ok: same, msg: same ? `✓ Python matches the plot: same ${test.length} predictions and accuracy.` : "Some predictions differ (points were rounded to 4 decimals, which can flip near-ties)." }; },
    };
  });
} });
