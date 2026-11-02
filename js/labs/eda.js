/* Stop 2, Pulaski: summary statistics, the box plot, and outliers */
DSV.register("eda", { init() {
  const { $, css, fmt, gauss, clamp, mean, sd, quantile, dot } = DSV;
  let vals = [], drag = -1, real = null, X1 = 60, unit = " min", varName = "minutes_late";
  const presets = {
    symmetric: () => Array.from({ length: 21 }, () => clamp(30 + gauss() * 7, 0, 60)),
    skewed: () => Array.from({ length: 21 }, () => clamp(12 + (-Math.log(1 - Math.random())) * 9, 0, 60)),
  };
  function stats() {
    if (!vals.length) return null;
    const s = [...vals].sort((a, b) => a - b), q1 = quantile(s, 0.25), q3 = quantile(s, 0.75), iqr = q3 - q1;
    return { s, q1, q3, iqr, med: quantile(s, 0.5), mean: mean(vals), sd: vals.length > 1 ? sd(vals) : 0,
      lo: q1 - 1.5 * iqr, hi: q3 + 1.5 * iqr, out: s.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr) };
  }
  const plot = DSV.makePlot($("edaCanvas"), 16 / 10, draw, { pad: { l: 20, r: 20, t: 20, b: 34 } });
  plot.x0 = 0; plot.x1 = X1;
  const radius = () => (vals.length > 60 ? 3.5 : 6);
  // dots stack in columns so ties stay visible
  function positions() {
    const byBin = {}, out = [], r = radius(), w = X1 / Math.max(30, Math.floor((plot.w - plot.pad.l - plot.pad.r) / (2 * r + 1)));
    vals.forEach((v, i) => { const b = Math.round(v / w); const k = (byBin[b] = (byBin[b] || 0) + 1); out[i] = { x: plot.sx(b * w), y: plot.h - plot.pad.b - r - 8 - (k - 1) * (2 * r + 1) }; });
    return out;
  }
  function draw() {
    const p = plot, c = p.ctx, st = stats();
    DSV.drawGrid(p, DSV.range(0, X1, DSV.niceStep(X1 / 6)), [], v => v + unit);
    const boxY = p.pad.t + 30, boxH = 44;
    if (st) {
      const X = p.sx;
      // SD band around the mean
      c.fillStyle = DSV.withAlpha(css("--accent"), 0.12);
      c.fillRect(X(st.mean - st.sd), p.pad.t, X(st.mean + st.sd) - X(st.mean - st.sd), p.h - p.pad.t - p.pad.b);
      // box plot
      const wLo = Math.min(...st.s.filter(v => v >= st.lo)), wHi = Math.max(...st.s.filter(v => v <= st.hi));
      c.strokeStyle = css("--ink"); c.lineWidth = 2;
      c.beginPath(); c.moveTo(X(wLo), boxY + boxH / 2); c.lineTo(X(st.q1), boxY + boxH / 2); c.moveTo(X(st.q3), boxY + boxH / 2); c.lineTo(X(wHi), boxY + boxH / 2);
      c.moveTo(X(wLo), boxY + 10); c.lineTo(X(wLo), boxY + boxH - 10); c.moveTo(X(wHi), boxY + 10); c.lineTo(X(wHi), boxY + boxH - 10); c.stroke();
      c.fillStyle = DSV.withAlpha(css("--line"), 0.15); c.fillRect(X(st.q1), boxY, X(st.q3) - X(st.q1), boxH); c.strokeRect(X(st.q1), boxY, X(st.q3) - X(st.q1), boxH);
      c.strokeStyle = css("--line"); c.lineWidth = 3; c.beginPath(); c.moveTo(X(st.med), boxY); c.lineTo(X(st.med), boxY + boxH); c.stroke();
      st.out.forEach(v => DSV.dot(c, X(v), boxY + boxH / 2, 4, null, css("--bad")));
      // mean and median markers through the dots
      const line = (x, color, dash, label, dy) => { c.strokeStyle = color; c.lineWidth = 2; c.setLineDash(dash); c.beginPath(); c.moveTo(X(x), boxY + boxH + 8); c.lineTo(X(x), p.h - p.pad.b); c.stroke(); c.setLineDash([]);
        c.fillStyle = color; c.font = "bold 12px " + css("--body"); c.textAlign = "center"; c.fillText(label, X(x), boxY + boxH + 22 + dy); };
      line(st.med, css("--line"), [], "median", 0);
      line(st.mean, css("--accent"), [6, 4], "mean", Math.abs(X(st.mean) - X(st.med)) < 44 ? 15 : 0);
    }
    const pos = positions();
    vals.forEach((v, i) => dot(c, pos[i].x, pos[i].y, radius(), st && st.out.includes(v) ? css("--bad") : css("--ink"), vals.length > 60 ? null : css("--sheet")));
    if (!vals.length) DSV.emptyText(p, "Click along the axis to add values");
    $("eMean").textContent = st ? fmt(st.mean, 1) : "–"; $("eMedian").textContent = st ? fmt(st.med, 1) : "–";
    $("eSD").textContent = st ? fmt(st.sd, 1) : "–"; $("eIQR").textContent = st ? fmt(st.iqr, 1) : "–";
    $("eN").textContent = vals.length;
    $("eOut").textContent = st && st.out.length ? (st.out.length > 6 ? st.out.length + " values, up to " + Math.max(...st.out).toFixed(1) + unit : st.out.map(v => v.toFixed(1)).join(", ")) : "none";
    $("eGap").textContent = st ? (st.mean > st.med + 0.02 * X1 ? "Mean is pulled right of the median: right-skewed" : st.mean < st.med - 0.02 * X1 ? "Mean is pulled left of the median: left-skewed" : "Mean and median agree: roughly symmetric") : "";
  }
  const nearest = pos => { const P = positions(); let best = -1, bd = 12 * 12; P.forEach((q, i) => { const d = (q.x - pos.x) ** 2 + (q.y - pos.y) ** 2; if (d < bd) { bd = d; best = i; } }); return best; };
  const cv = plot.canvas;
  cv.addEventListener("pointerdown", e => {
    const pos = DSV.canvasPos(e, cv), i = nearest(pos);
    if (i >= 0) drag = i; else if (pos.x >= plot.pad.l && pos.x <= plot.w - plot.pad.r) { vals.push(clamp(plot.ix(pos.x), 0, X1)); drag = vals.length - 1; }
    cv.setPointerCapture(e.pointerId); draw();
  });
  cv.addEventListener("pointermove", e => { const pos = DSV.canvasPos(e, cv); if (drag < 0) { cv.style.cursor = nearest(pos) >= 0 ? "grab" : "crosshair"; return; } vals[drag] = clamp(plot.ix(pos.x), 0, X1); draw(); });
  cv.addEventListener("pointerup", () => { drag = -1; });
  cv.addEventListener("dblclick", e => { const i = nearest(DSV.canvasPos(e, cv)); if (i >= 0) { vals.splice(i, 1); draw(); } });
  function useSource() {
    const src = $("eSource").value;
    if (src === "practice" || !real) { X1 = 60; unit = " min"; varName = "minutes_late"; vals = presets.skewed();
      $("eNote").textContent = "Practice data: made-up minutes late for 21 trains."; }
    else { const day = src.split("-")[1]; vals = real.stations.map(s => s[day]); X1 = Math.ceil(Math.max(...vals) * 1.08); unit = "k"; varName = day + "_riders";
      $("eNote").textContent = `Real ${real.year} CTA data: average ${day} entries per day at each of ${vals.length} 'L' stations, in thousands.`; }
    plot.x1 = X1; ["eSym", "eSkew"].forEach(id => { $(id).hidden = src !== "practice"; }); draw();
  }
  $("eSym").onclick = () => { vals = presets.symmetric(); draw(); };
  $("eSkew").onclick = () => { vals = presets.skewed(); draw(); };
  $("eOutlier").onclick = () => { vals.push(DSV.rand(0.86, 0.98) * X1); draw(); };
  $("eClear").onclick = () => { vals = []; draw(); };
  $("eSource").onchange = useSource;
  vals = presets.skewed();
  DSV.loadCTA().then(d => {
    real = d;
    $("eSource").querySelectorAll('option[value^="real"]').forEach(o => { if (d) o.textContent = o.textContent.replace("YEAR", d.year); else { o.disabled = true; o.textContent = o.textContent.replace("YEAR", "data") + " (run scripts/fetch_cta_data.py)"; } });
    if (d) $("eSource").value = "real-weekday";
    useSource();
  });

  DSV.pyBox("eda", () => {
    if (vals.length < 2) return { error: "Add at least 2 values first." };
    const body = v => `import labs\n\n${varName} = ${v}\nresult = labs.describe(${varName})\nprint(result)`;
    return {
      run: body(DSV.lit(vals)), show: body(DSV.short(vals, 4)),
      format: r => `n        ${r.n}\nmean     ${r.mean.toFixed(2)}\nmedian   ${r.median.toFixed(2)}\nSD       ${r.sd.toFixed(2)}\nQ1, Q3   ${r.q1.toFixed(2)}, ${r.q3.toFixed(2)}\nIQR      ${r.iqr.toFixed(2)}\noutliers ${r.outliers.length ? r.outliers.map(v => v.toFixed(1)).join(", ") : "none"}`,
      compare: r => { const st = stats(); const ok = Math.abs(r.mean - st.mean) < 1e-3 && Math.abs(r.median - st.med) < 1e-3 && Math.abs(r.sd - st.sd) < 1e-3 && r.outliers.length === st.out.length;
        return { ok, msg: ok ? "✓ Python matches the plot: same mean, median, SD and outliers." : "Python and the plot differ slightly (values were rounded to 4 decimals)." }; },
    };
  });
} });
