/* Stop 8, Roosevelt: A/B testing, p-values, power, and false positives */
DSV.register("abtest", { init() {
  const { $, css, gauss, niceStep, normCdf } = DSV;
  const N_STEPS = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];
  let one = null, batch = null;
  const pct = (v, d = 1) => (v * 100).toFixed(d) + "%";
  const params = () => ({ pa: $("abA").value / 100, pb: $("abB").value / 100, n: N_STEPS[$("abN").value] });
  function binom(n, p) {
    if (n * p < 40 || n * (1 - p) < 40) { let k = 0; for (let i = 0; i < n; i++) if (Math.random() < p) k++; return k; }
    return Math.max(0, Math.min(n, Math.round(n * p + gauss() * Math.sqrt(n * p * (1 - p)))));
  }
  function test(n, pa, pb) {
    const a = binom(n, pa), b = binom(n, pb), ra = a / n, rb = b / n, pool = (a + b) / (2 * n);
    const sp = Math.sqrt(pool * (1 - pool) * 2 / n), z = sp > 0 ? (rb - ra) / sp : 0, p = 2 * (1 - normCdf(Math.abs(z)));
    const se = Math.sqrt(ra * (1 - ra) / n + rb * (1 - rb) / n);
    return { a, b, n, ra, rb, diff: rb - ra, lo: rb - ra - 1.96 * se, hi: rb - ra + 1.96 * se, p, sig: p < 0.05 };
  }
  const plot = DSV.makePlot($("abtestCanvas"), 16 / 10, draw);
  function labels() { const { pa, pb, n } = params(); $("abAOut").textContent = pct(pa); $("abBOut").textContent = pct(pb); $("abNOut").textContent = n.toLocaleString(); }
  function draw() { if (batch) return drawBatch(); drawCurves(); }
  function drawCurves() {
    const p = plot, c = p.ctx, { pa, pb, n } = params();
    const seA = Math.sqrt(pa * (1 - pa) / n), seB = Math.sqrt(pb * (1 - pb) / n);
    const lo = Math.max(0, Math.min(pa - 4.5 * seA, pb - 4.5 * seB)), hi = Math.min(1, Math.max(pa + 4.5 * seA, pb + 4.5 * seB));
    const dens = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));
    p.x0 = lo; p.x1 = hi; p.y0 = 0; p.y1 = Math.max(dens(pa, pa, seA), dens(pb, pb, seB)) * 1.12; p.pad.l = 18;
    const st = niceStep((hi - lo) / 6);
    DSV.drawGrid(p, DSV.range(Math.ceil(lo / st) * st, hi, st), [], v => pct(v, st < 0.01 ? 1 : 0));
    const curve = (m, s, color) => { c.beginPath(); for (let i = 0; i <= 200; i++) { const x = lo + (hi - lo) * i / 200, y = p.sy(dens(x, m, s)); i ? c.lineTo(p.sx(x), y) : c.moveTo(p.sx(x), y); }
      c.lineTo(p.sx(hi), p.sy(0)); c.lineTo(p.sx(lo), p.sy(0)); c.closePath(); c.fillStyle = DSV.withAlpha(color, 0.16); c.fill(); c.strokeStyle = color; c.lineWidth = 2.5; c.stroke(); };
    const ca = css("--c1"), cb = css("--c3"); curve(pa, seA, ca); curve(pb, seB, cb);
    c.font = "13px " + css("--body"); c.textAlign = "center";
    if (one) for (const [v, col, name] of [[one.ra, ca, "A"], [one.rb, cb, "B"]]) { if (v < lo || v > hi) continue;
      c.strokeStyle = col; c.lineWidth = 2.5; c.setLineDash([6, 4]); c.beginPath(); c.moveTo(p.sx(v), p.sy(0)); c.lineTo(p.sx(v), p.pad.t + 18); c.stroke(); c.setLineDash([]);
      c.fillStyle = col; c.fillText("observed " + name, p.sx(v), p.pad.t + 12); }
    $("abLegend").innerHTML = `<span><i style="background:${ca}"></i>Where A’s observed rate could land</span><span><i style="background:${cb}"></i>Where B’s observed rate could land</span>`;
  }
  function drawBatch() {
    const p = plot, c = p.ctx, r = batch.results, diffs = r.map(x => x.diff), n = batch.n;
    let lo = Math.min(...diffs), hi = Math.max(...diffs); const span = Math.max(hi - lo, 1e-4); lo -= span * 0.05; hi += span * 0.05;
    const w = Math.max(1, Math.ceil((hi - lo) / 36 * n)) / n; lo = Math.floor(lo * n) / n - w / 2;
    const bins = Math.ceil((hi - lo) / w), sig = new Array(bins).fill(0), non = new Array(bins).fill(0); hi = lo + bins * w;
    r.forEach(x => { const i = Math.min(bins - 1, Math.floor((x.diff - lo) / w)); (x.sig ? sig : non)[i]++; });
    const top = Math.max(...sig.map((s, i) => s + non[i]));
    p.x0 = lo; p.x1 = hi; p.y0 = 0; p.y1 = top * 1.1; p.pad.l = 40;
    const st = niceStep((hi - lo) / 6);
    DSV.drawGrid(p, DSV.range(Math.ceil(lo / st) * st, hi, st), DSV.range(0, top, niceStep(top / 4)), v => (v >= 0 ? "+" : "") + pct(v, st < 0.01 ? 1 : 0));
    const bw = p.sx(lo + w) - p.sx(lo);
    for (let i = 0; i < bins; i++) { const x = p.sx(lo + i * w) + 1;
      c.fillStyle = css("--axis"); c.fillRect(x, p.sy(non[i]), bw - 2, p.sy(0) - p.sy(non[i]));
      c.fillStyle = css("--good"); c.fillRect(x, p.sy(non[i] + sig[i]), bw - 2, p.sy(non[i]) - p.sy(non[i] + sig[i])); }
    const tv = batch.pb - batch.pa;
    if (tv >= lo && tv <= hi) { c.strokeStyle = css("--ink"); c.lineWidth = 2; c.setLineDash([6, 4]); c.beginPath(); c.moveTo(p.sx(tv), p.sy(0)); c.lineTo(p.sx(tv), p.pad.t); c.stroke(); c.setLineDash([]);
      c.fillStyle = css("--ink"); c.font = "13px " + css("--body"); c.textAlign = "left"; c.fillText("true difference", p.sx(tv) + 6, p.pad.t + 12); }
    $("abLegend").innerHTML = `<span><i style="background:${css("--good")}"></i>Significant (p &lt; 0.05)</span><span><i style="background:${css("--axis")}"></i>Not significant</span><span>Observed difference B − A across 1,000 experiments</span>`;
  }
  function resetResults() { one = null; batch = null; $("abVerdict").className = "verdict"; $("abVerdict").textContent = "Run an experiment to see the result."; $("abReadout").hidden = true; }
  $("abRun").onclick = () => {
    const { pa, pb, n } = params(); batch = null; one = test(n, pa, pb); $("abReadout").hidden = false;
    $("abObsA").textContent = pct(one.ra, 2); $("abObsB").textContent = pct(one.rb, 2);
    $("abDiff").textContent = `${one.diff >= 0 ? "+" : ""}${pct(one.diff, 2)}  [${pct(one.lo, 2)}, ${pct(one.hi, 2)}]`;
    $("abP").textContent = one.p < 0.0001 ? "< 0.0001" : one.p.toFixed(4);
    $("abVerdict").className = "verdict " + (one.sig ? "yes" : "no");
    $("abVerdict").textContent = one.sig ? `Significant: B ${one.diff > 0 ? "beats" : "loses to"} A (p < 0.05).` : "Not significant: this gap could easily be noise.";
    $("abTip").innerHTML = "<strong>What to notice</strong>The shaded curves show where each observed rate could land by chance. When they overlap a lot, small samples can’t tell the versions apart.";
    draw();
  };
  $("abMany").onclick = () => {
    const { pa, pb, n } = params(), results = []; for (let i = 0; i < 1000; i++) results.push(test(n, pa, pb));
    batch = { pa, pb, n, results }; one = null; $("abReadout").hidden = true;
    const share = results.filter(r => r.sig).length / 10;
    $("abVerdict").className = "verdict yes";
    $("abVerdict").textContent = pa === pb ? `${share.toFixed(1)}% were falsely “significant” (false positive rate).` : `${share.toFixed(1)}% detected the real difference (statistical power).`;
    $("abTip").innerHTML = pa === pb ? "<strong>What to notice</strong>There is no real difference, yet about 1 in 20 experiments says there is. That is what p &lt; 0.05 means."
      : "<strong>What to notice</strong>Power is how often a real effect gets detected. Raise the visitors per version and watch it climb toward 100%.";
    draw();
  };
  ["abA", "abB", "abN"].forEach(id => $(id).addEventListener("input", () => { labels(); resetResults(); draw(); }));
  labels(); resetResults();

  DSV.pyBox("abtest", () => {
    const { pa, pb, n } = params();
    if (batch) {
      const share = batch.results.filter(r => r.sig).length / batch.results.length;
      const run = `import labs\n\nresult = labs.simulate_power(p_a=${pa}, p_b=${pb}, n=${n}, runs=1000)\nprint(result)`;
      return { run, format: r => `share significant   ${(r * 100).toFixed(1)}%`,
        compare: r => ({ ok: Math.abs(r - share) < 0.06, msg: Math.abs(r - share) < 0.06 ? `✓ Python agrees: ${(r * 100).toFixed(1)}% vs ${(share * 100).toFixed(1)}% on the plot. Simulations differ a little by chance.` : `Python got ${(r * 100).toFixed(1)}% vs ${(share * 100).toFixed(1)}%. Random simulations vary; run both again.` }) };
    }
    if (!one) return { error: "Run an experiment first." };
    const run = `import labs\n\n# conversions out of ${n} visitors each\nresult = labs.ab_test(${one.a}, ${n}, ${one.b}, ${n})\nprint(result["p_value"])`;
    return { run,
      format: r => `rate A       ${(r.rate_a * 100).toFixed(2)}%\nrate B       ${(r.rate_b * 100).toFixed(2)}%\ndifference   ${(r.difference * 100).toFixed(2)}%\n95% CI       [${(r.ci_95[0] * 100).toFixed(2)}%, ${(r.ci_95[1] * 100).toFixed(2)}%]\nz            ${r.z.toFixed(3)}\np-value      ${r.p_value.toFixed(4)}`,
      compare: r => { const ok = Math.abs(r.p_value - one.p) < 1e-4; return { ok, msg: ok ? "✓ Python matches the plot: same z-test and p-value." : "Python and the plot differ in the p-value." }; } };
  });
} });
