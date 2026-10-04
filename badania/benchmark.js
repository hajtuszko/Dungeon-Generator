// Porównanie algorytmów labiryntu i wpływu parametrów na ocenę.
// Uruchomienie: node badania/benchmark.js [liczba_ziaren]  → zapisuje badania/wyniki.md
const fs = require('fs'), path = require('path');
const { MAZES, generate, evaluate, ROOM } = require('../core.js');

const N = Number(process.argv[2]) || 300;
const ALGOS = ['backtracker', 'huntAndKill', 'growingMix', 'wilson', 'kruskal', 'prim', 'binaryTree'];
const BASE = { W: 41, H: 41, density: 0.3, s33: true, s34: true, s42: true, extraDoor: 0.08, sparse: 0.25, braid: 0.5, loops: 0.1, wide: 4 };
const PURE = { ...BASE, s33: false, s34: false, s42: false, extraDoor: 0, sparse: 0, braid: 0, loops: 0, wide: 0 };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const med = a => { const b = [...a].sort((x, y) => x - y); return b[Math.floor((b.length - 1) / 2)]; };
const f = (v, d = 2) => v.toFixed(d);
const pct = v => Math.round(v * 100) + '%';

// Faktura „czystego” labiryntu (bez pokoi i obróbki): mierzona na komórkach logicznych
function texture(G, rng) {
  const { W, H, LW, LH, t } = G, at = (x, y) => y * W + x, cx = i => 2 * i + 1;
  const open = (i, j, dx, dy) => t[at(cx(i) + dx, cx(j) + dy)] > 0;
  let dead = 0, straight = 0, turn = 0, junc = 0, cells = 0;
  for (let j = 0; j < LH; j++) for (let i = 0; i < LW; i++) {
    const d = DIRS.filter(([dx, dy]) => open(i, j, dx, dy));
    cells++;
    if (d.length === 1) dead++;
    else if (d.length === 2) (d[0][0] === -d[1][0] && d[0][1] === -d[1][1] ? straight++ : turn++);
    else junc++;
  }
  // „river factor”: średnia długość prostego odcinka korytarza (w komórkach)
  const runs = [];
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    for (let j = 0; j < LH; j++) for (let i = 0; i < LW; i++) {
      if (i - dx >= 0 && j - dy >= 0 && open(i, j, -dx, -dy)) continue; // nie początek odcinka
      let L = 1, a = i, b = j;
      while (a + dx < LW && b + dy < LH && open(a, b, dx, dy)) { L++; a += dx; b += dy; }
      if (L >= 2) runs.push(L);
    }
  }
  // krętość i średnica: BFS po kaflach z losowych punktów
  const bfs = s => { const d = new Int32Array(W * H).fill(-1), q = [s]; d[s] = 0;
    for (let h = 0; h < q.length; h++) { const k = q[h], x = k % W, y = (k / W) | 0;
      for (const [dx, dy] of DIRS) { const n = at(x + dx, y + dy); if (t[n] && d[n] < 0) { d[n] = d[k] + 1; q.push(n); } } } return d; };
  let tort = [], diam = 0;
  for (let k = 0; k < 6; k++) {
    const a = at(cx(Math.floor(rng() * LW)), cx(Math.floor(rng() * LH))), d = bfs(a);
    for (let m = 0; m < 30; m++) {
      const b = at(cx(Math.floor(rng() * LW)), cx(Math.floor(rng() * LH)));
      const man = Math.abs(a % W - b % W) + Math.abs(((a / W) | 0) - ((b / W) | 0));
      if (man >= 10 && d[b] > 0) tort.push(d[b] / man);
    }
    diam = Math.max(diam, Math.max(...d));
  }
  return { dead: dead / cells, straight: straight / cells, turn: turn / cells, junc: junc / cells,
    river: mean(runs), tort: mean(tort), diam: diam / (W * H / 2) };
}

const lines = [];
const out = s => { lines.push(s); console.log(s); };
const rng0 = (() => { let a = 12345; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; })();

out(`# Wyniki pomiarów\n\nWygenerowane przez \`node badania/benchmark.js ${N}\`. Mapa 41×41 kafli (20×20 komórek), ${N} ziaren na wariant.\n`);

// --- A. Faktura czystych labiryntów ---
out('## A. Faktura czystego labiryntu (bez pokoi i obróbki)\n');
out('| Algorytm | Zaułki | Proste | Zakręty | Rozwidlenia | Śr. prosta (kom.) | Krętość | Średnica / pola |');
out('|---|---|---|---|---|---|---|---|');
for (const a of ALGOS) {
  const R = [];
  for (let s = 1; s <= N; s++) R.push(texture(generate({ ...PURE, maze: a }, s), rng0));
  const m = k => mean(R.map(r => r[k]));
  out(`| ${a} | ${pct(m('dead'))} | ${pct(m('straight'))} | ${pct(m('turn'))} | ${pct(m('junc'))} | ${f(m('river'))} | ${f(m('tort'))} | ${f(m('diam'))} |`);
}

// --- B. Pełny potok z domyślnymi parametrami ---
const KEYS = ['loops', 'dead', 'lin', 'tort', 'str', 'junc', 'cov', 'door', 'ent'];
out('\n## B. Pełny potok (domyślne parametry), ocena obecnym oceniaczem\n');
out('| Algorytm | Śr. ocena | Mediana | ≥ 85 pkt | = 100 pkt | ' + KEYS.join(' | ') + ' |');
out('|---|---|---|---|---|' + KEYS.map(() => '---').join('|') + '|');
const fullRes = {};
for (const a of ALGOS) {
  const P = { ...BASE, maze: a }, E = [];
  for (let s = 1; s <= N; s++) E.push(evaluate(generate(P, s), P, []));
  fullRes[a] = E;
  const sc = E.map(e => e.score);
  const mv = k => { const v = med(E.map(e => e.M.find(m => m.key === k).v)); return ['lin', 'str', 'junc', 'cov', 'ent'].includes(k) ? pct(v) : f(v); };
  out(`| ${a} | ${f(mean(sc), 1)} | ${med(sc)} | ${pct(sc.filter(x => x >= 85).length / N)} | ${pct(sc.filter(x => x === 100).length / N)} | ${KEYS.map(mv).join(' | ')} |`);
}
out('\nW kolumnach cech podana jest mediana surowej wartości (nie punktów).');

// --- C. Wrażliwość na parametry (backtracker) ---
out('\n## C. Wpływ „Usuń zaułki” i „Pętle” (backtracker)\n');
out('Średnia ocena / mediana krętości / mediana zaułków na pokój:\n');
const LOOPS = [0, 0.05, 0.1, 0.2, 0.3], BRAIDS = [0, 0.5, 1];
out('| Pętle \\ Zaułki | ' + BRAIDS.map(b => pct(b)).join(' | ') + ' |');
out('|---|' + BRAIDS.map(() => '---').join('|') + '|');
for (const l of LOOPS) {
  const row = BRAIDS.map(b => {
    const P = { ...BASE, loops: l, braid: b }, E = [];
    for (let s = 1; s <= Math.min(N, 150); s++) E.push(evaluate(generate(P, s), P, []));
    const v = k => med(E.map(e => e.M.find(m => m.key === k).v));
    return `${f(mean(E.map(e => e.score)), 0)} / ${f(v('tort'))} / ${f(v('dead'))}`;
  });
  out(`| ${pct(l)} | ${row.join(' | ')} |`);
}

// --- D. Czego oceniacz nie widzi ---
out('\n## D. Nasycenie oceny\n');
const all = Object.values(fullRes).flat();
const perMetric = KEYS.concat(['var', 'uniq']).map(k => [k, all.filter(e => e.M.find(m => m.key === k).s >= 0.999).length / all.length]);
out('Odsetek układów (wszystkie algorytmy razem), które dostają 100% w danej cesze:\n');
out('| Cecha | Pełne punkty |\n|---|---|');
for (const [k, v] of perMetric) out(`| ${k} | ${pct(v)} |`);

fs.writeFileSync(path.join(__dirname, 'wyniki.md'), lines.join('\n') + '\n');

// --- E. Pętle losowe vs pętle-skróty (Brogue) ---
{
  const L2 = [];
  const o2 = s => { L2.push(s); console.log(s); };
  o2('\n## E. Pętle losowe kontra pętle-skróty\n');
  o2('Ta sama liczba otwieranych ścian. „Skróty” zawsze otwierają ścianę, której dwie strony są najdalej od siebie w grafie korytarzy (min. 6 komórek).\n');
  o2('| Algorytm | Tryb pętli | Śr. ocena | Krętość (med.) | Pokoje w pętlach (med.) | Najdł. prosta (med.) | ms / układ |');
  o2('|---|---|---|---|---|---|---|');
  for (const a of ['backtracker', 'growingMix', 'kruskal']) for (const mode of ['random', 'shortcut']) {
    const P = { ...BASE, maze: a, loopMode: mode }, E = [], n = Math.min(N, 150), t0 = Date.now();
    for (let s = 1; s <= n; s++) E.push(evaluate(generate(P, s), P, []));
    const v = k => med(E.map(e => e.M.find(m => m.key === k).v));
    o2(`| ${a} | ${mode === 'random' ? 'losowe' : 'skróty'} | ${f(mean(E.map(e => e.score)), 1)} | ${f(v('tort'))} | ${pct(v('lin'))} | ${pct(v('str'))} | ${f((Date.now() - t0) / n, 1)} |`);
  }
  fs.appendFileSync(path.join(__dirname, 'wyniki.md'), L2.join('\n') + '\n');
}
