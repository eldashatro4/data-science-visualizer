/* Stop 1, Midway: sampling distributions and the central limit theorem */
DSV.register("sampling", { init() {
  const { $, css, fmt, gauss, clamp, mean, sd } = DSV;
  const POP_N = 2000;
  let population = [], means = [], lastSample = [];
  const makers = {
    wait: () => { let v; do v = -Math.log(1 - Math.random()) * 2; while (v >= 10); return v; },   // right-skewed, like train wait times
    uniform: () => Math.random() * 10,
    bimodal: () => { let v; do v = Math.random() < 0.5 ? 2.5 + gauss() * 0.8 : 7.5 + gauss() * 0.8; while (v < 0 || v >= 10); return v; },
  };
  const popSd = () => sd(population, 0);
  function newPopulation() { population = Array.from({ length: POP_N }, makers[$("sPop").value]); reset(); }
  function reset() { means = []; lastSample = []; plot.draw(); }
  function draw(times) {
    const n = +$("sN").value;
    for (let t = 0; t < times; t++) {
      lastSample = Array.from({ length: n }, () => population[Math.floor(Math.random() * POP_N)]);
      means.push(mean(lastSample));
    }
    plot.draw();
  }
  function hist(values, bins) {
    const counts = new Array(bins).fill(0);
    values.forEach(v => counts[Math.min(bins - 1, Math.floor(v / 10 * bins))]++);
    return counts;
  }
  const plot = DSV.makePlot($("samplingCanvas"), 4 / 3, () => {
    const p = plot, c = p.ctx; c.clearRect(0, 0, p.w, p.h);
    const n = +$("sN").value, gap = 40, half = (p.h - gap - p.pad.t - p.pad.b) / 2 + 10;
    const panel = (top, height, counts, color, label, yMax) => {
      const max = yMax || Math.max(1, ...counts), l = p.pad.l, r = p.w - p.pad.r, bw = (r - l) / counts.length;
      c.fillStyle = css("--ink-soft"); c.font = "13px " + css("--body"); c.textAlign = "left"; c.fillText(label, l, top + 12);
      counts.forEach((k, i) => { const h = (k / max) * (height - 30); c.fillStyle = color; c.fillRect(l + i * bw + 0.5, top + height - h, Math.max(1, bw - 1), h); });
      c.strokeStyle = css("--axis"); c.beginPath(); c.moveTo(l, top + height); c.lineTo(r, top + height); c.stroke();
      c.fillStyle = css("--ink-soft"); c.textAlign = "center";
      for (let x = 0; x <= 10; x += 2) c.fillText(x, l + (x / 10) * (r - l), top + height + 16);
      return { l, r, max, top, height };
    };
    const xOf = (g, v) => g.l + (v / 10) * (g.r - g.l);
    const g1 = panel(p.pad.t, half - 10, hist(population, 50), DSV.withAlpha(css("--axis"), 0.7), "Population: every value (" + POP_N.toLocaleString() + ")");
    // the latest sample, as ticks on the population
    c.strokeStyle = css("--accent"); c.lineWidth = 2;
    lastSample.forEach(v => { c.beginPath(); c.moveTo(xOf(g1, v), g1.top + g1.height); c.lineTo(xOf(g1, v), g1.top + g1.height - 10); c.stroke(); });
    const mu = mean(population);
    c.setLineDash([5, 4]); c.strokeStyle = css("--ink"); c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(xOf(g1, mu), g1.top + 18); c.lineTo(xOf(g1, mu), g1.top + g1.height); c.stroke(); c.setLineDash([]);
    const BINS = 80, binW = 10 / BINS, se = popSd() / Math.sqrt(n);
    const counts = hist(means, BINS);
    const expected = x => means.length * binW * Math.exp(-((x - mu) ** 2) / (2 * se * se)) / (se * Math.sqrt(2 * Math.PI));
    const yMax = Math.max(1, ...counts, means.length > 1 ? expected(mu) : 0) * 1.05;
    const g2 = panel(p.pad.t + half + gap - 10, half - 10, counts, css("--line"), `Means of ${means.length.toLocaleString()} samples of size ${n}`, yMax);
    if (means.length > 1) {   // CLT prediction: normal with sd = sigma / sqrt(n), in expected counts per bin
      const ht = g2.height - 30; c.strokeStyle = css("--accent"); c.lineWidth = 2.5; c.beginPath();
      for (let i = 0; i <= 400; i++) { const x = i / 40, y = g2.top + g2.height - (expected(x) / yMax) * ht; i ? c.lineTo(xOf(g2, x), y) : c.moveTo(xOf(g2, x), y); }
      c.stroke();
    }
    $("sMu").textContent = fmt(mu); $("sSigma").textContent = fmt(popSd());
    $("sCount").textContent = means.length.toLocaleString();
    $("sMeanMeans").textContent = means.length ? fmt(mean(means)) : "–";
    $("sObsSE").textContent = means.length > 1 ? fmt(sd(means), 3) : "–";
    $("sPredSE").textContent = fmt(popSd() / Math.sqrt(n), 3);
  }, { pad: { l: 16, r: 16, t: 12, b: 26 } });

  $("sPop").onchange = newPopulation;
  $("sN").oninput = e => { $("sNOut").textContent = e.target.value; reset(); };
  $("sOne").onclick = () => draw(1);
  $("sHundred").onclick = () => draw(100);
  $("sThousand").onclick = () => draw(1000);
  $("sReset").onclick = reset;
  newPopulation();

  DSV.pyBox("sampling", () => {
    if (means.length < 2) return { error: "Draw at least 2 samples first." };
    const n = +$("sN").value;
    const body = (pop, ms) => `import labs\n\npopulation = ${pop}\nsample_means = ${ms}\nresult = labs.clt_summary(population, sample_means, n=${n})\nprint(result)`;
    return {
      run: body(DSV.lit(population), DSV.lit(means)), show: body(DSV.short(population), DSV.short(means)),
      format: r => `population mean        ${r.population_mean.toFixed(3)}\npopulation SD          ${r.population_sd.toFixed(3)}\nmean of sample means   ${r.mean_of_sample_means.toFixed(3)}\npredicted SE (σ/√n)    ${r.predicted_se.toFixed(4)}\nobserved SE            ${r.observed_se.toFixed(4)}`,
      compare: r => {
        const ok = Math.abs(r.predicted_se - popSd() / Math.sqrt(n)) < 1e-3 && Math.abs(r.observed_se - sd(means)) < 1e-3;
        return { ok, msg: ok ? `✓ Python matches the plot. Observed spread ${r.observed_se.toFixed(3)} vs CLT prediction ${r.predicted_se.toFixed(3)}.` : "Python and the plot differ slightly (values were rounded to 4 decimals)." };
      },
    };
  });
} });
