/* Stop 9, Harold Washington Library: networks, degree, shortest paths, and PageRank */
DSV.register("network", { init() {
  const { $, css, fmt, rand, clamp } = DSV;
  let nodes = [], edges = [], selected = -1, pendingFrom = -1, drag = -1, iterShown = null, timer = null;
  const name = i => String.fromCharCode(65 + i);
  const key = (u, v) => (u < v ? u + "-" + v : v + "-" + u);
  const PRESETS = {
    friends: () => { const n = 9; nodes = Array.from({ length: n }, (_, i) => ({ x: 5 + 3.6 * Math.cos(i / n * 2 * Math.PI), y: 5 + 3.6 * Math.sin(i / n * 2 * Math.PI) }));
      edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 0], [0, 4], [1, 5], [2, 6], [0, 2], [4, 6]]; },
    hub: () => { nodes = [{ x: 5, y: 5 }, ...Array.from({ length: 8 }, (_, i) => ({ x: 5 + 3.4 * Math.cos(i / 8 * 2 * Math.PI), y: 5 + 3.4 * Math.sin(i / 8 * 2 * Math.PI) }))];
      edges = [1, 2, 3, 4, 5, 6, 7, 8].map(i => [0, i]).concat([[1, 2], [5, 6]]); },
    bridge: () => { const left = Array.from({ length: 5 }, (_, i) => ({ x: 2.6 + 1.6 * Math.cos(i / 5 * 2 * Math.PI), y: 5 + 2.8 * Math.sin(i / 5 * 2 * Math.PI) }));
      const right = Array.from({ length: 5 }, (_, i) => ({ x: 7.4 + 1.6 * Math.cos(Math.PI + i / 5 * 2 * Math.PI), y: 5 + 2.8 * Math.sin(i / 5 * 2 * Math.PI) }));
      nodes = [...left, ...right];
      edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 2], [1, 3], [5, 6], [6, 7], [7, 8], [8, 9], [9, 5], [5, 7], [6, 8], [0, 5]]; },
  };
  function pagerank(iterations = 100, damping = 0.85) {
    const n = nodes.length, out = nodes.map(() => []);
    edges.forEach(([u, v]) => { out[u].push(v); out[v].push(u); });
    let rank = new Array(n).fill(1 / n);
    for (let t = 0; t < iterations; t++) {
      const next = new Array(n).fill((1 - damping) / n);
      for (let u = 0; u < n; u++) { if (out[u].length) out[u].forEach(v => { next[v] += damping * rank[u] / out[u].length; }); else for (let v = 0; v < n; v++) next[v] += damping * rank[u] / n; }
      rank = next;
    }
    return { rank, degree: out.map(o => o.length) };
  }
  function bfs(src) {
    const adj = nodes.map(() => []); edges.forEach(([u, v]) => { adj[u].push(v); adj[v].push(u); });
    const dist = nodes.map(() => null); dist[src] = 0; const q = [src];
    for (let i = 0; i < q.length; i++) for (const v of adj[q[i]]) if (dist[v] === null) { dist[v] = dist[q[i]] + 1; q.push(v); }
    return dist;
  }
  const plot = DSV.makePlot($("networkCanvas"), 4 / 3, draw, { pad: { l: 14, r: 14, t: 14, b: 14 } });
  function draw() {
    const p = plot, c = p.ctx; c.clearRect(0, 0, p.w, p.h);
    const pr = pagerank(iterShown ?? 100), metric = $("nMetric").value;
    const vals = metric === "pagerank" ? pr.rank : pr.degree, maxV = Math.max(...vals, 1e-9);
    const dist = selected >= 0 ? bfs(selected) : null;
    c.lineWidth = 2.5;
    edges.forEach(([u, v]) => { c.strokeStyle = css("--axis"); c.beginPath(); c.moveTo(p.sx(nodes[u].x), p.sy(nodes[u].y)); c.lineTo(p.sx(nodes[v].x), p.sy(nodes[v].y)); c.stroke(); });
    nodes.forEach((nd, i) => {
      const r = 10 + 20 * Math.sqrt(vals[i] / maxV), X = p.sx(nd.x), Y = p.sy(nd.y);
      const fill = i === selected ? css("--accent") : i === pendingFrom ? css("--guess") : css("--line");
      DSV.dot(c, X, Y, r, DSV.withAlpha(fill, i === selected ? 0.9 : 0.75), css("--sheet"));
      c.fillStyle = css("--sheet"); c.font = "bold 13px " + css("--body"); c.textAlign = "center"; c.fillText(name(i), X, Y + 4.5);
      c.fillStyle = css("--ink"); c.font = "12px " + css("--body");
      const label = dist ? (dist[i] === null ? "∞ away" : dist[i] === 0 ? "start" : dist[i] + (dist[i] === 1 ? " hop" : " hops")) : metric === "pagerank" ? fmt(pr.rank[i], 3) : pr.degree[i] + " links";
      c.fillText(label, X, Y + r + 15);
    });
    if (!nodes.length) DSV.emptyText(p, "Choose a network or switch to “Add nodes” and click");
    const order = nodes.map((_, i) => i).sort((a, b) => pr.rank[b] - pr.rank[a]);
    $("nNodes").textContent = nodes.length; $("nEdges").textContent = edges.length;
    $("nTopPR").textContent = nodes.length ? `${name(order[0])} (${fmt(pr.rank[order[0]], 3)})` : "–";
    const dOrder = nodes.map((_, i) => i).sort((a, b) => pr.degree[b] - pr.degree[a]);
    $("nTopDeg").textContent = nodes.length ? `${name(dOrder[0])} (${pr.degree[dOrder[0]]} links)` : "–";
    $("nIter").textContent = iterShown === null ? "converged (100)" : iterShown;
  }
  const hit = pos => { let best = -1, bd = 22 * 22; nodes.forEach((n, i) => { const d = (plot.sx(n.x) - pos.x) ** 2 + (plot.sy(n.y) - pos.y) ** 2; if (d < bd) { bd = d; best = i; } }); return best; };
  const mode = () => document.querySelector('input[name="nMode"]:checked').value;
  const cv = plot.canvas;
  cv.addEventListener("pointerdown", e => {
    const pos = DSV.canvasPos(e, cv), i = hit(pos), m = mode();
    if (m === "add" && i < 0) { if (nodes.length < 26) nodes.push({ x: clamp(plot.ix(pos.x), 0.5, 9.5), y: clamp(plot.iy(pos.y), 0.5, 9.5) }); }
    else if (m === "connect" && i >= 0) {
      if (pendingFrom < 0) pendingFrom = i;
      else { if (i !== pendingFrom) { const k = key(pendingFrom, i), at = edges.findIndex(([u, v]) => key(u, v) === k); if (at >= 0) edges.splice(at, 1); else edges.push([pendingFrom, i]); } pendingFrom = -1; }
    } else if (i >= 0) { selected = selected === i ? -1 : i; drag = i; cv.setPointerCapture(e.pointerId); }
    else selected = -1;
    draw();
  });
  cv.addEventListener("pointermove", e => { const pos = DSV.canvasPos(e, cv); if (drag < 0) { cv.style.cursor = hit(pos) >= 0 ? (mode() === "connect" ? "pointer" : "grab") : (mode() === "add" ? "copy" : "default"); return; }
    nodes[drag] = { x: clamp(plot.ix(pos.x), 0.5, 9.5), y: clamp(plot.iy(pos.y), 0.5, 9.5) }; draw(); });
  cv.addEventListener("pointerup", () => { drag = -1; });
  cv.addEventListener("dblclick", e => { const i = hit(DSV.canvasPos(e, cv)); if (i < 0) return;
    nodes.splice(i, 1); edges = edges.filter(([u, v]) => u !== i && v !== i).map(([u, v]) => [u > i ? u - 1 : u, v > i ? v - 1 : v]); selected = -1; pendingFrom = -1; draw(); });
  function load(name) { stopAnim(); PRESETS[name](); selected = -1; pendingFrom = -1; iterShown = null; draw(); }
  function stopAnim() { clearInterval(timer); timer = null; $("nWatch").textContent = "Watch PageRank spread"; }
  $("nWatch").onclick = () => {
    if (timer) { stopAnim(); iterShown = null; draw(); return; }
    iterShown = 0; $("nMetric").value = "pagerank"; draw(); $("nWatch").textContent = "Stop";
    timer = setInterval(() => { iterShown++; draw(); if (iterShown >= 25) { stopAnim(); iterShown = null; draw(); } }, DSV.reducedMotion() ? 0 : 320);
  };
  $("nPreset").onchange = e => load(e.target.value);
  $("nMetric").onchange = draw;
  document.querySelectorAll('input[name="nMode"]').forEach(r => r.onchange = () => { pendingFrom = -1; draw(); });
  load("bridge");

  DSV.pyBox("network", () => {
    if (!nodes.length) return { error: "Add some nodes first." };
    const src = selected >= 0 ? `\nresult["hops_from_${name(selected)}"] = labs.shortest_path_lengths(${nodes.length}, edges, source=${selected})` : "";
    const run = `import labs\n\n# nodes are numbered 0..${nodes.length - 1} (A = 0, B = 1, ...)\nedges = ${DSV.lit(edges)}\nresult = labs.pagerank(${nodes.length}, edges, damping=0.85)${src}\nprint(result)`;
    return { run,
      format: r => nodes.map((_, i) => `${name(i)}   PageRank ${r.pagerank[i].toFixed(4)}   degree ${r.degree[i]}` + (selected >= 0 ? `   hops ${r["hops_from_" + name(selected)][i] ?? "∞"}` : "")).join("\n"),
      compare: r => { const mine = pagerank(); const ok = r.pagerank.every((v, i) => Math.abs(v - mine.rank[i]) < 1e-9) && (selected < 0 || r["hops_from_" + name(selected)].every((v, i) => v === bfs(selected)[i]));
        return { ok, msg: ok ? "✓ Python matches the graph: same PageRank for every node" + (selected >= 0 ? " and same shortest paths." : ".") : "Python and the graph disagree." }; } };
  });
} });
