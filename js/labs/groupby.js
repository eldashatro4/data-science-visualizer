/* Stop 3, Kedzie: data wrangling with filter + group_by + aggregate (split, apply, combine) */
DSV.register("groupby", { init() {
  const { $, css, fmt, LINE_COLORS } = DSV;
  const PRACTICE = [
    ["Clark/Lake", "Blue", "weekday", 12.4], ["Clark/Lake", "Blue", "weekend", 4.1], ["O'Hare", "Blue", "weekday", 9.8], ["O'Hare", "Blue", "weekend", 8.6],
    ["Fullerton", "Red", "weekday", 11.2], ["Fullerton", "Red", "weekend", 6.3], ["Howard", "Red", "weekday", 7.4], ["Howard", "Red", "weekend", 3.9],
    ["Midway", "Orange", "weekday", 6.1], ["Midway", "Orange", "weekend", 5.2], ["Halsted", "Orange", "weekday", 3.0], ["Halsted", "Orange", "weekend", 1.4],
    ["Belmont", "Brown", "weekday", 8.7], ["Belmont", "Brown", "weekend", 4.8], ["Kimball", "Brown", "weekday", 2.6], ["Kimball", "Brown", "weekend", 1.1],
  ].map(([station, line, day, riders]) => ({ station, line, day, riders }));
  let real = null, ROWS = PRACTICE, dots = PRACTICE.map(() => ({ x: 0, y: 0, a: 1, tx: 0, ty: 0, ta: 1 })), anim = null;
  const AGG = {
    mean: xs => xs.reduce((a, b) => a + b, 0) / xs.length, sum: xs => xs.reduce((a, b) => a + b, 0), count: xs => xs.length,
    max: xs => Math.max(...xs), min: xs => Math.min(...xs), median: xs => DSV.quantile([...xs].sort((a, b) => a - b), 0.5),
  };
  // the same station appears once per line it serves, for each day type
  const realRows = d => d.stations.flatMap(s => s.lines.flatMap(line => ["weekday", "saturday", "sunday"].map(day => ({ station: s.name, line, day, riders: s[day] }))));
  const jitter = i => (((i * 2654435761) % 1000) / 1000 - 0.5);      // stable pseudo-random offset per row
  const settings = () => ({ key: $("gKey").value, agg: $("gAgg").value, filter: $("gFilter").value });
  const passes = (r, f) => f === "all" || (f === "busy" ? r.riders > 5 : r.day === f);

  function useSource() {
    const isReal = $("gSource").value === "real" && real;
    ROWS = isReal ? realRows(real) : PRACTICE;
    const days = [...new Set(ROWS.map(r => r.day))];
    $("gFilter").innerHTML = `<option value="all">All rows</option><option value="busy">More than 5 thousand riders a day</option>` + days.map(d => `<option value="${d}">${d[0].toUpperCase() + d.slice(1)} only</option>`).join("");
    $("gKey").querySelector('option[value="station"]').disabled = isReal;
    if (isReal && $("gKey").value === "station") $("gKey").value = "line";
    $("gNote").textContent = isReal
      ? `Real ${real.year} CTA data: average entries per day at ${real.stations.length} 'L' stations, in thousands. A station served by several lines counts once for each line.`
      : "Practice data: made-up numbers for 8 stations.";
    $("gRaw").innerHTML = "<thead><tr><th>station</th><th>line</th><th>day</th><th>riders (thousands)</th></tr></thead><tbody>" +
      ROWS.slice(0, 60).map(r => `<tr><td>${r.station}</td><td>${r.line}</td><td>${r.day}</td><td>${r.riders.toFixed(2)}</td></tr>`).join("") +
      (ROWS.length > 60 ? `<tr><td colspan="4">… ${ROWS.length - 60} more rows</td></tr>` : "") + "</tbody>";
    dots = ROWS.map(() => ({ x: 0, y: 0, a: 1, tx: 0, ty: 0, ta: 1 }));
    draw();
  }
  function result() {
    const { key, agg, filter } = settings(), groups = {};
    ROWS.forEach(r => { if (passes(r, filter)) (groups[r[key]] = groups[r[key]] || []).push(r.riders); });
    return Object.fromEntries(Object.keys(groups).sort().map(k => [k, AGG[agg](groups[k])]));
  }
  const plot = DSV.makePlot($("groupbyCanvas"), 16 / 10, draw, { pad: { l: 44, r: 16, t: 20, b: 40 } });
  function layout() {
    const { key, filter } = settings(), keys = [...new Set(ROWS.map(r => r[key]))].sort();
    const p = plot, colW = (p.w - p.pad.l - p.pad.r) / keys.length, many = ROWS.length > 40;
    ROWS.forEach((r, i) => {
      const k = keys.indexOf(r[key]), within = ROWS.filter((q, j) => j < i && q[key] === r[key]).length;
      dots[i].tx = p.pad.l + colW * (k + 0.5) + (many ? jitter(i) * colW * 0.6 : ((within % 4) - 1.5) * 12);
      dots[i].ty = p.sy(r.riders); dots[i].ta = passes(r, filter) ? (many ? 0.75 : 1) : 0.12;
    });
    return { keys, colW };
  }
  function animate() {
    cancelAnimationFrame(anim);
    if (DSV.reducedMotion()) return draw();
    const step = () => {
      let moving = false;
      dots.forEach(d => { for (const [a, b] of [["x", "tx"], ["y", "ty"], ["a", "ta"]]) { const diff = d[b] - d[a]; if (Math.abs(diff) > 0.01) { d[a] += diff * 0.18; moving = true; } else d[a] = d[b]; } });
      draw(true); if (moving) anim = requestAnimationFrame(step);
    };
    step();
  }
  function draw(fromAnim) {
    const p = plot, c = p.ctx, { key, agg } = settings(), res = result();
    p.y0 = 0; p.y1 = Math.max(14, ...ROWS.map(r => r.riders), ...Object.values(res));
    p.y1 = Math.ceil(p.y1 / DSV.niceStep(p.y1 / 6)) * DSV.niceStep(p.y1 / 6);
    const { keys, colW } = layout();
    if (!fromAnim) dots.forEach(d => { d.x = d.tx; d.y = d.ty; d.a = d.ta; });
    DSV.drawGrid(p, [], DSV.range(0, p.y1, DSV.niceStep(p.y1 / 6)));
    const colorOf = k => (key === "line" ? LINE_COLORS[k] || css("--line") : css("--line"));
    keys.forEach((k, i) => {
      const cx = p.pad.l + colW * (i + 0.5);
      c.fillStyle = css("--ink"); c.font = `bold ${keys.length > 6 ? 12 : 14}px ` + css("--body"); c.textAlign = "center"; c.fillText(k, cx, p.h - p.pad.b + 22);
      if (k in res) { const v = res[k], color = colorOf(k);
        c.fillStyle = DSV.withAlpha(color, 0.2); c.fillRect(cx - colW * 0.38, p.sy(v), colW * 0.76, p.sy(0) - p.sy(v));
        c.strokeStyle = color; c.lineWidth = 3; c.beginPath(); c.moveTo(cx - colW * 0.38, p.sy(v)); c.lineTo(cx + colW * 0.38, p.sy(v)); c.stroke(); }
    });
    const r = ROWS.length > 40 ? 3.5 : 6;
    ROWS.forEach((row, i) => { const d = dots[i]; c.globalAlpha = d.a; DSV.dot(c, d.x, d.y, r, LINE_COLORS[row.line] || css("--ink"), ROWS.length > 40 ? null : css("--sheet")); });
    c.globalAlpha = 1;
    keys.forEach((k, i) => { if (!(k in res)) return; const cx = p.pad.l + colW * (i + 0.5), v = res[k], label = `${agg} = ${fmt(v, agg === "count" ? 0 : 1)}`;
      c.font = "bold 12px " + css("--body"); const tw = c.measureText(label).width, ty = Math.max(p.pad.t + 14, p.sy(v) - 10);
      c.fillStyle = css("--sheet"); c.fillRect(cx - tw / 2 - 4, ty - 12, tw + 8, 17); c.fillStyle = css("--ink"); c.textAlign = "center"; c.fillText(label, cx, ty); });
    c.save(); c.translate(14, p.h / 2); c.rotate(-Math.PI / 2); c.fillStyle = css("--ink-soft"); c.font = "12px " + css("--body"); c.textAlign = "center"; c.fillText("riders per day (thousands)", 0, 0); c.restore();
    $("gPolars").textContent = polarsCode();
    $("gTable").innerHTML = `<thead><tr><th>${key}</th><th>${agg === "count" ? "count" : "riders (" + agg + ")"}</th></tr></thead><tbody>` +
      Object.entries(res).map(([k, v]) => `<tr><td>${k}</td><td>${fmt(v, agg === "count" ? 0 : 2)}</td></tr>`).join("") + "</tbody>";
    $("gKept").textContent = `${ROWS.filter(r => passes(r, settings().filter)).length} of ${ROWS.length} rows kept`;
  }
  function polarsCode() {
    const { key, agg, filter } = settings();
    const f = filter === "all" ? "" : filter === "busy" ? '\n    .filter(pl.col("riders") > 5)' : `\n    .filter(pl.col("day") == "${filter}")`;
    const a = agg === "count" ? 'pl.len().alias("count")' : `pl.col("riders").${agg}()`;
    return `(\n  df${f}\n    .group_by("${key}")\n    .agg(${a})\n    .sort("${key}")\n)`;
  }
  ["gKey", "gAgg", "gFilter"].forEach(id => $(id).addEventListener("change", animate));
  $("gSource").addEventListener("change", useSource);
  $("gTableBtn").onclick = () => { const t = $("gRaw"); t.hidden = !t.hidden; $("gTableBtn").setAttribute("aria-pressed", !t.hidden); };
  DSV.loadCTA().then(d => {
    real = d;
    const opt = $("gSource").querySelector('option[value="real"]');
    if (d) { opt.textContent = `Real CTA ridership, ${d.year}`; $("gSource").value = "real"; } else { opt.disabled = true; opt.textContent = "Real CTA ridership (run scripts/fetch_cta_data.py)"; $("gSource").value = "practice"; }
    useSource();
  });

  DSV.pyBox("groupby", () => {
    const { key, agg, filter } = settings();
    const where = filter === "all" ? "None" : filter === "busy" ? '("riders", ">", 5)' : `("day", "==", "${filter}")`;
    const body = rs => `import labs\n\nrows = ${rs}\nresult = labs.group_aggregate(rows, key="${key}", value="riders", agg="${agg}", where=${where})\nprint(result)`;
    return {
      run: body(DSV.lit(ROWS)), show: body(DSV.short(ROWS, 1)),
      format: r => Object.entries(r).map(([k, v]) => `${k.padEnd(10)} ${v.toFixed(2)}`).join("\n"),
      compare: r => { const mine = result(); const ok = Object.keys(mine).length === Object.keys(r).length && Object.entries(mine).every(([k, v]) => Math.abs(r[k] - v) < 1e-3);
        return { ok, msg: ok ? "✓ Python matches the chart: same groups, same values." : "Python and the chart disagree." }; },
    };
  });
} });
