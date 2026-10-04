// ===== RDZEŃ: generator + ocena (bez DOM) =====
const ROCK = 0, COR = 1, ROOM = 2, DOOR = 3, WIDE = 4, LOOP = 5;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ===== GRAF NAWIGACYJNY =====
// Pokój = 1 węzeł (indeks 0..R-1), komórka korytarza = 1 węzeł, otwarta ściana lub drzwi = krawędź
function navGraph(W, LW, LH, t, rid, R) {
  const at = (x, y) => y * W + x, cx = i => 2 * i + 1;
  const node = new Int32Array(LW * LH).fill(-1), corCells = [];
  for (let j = 0; j < LH; j++) for (let i = 0; i < LW; i++) {
    const k = at(cx(i), cx(j));
    if (!t[k]) continue;
    if (rid[k] >= 0) node[j * LW + i] = rid[k]; else { node[j * LW + i] = R + corCells.length; corCells.push([i, j]); }
  }
  const V = R + corCells.length, adj = Array.from({ length: V }, () => []), edges = [];
  for (let j = 0; j < LH; j++) for (let i = 0; i < LW; i++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    if (i + dx >= LW || j + dy >= LH) continue;
    const a = node[j * LW + i], b = node[(j + dy) * LW + i + dx];
    if (a < 0 || b < 0 || a === b || !t[at(cx(i) + dx, cx(j) + dy)]) continue;
    adj[a].push(b); adj[b].push(a); edges.push([a, b, cx(i) + dx, cx(j) + dy]);
  }
  return { node, corCells, V, adj, edges };
}
const edgeKey = (a, b) => a < b ? a + ',' + b : b + ',' + a;
// Mosty grafu (Tarjan): krawędzie, po których usunięciu graf się rozpada
function bridgeSet(V, adj) {
  const disc = new Int32Array(V).fill(-1), low = new Int32Array(V), out = new Set();
  let timer = 0;
  const dfs = (u, p) => {
    disc[u] = low[u] = timer++;
    let skipped = false;
    for (const v of adj[u]) {
      if (v === p && !skipped) { skipped = true; continue; }
      if (disc[v] < 0) { dfs(v, u); low[u] = Math.min(low[u], low[v]); if (low[v] > disc[u]) out.add(edgeKey(u, v)); }
      else low[u] = Math.min(low[u], disc[v]);
    }
  };
  for (let u = 0; u < V; u++) if (disc[u] < 0) dfs(u, -1);
  return out;
}
// Głębokość pułapki: ile kroków dzieli węzeł od najbliższej pętli, po której można uciekać przed pościgiem.
// 0 = węzeł leży na pętli. Pokój z jednymi drzwiami ma co najmniej 1.
function trapDepths(V, adj, bset) {
  const comp = new Int32Array(V).fill(-1), size = [];
  for (let s = 0; s < V; s++) {
    if (comp[s] >= 0) continue;
    const id = size.length, q = [s]; comp[s] = id;
    for (let h = 0; h < q.length; h++) for (const v of adj[q[h]]) if (comp[v] < 0 && !bset.has(edgeKey(q[h], v))) { comp[v] = id; q.push(v); }
    size.push(q.length);
  }
  const d = new Int32Array(V).fill(-1), q = [];
  for (let u = 0; u < V; u++) if (size[comp[u]] >= 2) { d[u] = 0; q.push(u); }
  for (let h = 0; h < q.length; h++) for (const v of adj[q[h]]) if (d[v] < 0) { d[v] = d[q[h]] + 1; q.push(v); }
  for (let u = 0; u < V; u++) if (d[u] < 0) d[u] = V; // brak jakiejkolwiek pętli
  return d;
}

// Odcinki bez wyboru: ciągi komórek korytarza o dokładnie 2 wyjściach między punktami decyzji
// (skrzyżowanie, pokój, zaułek). Zwraca listy węzłów każdego odcinka.
function corridorChains(g, R) {
  const deg = g.adj.map(a => a.length), isMid = n => n >= R && deg[n] === 2;
  const seen = new Uint8Array(g.V), chains = [];
  for (let n = 0; n < g.V; n++) {
    if (!isMid(n) || seen[n]) continue;
    // idź w obie strony od n aż do punktu decyzji
    const chain = [n]; seen[n] = 1;
    for (const dir of g.adj[n]) {
      let prev = n, cur = dir;
      const side = [];
      while (isMid(cur) && !seen[cur]) { seen[cur] = 1; side.push(cur); const nx = g.adj[cur][0] === prev ? g.adj[cur][1] : g.adj[cur][0]; prev = cur; cur = nx; }
      if (dir === g.adj[n][0]) chain.unshift(...side.reverse()); else chain.push(...side);
    }
    chains.push(chain);
  }
  return chains;
}

// ===== ALGORYTMY LABIRYNTU =====
// Każdy dostaje kontekst M i wypełnia wszystkie wolne komórki (poza pokojami) drzewem korytarzy.
const MAZES = {
  // DFS z powrotami: długie, kręte korytarze, mało rozgałęzień
  backtracker(M) {
    for (const s of M.shuffle([...Array(M.LW * M.LH).keys()])) {
      const si = s % M.LW, sj = (s / M.LW) | 0;
      if (M.carved(si, sj)) continue;
      M.carve(si, sj);
      const st = [[si, sj]];
      while (st.length) {
        const [i, j] = st[st.length - 1];
        const ns = DIRS.filter(([dx, dy]) => M.free(i + dx, j + dy));
        if (!ns.length) { st.pop(); continue; }
        const [dx, dy] = ns[M.ri(ns.length)];
        M.link(i, j, dx, dy); st.push([i + dx, j + dy]);
      }
    }
  },
  // Growing Tree: wybór komórki z listy aktywnych decyduje o fakturze
  growingTree(M, pick) {
    for (const s of M.shuffle([...Array(M.LW * M.LH).keys()])) {
      const si = s % M.LW, sj = (s / M.LW) | 0;
      if (M.carved(si, sj)) continue;
      M.carve(si, sj);
      const C = [[si, sj]];
      while (C.length) {
        const k = pick(C.length);
        const [i, j] = C[k];
        const ns = DIRS.filter(([dx, dy]) => M.free(i + dx, j + dy));
        if (!ns.length) { C.splice(k, 1); continue; }
        const [dx, dy] = ns[M.ri(ns.length)];
        M.link(i, j, dx, dy); C.push([i + dx, j + dy]);
      }
    }
  },
  // Prim (Growing Tree z losowym wyborem): krótkie odnogi, dużo zaułków
  prim(M) { MAZES.growingTree(M, n => M.ri(n)); },
  // Growing Tree 75% najnowsza / 25% losowa: kompromis między DFS a Primem
  growingMix(M) { MAZES.growingTree(M, n => (M.ri(4) ? n - 1 : M.ri(n))); },
  // Kruskal: losowe krawędzie + union-find; równomierna, „kłująca” faktura
  kruskal(M) {
    const N = M.LW * M.LH, par = [...Array(N).keys()], edges = [];
    const find = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
    for (let j = 0; j < M.LH; j++) for (let i = 0; i < M.LW; i++) {
      if (!M.free(i, j)) continue;
      if (M.free(i + 1, j)) edges.push([i, j, 1, 0]);
      if (M.free(i, j + 1)) edges.push([i, j, 0, 1]);
    }
    const cells = [];
    for (let j = 0; j < M.LH; j++) for (let i = 0; i < M.LW; i++) if (M.free(i, j)) cells.push([i, j]);
    cells.forEach(([i, j]) => M.carve(i, j));
    for (const [i, j, dx, dy] of M.shuffle(edges)) {
      const a = find(j * M.LW + i), b = find((j + dy) * M.LW + i + dx);
      if (a !== b) { par[a] = b; M.link(i, j, dx, dy); }
    }
  },
  // Wilson: błądzenie losowe z wymazywaniem pętli; jednostajnie losowe drzewo rozpinające
  wilson(M) {
    const N = M.LW * M.LH, regn = new Int32Array(N).fill(-1);
    let nr = 0;
    for (let s = 0; s < N; s++) {
      const si = s % M.LW, sj = (s / M.LW) | 0;
      if (regn[s] >= 0 || !M.free(si, sj)) continue;
      const q = [[si, sj]], cells = []; regn[s] = nr;
      while (q.length) { const [i, j] = q.pop(); cells.push([i, j]);
        for (const [dx, dy] of DIRS) { const ni = i + dx, nj = j + dy;
          if (M.free(ni, nj) && regn[nj * M.LW + ni] < 0) { regn[nj * M.LW + ni] = nr; q.push([ni, nj]); } } }
      const r = nr++, inTree = new Uint8Array(N), dir = new Int8Array(N).fill(-1);
      const [s0i, s0j] = cells[M.ri(cells.length)];
      inTree[s0j * M.LW + s0i] = 1; M.carve(s0i, s0j);
      for (const [ci, cj] of M.shuffle(cells)) {
        let i = ci, j = cj;
        while (!inTree[j * M.LW + i]) {
          const ns = [];
          for (let d = 0; d < 4; d++) { const ni = i + DIRS[d][0], nj = j + DIRS[d][1]; if (M.inL(ni, nj) && regn[nj * M.LW + ni] === r) ns.push(d); }
          const d = ns[M.ri(ns.length)];
          dir[j * M.LW + i] = d; i += DIRS[d][0]; j += DIRS[d][1];
        }
        i = ci; j = cj;
        while (!inTree[j * M.LW + i]) {
          const d = dir[j * M.LW + i];
          inTree[j * M.LW + i] = 1; M.carve(i, j); M.link(i, j, DIRS[d][0], DIRS[d][1]);
          i += DIRS[d][0]; j += DIRS[d][1];
        }
      }
    }
  },
  // Hunt-and-Kill: błądzenie bez powrotów, po utknięciu szukanie nowego startu przy istniejącym korytarzu
  huntAndKill(M) {
    for (const s of M.shuffle([...Array(M.LW * M.LH).keys()])) {
      let i = s % M.LW, j = (s / M.LW) | 0;
      if (M.carved(i, j)) continue;
      M.carve(i, j);
      for (;;) {
        const ns = DIRS.filter(([dx, dy]) => M.free(i + dx, j + dy));
        if (ns.length) { const [dx, dy] = ns[M.ri(ns.length)]; M.link(i, j, dx, dy); i += dx; j += dy; continue; }
        let found = false;
        for (let hj = 0; hj < M.LH && !found; hj++) for (let hi = 0; hi < M.LW && !found; hi++) {
          if (!M.free(hi, hj)) continue;
          const back = DIRS.filter(([dx, dy]) => M.isCor(hi + dx, hj + dy));
          if (!back.length) continue;
          const [dx, dy] = back[M.ri(back.length)];
          M.carve(hi, hj); M.link(hi + dx, hj + dy, -dx, -dy); i = hi; j = hj; found = true;
        }
        if (!found) break;
      }
    }
  },
  // Binary Tree: każda komórka łączy się na wschód albo na południe; silne ukośne ukierunkowanie
  binaryTree(M) {
    const cells = [];
    for (let j = 0; j < M.LH; j++) for (let i = 0; i < M.LW; i++) if (M.free(i, j)) cells.push([i, j]);
    const ok = new Set(cells.map(([i, j]) => j * M.LW + i));
    cells.forEach(([i, j]) => M.carve(i, j));
    for (const [i, j] of cells) {
      const opts = [[1, 0], [0, 1]].filter(([dx, dy]) => ok.has((j + dy) * M.LW + i + dx) && M.inL(i + dx, j + dy));
      if (opts.length) { const [dx, dy] = opts[M.ri(opts.length)]; M.link(i, j, dx, dy); }
    }
  },
};

function generate(P, seed) {
  const rng = mulberry32(seed);
  const W = P.W, H = P.H, LW = (W - 1) / 2, LH = (H - 1) / 2;
  const t = new Uint8Array(W * H);
  const rid = new Int16Array(W * H).fill(-1);
  const at = (x, y) => y * W + x;
  const cx = i => 2 * i + 1;
  const ri = n => Math.floor(rng() * n);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const stages = [];
  const snap = name => stages.push({ name, t: t.slice() });
  const inL = (i, j) => i >= 0 && i < LW && j >= 0 && j < LH;
  const carved = (i, j) => inL(i, j) && t[at(cx(i), cx(j))] > 0;
  const isCor = (i, j) => carved(i, j) && rid[at(cx(i), cx(j))] < 0;
  const roomOf = (i, j) => inL(i, j) ? rid[at(cx(i), cx(j))] : -1;
  // przejście z komórki (i,j) w kierunku (dx,dy): otwarta ściana i wykuta komórka po drugiej stronie
  const open = (i, j, dx, dy) => carved(i + dx, j + dy) && t[at(cx(i) + dx, cx(j) + dy)] > 0;
  const deg = (i, j) => DIRS.reduce((n, [dx, dy]) => n + (open(i, j, dx, dy) ? 1 : 0), 0);

  // 1. Pokoje (rozmiary w komórkach logicznych, odstęp min. 1 komórka)
  const sizes = [];
  if (P.s33) sizes.push([3, 3]);
  if (P.s34) sizes.push([3, 4], [4, 3]);
  if (P.s42) sizes.push([4, 2], [2, 4]);
  const rooms = [];
  if (sizes.length) {
    const avg = sizes.reduce((a, [w, h]) => a + w * h, 0) / sizes.length;
    const target = Math.max(1, Math.round(LW * LH * P.density / avg));
    for (let a = 0; a < 600 && rooms.length < target; a++) {
      const [w, h] = sizes[ri(sizes.length)];
      if (w > LW || h > LH) continue;
      const i = ri(LW - w + 1), j = ri(LH - h + 1);
      if (rooms.some(r => i < r.i + r.w + 1 && i + w + 1 > r.i && j < r.j + r.h + 1 && j + h + 1 > r.j)) continue;
      const id = rooms.length;
      rooms.push({ i, j, w, h });
      for (let y = cx(j); y <= 2 * (j + h) - 1; y++) for (let x = cx(i); x <= 2 * (i + w) - 1; x++) { t[at(x, y)] = ROOM; rid[at(x, y)] = id; }
    }
  }
  snap('Pokoje');

  // 2. Labirynt w wolnych komórkach (domyślnie Recursive Backtracker; P.maze wybiera inny algorytm)
  const M = { LW, LH, inL, carved, ri, shuffle,
    free: (i, j) => inL(i, j) && !carved(i, j),
    isCor: (i, j) => carved(i, j) && rid[at(cx(i), cx(j))] < 0,
    carve: (i, j) => { t[at(cx(i), cx(j))] = COR; },
    link: (i, j, dx, dy) => { t[at(cx(i) + dx, cx(j) + dy)] = COR; t[at(cx(i + dx), cx(j + dy))] = COR; } };
  (MAZES[P.maze || 'backtracker'] || MAZES.backtracker)(M);
  // regiony: pokoje mają id 0..R-1, każdy spójny kawałek korytarzy dostaje kolejne id
  const reg = new Int32Array(LW * LH).fill(-1);
  rooms.forEach((r, id) => { for (let j = r.j; j < r.j + r.h; j++) for (let i = r.i; i < r.i + r.w; i++) reg[j * LW + i] = id; });
  let nReg = rooms.length;
  for (let s = 0; s < LW * LH; s++) {
    const si = s % LW, sj = (s / LW) | 0;
    if (reg[s] >= 0 || !carved(si, sj)) continue;
    const r = nReg++, q = [[si, sj]]; reg[s] = r;
    while (q.length) {
      const [i, j] = q.pop();
      for (const [dx, dy] of DIRS) {
        const ni = i + dx, nj = j + dy;
        if (M.isCor(ni, nj) && reg[nj * LW + ni] < 0 && t[at(cx(i) + dx, cx(j) + dy)]) { reg[nj * LW + ni] = r; q.push([ni, nj]); }
      }
    }
  }
  snap('Labirynt');

  // 3. Drzwi: drzewo rozpinające regionów (Kruskal) + losowe dodatkowe drzwi
  const parent = [...Array(nReg).keys()];
  const find = x => { while (parent[x] !== x) x = parent[x] = parent[parent[x]]; return x; };
  const doorsOf = r => { let n = 0; for (let k = 0; k < t.length; k++) if (t[k] === DOOR && touchesRoom(k % W, (k / W) | 0) === r) n++; return n; };
  function touchesRoom(x, y) { for (const [dx, dy] of DIRS) { const k = at(x + dx, y + dy); if (rid[k] >= 0) return rid[k]; } return -1; }
  const nearDoor = (x, y) => { for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < H && t[at(xx, yy)] === DOOR) return true; return false; };
  const conns = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!((x + y) & 1) || t[at(x, y)] !== ROCK) continue;
    const [ax, ay, bx, by] = x % 2 === 0 ? [x - 1, y, x + 1, y] : [x, y - 1, x, y + 1];
    if (!t[at(ax, ay)] || !t[at(bx, by)]) continue;
    const ra = reg[((ay - 1) / 2) * LW + (ax - 1) / 2], rb = reg[((by - 1) / 2) * LW + (bx - 1) / 2];
    if (ra !== rb) conns.push([x, y, ra, rb, Math.max(rid[at(ax, ay)], rid[at(bx, by)])]);
  }
  for (const [x, y, ra, rb, room] of shuffle(conns)) {
    if (find(ra) !== find(rb)) { parent[find(ra)] = find(rb); t[at(x, y)] = room >= 0 ? DOOR : COR; }
    else if (room >= 0 && rng() < P.extraDoor && !nearDoor(x, y) && doorsOf(room) < 3) t[at(x, y)] = DOOR;
  }
  snap('Drzwi');

  // 4. Przerzedzenie: zjadanie ślepych zaułków → powstaje lita skała
  let K = 0;
  for (let j = 0; j < LH; j++) for (let i = 0; i < LW; i++) if (isCor(i, j)) K++;
  K = Math.round(K * P.sparse);
  while (K > 0) {
    const dead = [];
    for (let j = 0; j < LH; j++) for (let i = 0; i < LW; i++) if (isCor(i, j) && deg(i, j) <= 1) dead.push([i, j]);
    if (!dead.length) break;
    for (const [i, j] of shuffle(dead)) {
      if (K <= 0) break;
      if (deg(i, j) > 1) continue;
      for (const [dx, dy] of DIRS) if (open(i, j, dx, dy)) t[at(cx(i) + dx, cx(j) + dy)] = ROCK;
      t[at(cx(i), cx(j))] = ROCK; K--;
    }
  }
  snap('Przerzedzenie');

  // 5. Usuwanie części ślepych zaułków (przebicie do sąsiada, najchętniej innego zaułka)
  const deads = [];
  for (let j = 0; j < LH; j++) for (let i = 0; i < LW; i++) if (isCor(i, j) && deg(i, j) === 1) deads.push([i, j]);
  for (const [i, j] of shuffle(deads)) {
    if (deg(i, j) !== 1 || rng() >= P.braid) continue;
    const opts = DIRS.filter(([dx, dy]) => carved(i + dx, j + dy) && t[at(cx(i) + dx, cx(j) + dy)] === ROCK)
      .map(([dx, dy]) => ({ dx, dy, room: roomOf(i + dx, j + dy), dead: isCor(i + dx, j + dy) && deg(i + dx, j + dy) === 1 }))
      .filter(o => o.room < 0 || (!nearDoor(cx(i) + o.dx, cx(j) + o.dy) && doorsOf(o.room) < 4));
    if (!opts.length) continue;
    const pool = opts.filter(o => o.dead).length ? opts.filter(o => o.dead) : opts.filter(o => o.room < 0).length ? opts.filter(o => o.room < 0) : opts;
    const o = pool[ri(pool.length)];
    t[at(cx(i) + o.dx, cx(j) + o.dy)] = o.room >= 0 ? DOOR : LOOP;
  }
  snap('Zaułki');

  // 6. Pętle między korytarzami (bez ciasnych pętli 2×2)
  const tight = (i, j, dx, dy) => [[dy, dx], [-dy, -dx]].some(([px, py]) =>
    open(i, j, px, py) && open(i + dx, j + dy, px, py) && open(i + px, j + py, dx, dy));
  const lw = [];
  for (let j = 0; j < LH; j++) for (let i = 0; i < LW; i++) for (const [dx, dy] of [[1, 0], [0, 1]])
    if (isCor(i, j) && isCor(i + dx, j + dy) && t[at(cx(i) + dx, cx(j) + dy)] === ROCK) lw.push([i, j, dx, dy]);
  let nl = Math.round(lw.length * P.loops);
  if (P.loopMode === 'shortcut') {
    // Wariant „skrótów” (jak w Brogue): zawsze otwieraj ścianę, która najbardziej skraca drogę między jej stronami
    const cellDist = (si, sj, ti, tj) => {
      const d = new Int32Array(LW * LH).fill(-1), q = [[si, sj]]; d[sj * LW + si] = 0;
      for (let h = 0; h < q.length; h++) { const [i, j] = q[h];
        if (i === ti && j === tj) return d[j * LW + i];
        for (const [dx, dy] of DIRS) if (open(i, j, dx, dy) && d[(j + dy) * LW + i + dx] < 0) { d[(j + dy) * LW + i + dx] = d[j * LW + i] + 1; q.push([i + dx, j + dy]); } }
      return Infinity;
    };
    const cand = shuffle(lw).filter(w => !tight(...w));
    while (nl > 0 && cand.length) {
      let best = -1, bestD = -1;
      cand.forEach(([i, j, dx, dy], k) => { const d = cellDist(i, j, i + dx, j + dy); if (d > bestD) { bestD = d; best = k; } });
      if (bestD < (P.shortcutMin || 6)) break;
      const [i, j, dx, dy] = cand.splice(best, 1)[0];
      t[at(cx(i) + dx, cx(j) + dy)] = LOOP; nl--;
    }
  } else {
    for (const [i, j, dx, dy] of shuffle(lw)) {
      if (nl <= 0) break;
      if (tight(i, j, dx, dy)) continue;
      t[at(cx(i) + dx, cx(j) + dy)] = LOOP; nl--;
    }
  }
  snap('Pętle');

  // Przebija przejście z komórek startowych (przez maks. maxRock komórek litej skały) do wykutego miejsca,
  // które w grafie leży co najmniej minGraph węzłów dalej; wybiera cel najdalszy w grafie przy krótkiej drodze przez skałę.
  function openRoute(g, starts, fromNode, minGraph, maxRock) {
    const gd = new Int32Array(g.V).fill(-1), gq = [fromNode]; gd[fromNode] = 0;
    for (let h = 0; h < gq.length; h++) for (const v of g.adj[gq[h]]) if (gd[v] < 0) { gd[v] = gd[gq[h]] + 1; gq.push(v); }
    const prev = new Map(), q = [];
    for (const [i, j] of starts) { prev.set(j * LW + i, -1); q.push([i, j, 0]); }
    let best = null;
    for (let h = 0; h < q.length; h++) {
      const [i, j, len] = q[h];
      for (const [dx, dy] of DIRS) {
        const ni = i + dx, nj = j + dy, nk = nj * LW + ni;
        if (!inL(ni, nj) || t[at(cx(i) + dx, cx(j) + dy)] || prev.has(nk)) continue;
        if (carved(ni, nj)) {
          const tn = g.node[nk];
          if (tn === fromNode || gd[tn] < minGraph) continue;
          const score = gd[tn] - 2 * len;
          if (!best || score > best.score) best = { score, end: nk, from: j * LW + i };
          continue;
        }
        if (len >= maxRock) continue;
        prev.set(nk, j * LW + i); q.push([ni, nj, len + 1]);
      }
    }
    if (!best) return false;
    const path = [best.end];
    for (let k = best.from; k >= 0; k = prev.get(k)) path.push(k);
    for (let k = 0; k + 1 < path.length; k++) {
      const a = path[k], b = path[k + 1], ai = a % LW, aj = (a / LW) | 0, bi = b % LW, bj = (b / LW) | 0;
      if (!carved(ai, aj)) t[at(cx(ai), cx(aj))] = COR;
      if (!carved(bi, bj)) t[at(cx(bi), cx(bj))] = COR;
      const room = rid[at(cx(ai), cx(aj))] >= 0 || rid[at(cx(bi), cx(bj))] >= 0;
      t[at((cx(ai) + cx(bi)) / 2, (cx(aj) + cx(bj)) / 2)] = room ? DOOR : LOOP;
    }
    return true;
  }

  // 7. Ucieczka: żadne miejsce nie może leżeć dalej niż P.maxTrap kroków od pętli,
  // żeby potwór idący od wejścia nie zamknął gracza w ślepej kieszeni (dotyczy też pokoi z jednymi drzwiami)
  if ((P.maxTrap != null && P.maxTrap < 99) || P.roomExits) {
    if (P.maxTrap == null) P = { ...P, maxTrap: 99 };
    const skip = new Set();
    for (let it = 0; it < 150; it++) {
      const g = navGraph(W, LW, LH, t, rid, rooms.length);
      const dep = trapDepths(g.V, g.adj, bridgeSet(g.V, g.adj));
      const starts = [];
      let worst = -1;
      // pokój z jednym wyjściem to najgorsza pułapka, więc przy P.roomExits pokoje muszą leżeć na pętli
      const limit = n => n < rooms.length && P.roomExits !== false ? 0 : P.maxTrap;
      for (let n = 0; n < g.V; n++) if (dep[n] > limit(n) && (worst < 0 || dep[n] - limit(n) > dep[worst] - limit(worst))) {
        const c = n < rooms.length ? [rooms[n].i, rooms[n].j] : g.corCells[n - rooms.length];
        if (!skip.has(c.join())) worst = n;
      }
      if (worst < 0) break;
      for (let j = 0; j < LH; j++) for (let i = 0; i < LW; i++) if (g.node[j * LW + i] === worst) starts.push([i, j]);
      if (!openRoute(g, starts, worst, 4, 4)) skip.add((worst < rooms.length ? [rooms[worst].i, rooms[worst].j] : g.corCells[worst - rooms.length]).join());
    }
  }
  snap('Ucieczka');

  // 8. Skrzyżowania: żaden odcinek korytarza bez wyboru nie może być dłuższy niż P.maxRun komórek.
  // W środku za długiego odcinka powstaje rozwidlenie prowadzące w odległe miejsce grafu.
  if (P.maxRun != null && P.maxRun < 99) {
    const skip = new Set();
    for (let it = 0; it < 200; it++) {
      const g = navGraph(W, LW, LH, t, rid, rooms.length);
      const chains = corridorChains(g, rooms.length).filter(c => c.length > P.maxRun && !skip.has(c[0] + ':' + c.length));
      if (!chains.length) break;
      const chain = chains.reduce((a, b) => (b.length > a.length ? b : a));
      // kandydaci od środka odcinka na zewnątrz
      const mid = (chain.length - 1) / 2;
      const order = chain.map((n, k) => [n, Math.abs(k - mid)]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
      let done = false;
      for (const n of order) {
        if (Math.abs(chain.indexOf(n) - mid) > chain.length / 2 - 1) break; // nie przy samych końcach
        if (openRoute(g, [g.corCells[n - rooms.length]], n, 4, 3)) { done = true; break; }
      }
      if (!done) skip.add(chain[0] + ':' + chain.length);
    }
  }
  snap('Skrzyżowania');

  // 9. Poszerzenia: prosty odcinek 2–4 komórek dostaje drugi pas od strony litej skały
  const wc = [];
  for (let j = 0; j < LH; j++) for (let i = 0; i < LW; i++) for (const [dx, dy] of [[1, 0], [0, 1]]) for (let L = 2; L <= 4; L++) {
    let ok = true;
    for (let k = 0; k < L && ok; k++) ok = isCor(i + k * dx, j + k * dy) && (k === 0 || open(i + (k - 1) * dx, j + (k - 1) * dy, dx, dy));
    if (ok) for (const s of [1, -1]) wc.push([i, j, dx, dy, L, s]);
  }
  let nw = 0;
  for (const [i, j, dx, dy, L, s] of shuffle(wc)) {
    if (nw >= P.wide) break;
    const px = dy * s, py = dx * s;
    const x0 = cx(i), y0 = cx(j), x1 = cx(i + (L - 1) * dx), y1 = cx(j + (L - 1) * dy);
    let ok = true;
    for (let off = 1; off <= 2 && ok; off++) for (let k = -1; k <= (x1 - x0) + (y1 - y0) + 1 && ok; k++) {
      const x = x0 + k * dx + px * off, y = y0 + k * dy + py * off;
      ok = x >= 0 && y >= 0 && x < W && y < H && t[at(x, y)] === ROCK;
    }
    if (!ok) continue;
    for (let k = 0; k <= (x1 - x0) + (y1 - y0); k++) t[at(x0 + k * dx + px, y0 + k * dy + py)] = WIDE;
    nw++;
  }
  snap('Poszerzenia');

  return { W, H, LW, LH, t, rid, rooms, stages, seed };
}

// ===== OCENA =====
const band = (v, lo, hi, soft) => v >= lo && v <= hi ? 1 : Math.max(0, 1 - (v < lo ? lo - v : v - hi) / soft);

// odcisk przestrzenny: siatka 6×6 sektorów, w każdym udział pokoi i udział pól chodliwych
const SIG = 6;
function signature(G) {
  const sig = [];
  for (let sy = 0; sy < SIG; sy++) for (let sx = 0; sx < SIG; sx++) {
    const xa = Math.floor(sx * G.W / SIG), xb = Math.floor((sx + 1) * G.W / SIG), ya = Math.floor(sy * G.H / SIG), yb = Math.floor((sy + 1) * G.H / SIG);
    let room = 0, walk = 0, n = 0;
    for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) { const v = G.t[y * G.W + x]; n++; if (v === ROOM) room++; if (v) walk++; }
    sig.push(room / n, walk / n);
  }
  return sig;
}
// podobieństwo 0..1 z uwzględnieniem odbić lustrzanych; przeskalowane tak, że dwa losowe układy dają ok. 0.1–0.35, a prawie-duplikat ~1
function similarity(a, b) {
  let best = 0;
  for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    let d = 0;
    for (let y = 0; y < SIG; y++) for (let x = 0; x < SIG; x++) {
      const i = 2 * (y * SIG + x), j = 2 * ((fy ? SIG - 1 - y : y) * SIG + (fx ? SIG - 1 - x : x));
      d += Math.abs(a[i] - b[j]) * 1.5 + Math.abs(a[i + 1] - b[j + 1]);
    }
    best = Math.max(best, 1 - d / (SIG * SIG) / 1.2);
  }
  return Math.max(0, Math.min(1, (best - 0.6) / 0.4));
}

function evaluate(G, P, history) {
  const { W, H, LW, LH, t, rid, rooms } = G;
  const at = (x, y) => y * W + x, cx = i => 2 * i + 1, R = rooms.length;
  // spójność na poziomie kafli
  const bfs = (sx, sy) => {
    const d = new Int32Array(W * H).fill(-1), par = new Int32Array(W * H).fill(-1), q = [at(sx, sy)];
    d[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const k = q[h], x = k % W, y = (k / W) | 0;
      for (const [dx, dy] of DIRS) { const n = at(x + dx, y + dy); if (t[n] && d[n] < 0) { d[n] = d[k] + 1; par[n] = k; q.push(n); } }
    }
    return { d, par, n: q.length };
  };
  let walk = 0, first = -1;
  for (let k = 0; k < t.length; k++) if (t[k]) { walk++; if (first < 0) first = k; }
  const connected = walk > 0 && bfs(first % W, (first / W) | 0).n === walk;

  // graf nawigacyjny: pokój = 1 węzeł, komórka korytarza = 1 węzeł
  const { node, corCells, V, adj, edges } = navGraph(W, LW, LH, t, rid, R);
  const E = edges.length, degN = adj.map(a => a.length);
  const cycles = connected ? E - V + 1 : 0;
  const deadList = corCells.filter((_, k) => degN[R + k] === 1);
  const junctions = corCells.filter((_, k) => degN[R + k] >= 3).length;
  // kształty komórek korytarza
  const shapes = [0, 0, 0, 0, 0];
  corCells.forEach(([i, j], k) => {
    const d = degN[R + k];
    if (d <= 1) shapes[0]++;
    else if (d === 2) { const h = t[at(cx(i) - 1, cx(j))] && t[at(cx(i) + 1, cx(j))], v = t[at(cx(i), cx(j) - 1)] && t[at(cx(i), cx(j) + 1)]; shapes[h || v ? 1 : 2]++; }
    else shapes[d === 3 ? 3 : 4]++;
  });
  const nc = Math.max(1, corCells.length);
  const entropy = -shapes.reduce((s, c) => c ? s + c / nc * Math.log2(c / nc) : s, 0) / Math.log2(5);
  // mosty (Tarjan) + liczba pokoi w poddrzewie DFS
  const disc = new Int32Array(V).fill(-1), low = new Int32Array(V), sub = new Int32Array(V);
  let timer = 0; const bridges = [];
  const dfs = (u, p) => {
    disc[u] = low[u] = timer++; sub[u] = u < R ? 1 : 0;
    let skipped = false;
    for (const v of adj[u]) {
      if (v === p && !skipped) { skipped = true; continue; }
      if (disc[v] < 0) {
        dfs(v, u); sub[u] += sub[v]; low[u] = Math.min(low[u], low[v]);
        if (low[v] > disc[u]) bridges.push([u, v, sub[v]]);
      } else low[u] = Math.min(low[u], disc[v]);
    }
  };
  for (let u = 0; u < V; u++) if (disc[u] < 0) dfs(u, -1);
  const key = (a, b) => a < b ? a + ',' + b : b + ',' + a;
  const bset = new Set(bridges.map(([a, b]) => key(a, b)));
  // wąskie gardło = most, po którego obu stronach są pokoje
  const gate = new Set(bridges.filter(([, , k]) => k > 0 && k < R).map(([a, b]) => key(a, b)));
  const chokes = edges.filter(([a, b]) => gate.has(key(a, b)));
  // obszary 2-spójne krawędziowo (bez mostów): największy z nich to „rdzeń z pętlami”
  const comp = new Int32Array(V).fill(-1); let core = 0;
  for (let s0 = 0; s0 < V; s0++) {
    if (comp[s0] >= 0) continue;
    comp[s0] = s0; const q = [s0]; let rc = 0;
    for (let h = 0; h < q.length; h++) { const u = q[h]; if (u < R) rc++;
      for (const v of adj[u]) if (comp[v] < 0 && !bset.has(key(u, v))) { comp[v] = s0; q.push(v); } }
    core = Math.max(core, rc);
  }
  const coreFrac = R ? core / R : 0;
  // odcinki bez wyboru
  const chains = corridorChains({ V, adj }, R);
  const longest = chains.reduce((a, c) => (c.length > a.length ? c : a), []);
  const runAvg = chains.length ? chains.reduce((a, c) => a + c.length, 0) / chains.length : 0;
  const runCells = longest.map(n => corCells[n - R]);
  // pułapki: miejsca, z których jest tylko jedna droga do najbliższej pętli
  const tdep = trapDepths(V, adj, bset);
  let maxTrap = 0;
  for (let u = 0; u < V; u++) maxTrap = Math.max(maxTrap, tdep[u]);
  const trapCells = corCells.map(([i, j], k) => [i, j, tdep[R + k]]).filter(c => c[2] > 0);
  const trapRooms = rooms.map((_, r) => [r, tdep[r]]).filter(c => c[1] > 0);
  // trasy między pokojami
  const centers = rooms.map(r => [Math.round((cx(r.i) + 2 * (r.i + r.w) - 1) / 2) | 1, Math.round((cx(r.j) + 2 * (r.j + r.h) - 1) / 2) | 1]);
  let tSum = 0, tN = 0, far = { d: -1 };
  centers.forEach(([x, y], a) => {
    const B = bfs(x, y);
    centers.forEach(([x2, y2], b) => {
      if (b <= a) return;
      const d = B.d[at(x2, y2)]; if (d < 0) return;
      tSum += d / (Math.abs(x - x2) + Math.abs(y - y2)); tN++;
      if (d > far.d) { const path = []; for (let k = at(x2, y2); k >= 0; k = B.par[k]) path.push(k); far = { d, path }; }
    });
  });
  const tort = tN ? tSum / tN : 0;
  // najdłuższy prosty odcinek korytarza
  let straight = { len: 0 };
  const scan = (outer, inner, get) => {
    for (let o = 0; o < outer; o++) { let run = 0;
      for (let k = 0; k <= inner; k++) {
        const v = k < inner ? get(o, k) : 0;
        if (v && rid[v - 1] < 0) run++;
        else { if (run > straight.len) straight = { len: run, a: get(o, k - run) - 1, b: get(o, k - 1) - 1 }; run = 0; }
      }
    }
  };
  scan(H, W, (y, x) => t[at(x, y)] ? at(x, y) + 1 : 0);
  scan(W, H, (x, y) => t[at(x, y)] ? at(x, y) + 1 : 0);
  // rozkład pokoi w sektorach 3×3
  const sect = new Set(centers.map(([x, y]) => Math.min(2, Math.floor(x * 3 / W)) + 3 * Math.min(2, Math.floor(y * 3 / H))));
  const coverage = R ? sect.size / Math.min(9, R) : 0;
  // drzwi na pokój
  const doors = new Array(R).fill(0);
  for (let k = 0; k < t.length; k++) if (t[k] === DOOR) { const x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of DIRS) { const r = rid[at(x + dx, y + dy)]; if (r >= 0) { doors[r]++; break; } } }
  const doorAvg = R ? doors.reduce((a, b) => a + b, 0) / R : 0;
  const oneDoor = doors.filter(d => d === 1).length;
  const types = new Set(rooms.map(r => Math.min(r.w, r.h) + 'x' + Math.max(r.w, r.h)));
  const enabled = (P.s33 ? 1 : 0) + (P.s34 ? 1 : 0) + (P.s42 ? 1 : 0);
  let wideTiles = 0; for (let k = 0; k < t.length; k++) if (t[k] === WIDE) wideTiles++;

  const sig = signature(G);
  let maxSim = 0, simTo = null;
  for (const h of history || []) { const s = similarity(sig, h.sig); if (s > maxSim) { maxSim = s; simTo = h.seed; } }

  const M = [
    { key: 'loops', name: 'Pętle na pokój', v: cycles / Math.max(1, R), lo: 0.8, hi: 3.5, soft: 1, w: 1.2, f: 2, hint: 'Alternatywne drogi: gracz może obejść przeciwnika i nie wraca tą samą trasą.' },
    { key: 'dead', name: 'Ślepe zaułki na pokój', v: deadList.length / Math.max(1, R), lo: 0.2, hi: 1.0, soft: 1, w: 1, f: 2, hint: 'Kilka nagradza eksplorację (skrzynka, sekret); za dużo męczy cofaniem.' },
    { key: 'lin', name: 'Pokoje w pętlach', v: coreFrac, lo: 0.8, hi: 1, soft: 0.4, w: 1, f: 0, pct: true, hint: `Udział pokoi w największym obszarze z alternatywnymi drogami. Pozostałe ${R - core} leżą za wąskim gardłem (pomarańczowe), więc łatwo tam utknąć w pościgu. Pokój za gardłem ma sens tylko celowo, np. dla bossa.` },
    { key: 'tort', name: 'Krętość tras', v: tort, lo: 1.3, hi: 2.2, soft: 0.6, w: 1.2, f: 2, hint: 'Długość drogi między pokojami ÷ odległość w linii prostej. 1 = nudno prosto, >2.5 = frustrujący labirynt.' },
    { key: 'str', name: 'Najdłuższa prosta', v: straight.len / Math.max(W, H), lo: 0, hi: 0.35, soft: 0.3, w: 1, f: 0, pct: true, hint: 'Długi prosty korytarz to martwy czas i otwarta linia strzału.' },
    { key: 'junc', name: 'Skrzyżowania', v: junctions / nc, lo: 0.15, hi: 0.45, soft: 0.15, w: 0.8, f: 0, pct: true, hint: 'Udział komórek korytarza z 3–4 wyjściami: punkty decyzji gracza.' },
    { key: 'cov', name: 'Rozłożenie pokoi', v: coverage, lo: 0.75, hi: 1, soft: 0.45, w: 1, f: 0, pct: true, hint: 'Ile sektorów mapy 3×3 ma pokój. Skupione pokoje zostawiają puste połacie korytarzy.' },
    { key: 'door', name: 'Drzwi na pokój', v: doorAvg, lo: 1.5, hi: 2.6, soft: 1, w: 1, f: 2, hint: `Pokój z 1 drzwiami to ślepa kieszeń; jest ich ${oneDoor} z ${R}.` },
    { key: 'var', name: 'Różnorodność pokoi', v: enabled ? types.size / enabled : 0, lo: 1, hi: 1, soft: 0.7, w: 0.6, f: 0, pct: true, hint: `Użyte typy: ${[...types].join(', ') || 'brak'}.` },
    { key: 'ent', name: 'Różnorodność kształtów', v: entropy, lo: 0.65, hi: 1, soft: 0.35, w: 0.8, f: 0, pct: true, hint: 'Entropia typów komórek (prosta, zakręt, T, krzyż, zaułek). Niska = monotonne powtórzenia.' },
    { key: 'run', name: 'Korytarz bez wyboru', v: longest.length, lo: 0, hi: 6, soft: 8, w: 1.3, f: 0, hint: `Najdłuższy odcinek, na którym gracz nie ma żadnego rozwidlenia: ${longest.length} komórek (${2 * longest.length} kafli). Średnio ${runAvg.toFixed(1)} komórki między decyzjami.` },
    { key: 'trap', name: 'Pułapki', v: Math.min(maxTrap, 99), lo: 0, hi: 2, soft: 4, w: 1.5, f: 0, hint: maxTrap === 0 ? 'Każde miejsce leży na pętli: przed pościgiem zawsze da się uciec drugą stroną.' : `Najgłębsza ślepa kieszeń: ${maxTrap >= V ? 'cała mapa (brak pętli)' : maxTrap + ' kroków od najbliższej pętli'}. Pokoi-kieszeni: ${trapRooms.length}. Potwór idący od wejścia zamyka tam gracza (czerwone na mapie).` },
    { key: 'uniq', name: 'Unikalność', v: 1 - maxSim, lo: 0.45, hi: 1, soft: 0.35, w: 1.2, f: 0, pct: true, hint: history && history.length ? `Najbardziej podobny do zaakceptowanego #${simTo} (${Math.round(maxSim * 100)}%, z odbiciami lustrzanymi).` : 'Brak historii, więc nie ma z czym porównać.' },
  ];
  let sw = 0, ss = 0;
  for (const m of M) { m.s = band(m.v, m.lo, m.hi, m.soft); sw += m.w; ss += m.s * m.w; }
  const score = connected ? Math.round(ss / sw * 100) : 0;
  return { connected, score, M, maxSim, simTo, sig, seed: G.seed, cycles, V, E, wideTiles,
    deadList, chokes, straight, far, rooms: R, doors, trapCells, trapRooms, maxTrap, runCells };
}
if (typeof module !== 'undefined') module.exports = { MAZES, generate, evaluate, similarity, ROCK, COR, ROOM, DOOR, WIDE, LOOP };
