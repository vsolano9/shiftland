(() => {
  // spikes/plates/plates.ts
  var DX = [0, 1, 0, -1];
  var DY = [-1, 0, 1, 0];
  var DIR_NAME = ["N", "E", "S", "W"];
  function shift(lv, s, p, d) {
    const { w, h } = lv;
    let off = s.off;
    if (lv.axis) {
      if ((d === 1 || d === 3) !== (lv.axis[p] === 1)) return null;
      const sign = d === 1 || d === 2 ? 1 : -1;
      const o = (s.off ? s.off[p] : 0) + sign;
      if (Math.abs(o) > (lv.maxTravel ?? 2)) return null;
      off = (s.off ?? new Int8Array(lv.plates)).slice();
      off[p] = o;
    }
    const plate = s.plate.slice();
    const elev = s.elev.slice();
    const movers = [];
    for (let i = 0; i < w * h; i++) if (s.plate[i] === p) movers.push(i);
    if (movers.length === 0) return null;
    for (const i of movers) {
      const x = i % w + DX[d], y = Math.floor(i / w) + DY[d];
      if (x < 0 || y < 0 || x >= w || y >= h) return null;
    }
    const moverSet = new Set(movers);
    for (const i of movers) {
      plate[i] = -1;
      elev[i] = 0;
    }
    const remap = /* @__PURE__ */ new Map();
    for (const i of movers) {
      const j = i + DX[d] + DY[d] * w;
      remap.set(i, j);
      const wasOther = !moverSet.has(j) && s.plate[j] >= 0;
      plate[j] = p;
      elev[j] = wasOther ? Math.min(3, Math.max(s.elev[i], s.elev[j]) + 1) : s.elev[i];
    }
    const objs = s.objs.map((o) => remap.has(o.cell) ? { ...o, cell: remap.get(o.cell) } : o);
    return { plate, elev, objs, off };
  }
  function seaMask(lv, s) {
    const { w, h } = lv;
    const sea = new Uint8Array(w * h);
    const q = [];
    for (let i = 0; i < w * h; i++) {
      const x = i % w, y = Math.floor(i / w);
      if (s.plate[i] < 0 && (x === 0 || y === 0 || x === w - 1 || y === h - 1)) {
        sea[i] = 1;
        q.push(i);
      }
    }
    while (q.length) {
      const i = q.pop();
      const x = i % w, y = Math.floor(i / w);
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = nx + ny * w;
        if (!sea[j] && s.plate[j] < 0) {
          sea[j] = 1;
          q.push(j);
        }
      }
    }
    return sea;
  }
  function goalsMet(lv, s) {
    const { w, h } = lv;
    const sea = seaMask(lv, s);
    const isSeaAt = (x, y) => x < 0 || y < 0 || x >= w || y >= h ? true : sea[x + y * w] === 1;
    const out = [];
    for (const o of s.objs) {
      const land = s.plate[o.cell] >= 0;
      if (o.kind === "goat") out.push(land && s.elev[o.cell] >= 2);
      else if (o.kind === "village") out.push(land && s.elev[o.cell] <= 1);
      else {
        const x = o.cell % w, y = Math.floor(o.cell / w);
        out.push(land && [0, 1, 2, 3].some((d) => isSeaAt(x + DX[d], y + DY[d])));
      }
    }
    for (const b of lv.buoys) out.push(sea[b] === 1);
    return out;
  }
  var solved = (lv, s) => goalsMet(lv, s).every(Boolean);
  function key(s) {
    let k = "";
    for (let i = 0; i < s.plate.length; i++) k += String.fromCharCode(66 + s.plate[i] * 5 + s.elev[i]);
    return k + "|" + s.objs.map((o) => o.cell).join(",") + "|" + (s.off ? Array.from(s.off).join(",") : "");
  }
  function solve(lv, maxDepth) {
    if (solved(lv, lv.start)) return { min: 0, solutionsAtMin: 1, firstSolution: [], statesSeen: 1, deadEnds: 0 };
    let frontier = [{ s: lv.start, path: [], ways: 1 }];
    const seen = /* @__PURE__ */ new Map([[key(lv.start), 0]]);
    let deadEnds = 0;
    for (let depth = 1; depth <= maxDepth; depth++) {
      const next = /* @__PURE__ */ new Map();
      let found = [];
      for (const f of frontier) {
        let children = 0;
        for (let p = 0; p < lv.plates; p++) for (let d = 0; d < 4; d = d + 1) {
          const t = shift(lv, f.s, p, d);
          if (!t) continue;
          children++;
          const k = key(t);
          const prev = seen.get(k);
          if (prev !== void 0 && prev < depth) continue;
          const path = [...f.path, `P${p}${DIR_NAME[d]}`];
          if (solved(lv, t)) {
            found.push({ path, ways: f.ways });
            seen.set(k, depth);
            continue;
          }
          const ex = next.get(k);
          if (ex) ex.ways += f.ways;
          else {
            next.set(k, { s: t, path, ways: f.ways });
            seen.set(k, depth);
          }
        }
        if (children === 0) deadEnds++;
      }
      if (found.length) return { min: depth, solutionsAtMin: found.reduce((a, b) => a + b.ways, 0), firstSolution: found[0].path, statesSeen: seen.size, deadEnds };
      frontier = [...next.values()];
      if (frontier.length > 4e5) return null;
    }
    return null;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = a + 1831565813 >>> 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function generate(seed, w = 7, h = 7, plates = 3) {
    const r = rng(seed);
    const n = w * h;
    const plate = new Int8Array(n), elev = new Int8Array(n);
    const sites = Array.from({ length: plates }, () => [1 + Math.floor(r() * (w - 2)), 1 + Math.floor(r() * (h - 2))]);
    for (let i = 0; i < n; i++) {
      const x = i % w, y = Math.floor(i / w);
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        plate[i] = -1;
        continue;
      }
      let best = 0, bd = 1e9;
      sites.forEach(([sx, sy], k) => {
        const dd = (sx - x) ** 2 + (sy - y) ** 2;
        if (dd < bd) {
          bd = dd;
          best = k;
        }
      });
      plate[i] = best;
      elev[i] = r() < 0.15 ? 1 : 0;
    }
    const land = [...Array(n).keys()].filter((i) => plate[i] >= 0);
    const water = [...Array(n).keys()].filter((i) => plate[i] < 0);
    const pick = (arr) => arr.splice(Math.floor(r() * arr.length), 1)[0];
    const place = typeof process !== "undefined" && !!process.env.PLACE;
    const seam = (i) => {
      const x = i % w, y = Math.floor(i / w);
      return [0, 1, 2, 3].some((d) => {
        const j = x + DX[d] + (y + DY[d]) * w;
        return plate[j] >= 0 && plate[j] !== plate[i];
      });
    };
    const seamLand = land.filter(seam);
    const pickSeam = () => {
      if (place && seamLand.length) {
        const c2 = pick(seamLand);
        land.splice(land.indexOf(c2), 1);
        return c2;
      }
      const c = pick(land);
      const k = seamLand.indexOf(c);
      if (k >= 0) seamLand.splice(k, 1);
      return c;
    };
    const objs = [];
    const goats = 1 + Math.floor(r() * 2), villages = Math.floor(r() * 3), lights = Math.floor(r() * 2);
    for (let i = 0; i < goats; i++) objs.push({ kind: "goat", cell: pickSeam() });
    for (let i = 0; i < villages; i++) objs.push({ kind: "village", cell: pickSeam() });
    for (let i = 0; i < lights; i++) {
      const c = pick(land);
      const k = seamLand.indexOf(c);
      if (k >= 0) seamLand.splice(k, 1);
      objs.push({ kind: "light", cell: c });
    }
    const interior = land.filter((i) => {
      const x = i % w, y = Math.floor(i / w);
      return x > 1 && y > 1 && x < w - 2 && y < h - 2 && (!place || seam(i));
    });
    const buoys = r() < 0.5 && interior.length ? [pick(interior)] : [];
    void water;
    const lv = { w, h, plates, start: { plate, elev, objs }, buoys };
    const axisEnv = typeof process !== "undefined" ? process.env.AXIS : void 0;
    if (axisEnv) {
      lv.axis = Array.from({ length: plates }, () => r() < 0.5 ? 0 : 1);
      lv.maxTravel = Number(axisEnv);
    }
    return lv;
  }
  function landShare(lv, s) {
    const count = (st) => st.plate.reduce((a, p) => a + (p >= 0 ? 1 : 0), 0);
    return count(s) / count(lv.start);
  }
  function render(lv, s) {
    const sea = seaMask(lv, s);
    const rows = [];
    for (let y = 0; y < lv.h; y++) {
      let row = "";
      for (let x = 0; x < lv.w; x++) {
        const i = x + y * lv.w;
        const o = s.objs.find((o2) => o2.cell === i);
        const b = lv.buoys.includes(i);
        if (s.plate[i] < 0) row += b ? " ~*" : sea[i] ? " ~~" : " ..";
        else row += " " + "abcdefgh"[s.plate[i]] + (o ? o.kind[0].toUpperCase() : b ? "*" : String(s.elev[i]));
      }
      rows.push(row);
    }
    return rows.join("\n");
  }
  var parseMove = (m) => [Number(m[1]), "NESW".indexOf(m[2])];
  var applyAll = (lv, s, ms) => {
    for (const m of ms) {
      const [p, d] = parseMove(m);
      const t = shift(lv, s, p, d);
      if (!t) return null;
      s = t;
    }
    return s;
  };
  function permutations(a) {
    if (a.length <= 1) return [a];
    const out = [];
    a.forEach((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).forEach((p) => out.push([x, ...p])));
    return out;
  }
  function minPlateKept(lv, s) {
    let worst = 1;
    for (let p = 0; p < lv.plates; p++) {
      const a = lv.start.plate.reduce((n, q) => n + (q === p ? 1 : 0), 0), b = s.plate.reduce((n, q) => n + (q === p ? 1 : 0), 0);
      if (a) worst = Math.min(worst, b / a);
    }
    return worst;
  }
  function audit(lv, maxDepth = 6, minMoves = 3) {
    const r = solve(lv, maxDepth);
    if (!r) return null;
    const why = [];
    const end = applyAll(lv, lv.start, r.firstSolution);
    const land = landShare(lv, end);
    const plateKept = minPlateKept(lv, end);
    const perms = r.firstSolution.length <= 6 ? permutations(r.firstSolution) : [];
    const orderMatters = perms.some((p) => {
      const s = applyAll(lv, lv.start, p);
      return !s || !solved(lv, s);
    });
    const met0 = goalsMet(lv, lv.start);
    let temptingWrong = false;
    let tempting;
    for (let p = 0; p < lv.plates && !temptingWrong; p++) for (let d = 0; d < 4; d = d + 1) {
      const t = shift(lv, lv.start, p, d);
      if (!t || !goalsMet(lv, t).some((m, k) => m && !met0[k])) continue;
      const rest = solve({ ...lv, start: t }, maxDepth);
      if (!rest || rest.min > r.min - 1) {
        temptingWrong = true;
        tempting = { move: `P${p}${DIR_NAME[d]}`, finish: rest ? 1 + rest.min : null };
        break;
      }
    }
    if (r.min < minMoves) why.push(`min ${r.min} < ${minMoves}`);
    if (!orderMatters) why.push("order does not matter");
    if (!temptingWrong) why.push("no tempting wrong move");
    if (land < 0.6) why.push(`land kept ${(land * 100).toFixed(0)}%`);
    if (plateKept < 0.5) why.push(`a plate keeps ${(plateKept * 100).toFixed(0)}%`);
    return { pass: why.length === 0, min: r.min, temptingWrong, orderMatters, land, plateKept, why, tempting };
  }
  function selfCheck() {
    const lv = { w: 5, h: 3, plates: 2, buoys: [], start: {
      plate: Int8Array.from([-1, -1, -1, -1, -1, -1, 0, 1, 1, -1, -1, -1, -1, -1, -1]),
      elev: new Int8Array(15),
      objs: [{ kind: "goat", cell: 7 }]
    } };
    const t = shift(lv, lv.start, 0, 1);
    if (t.plate[6] !== -1 || t.plate[7] !== 0 || t.elev[7] !== 1) throw new Error("uplift/rift rule broken");
    if (t.objs[0].cell !== 7) throw new Error("object on the overridden cell should stay (lifted)");
    const t2 = shift(lv, t, 0, 1);
    if (t2.elev[8] !== 2 || t2.plate[8] !== 0) throw new Error("second push should stack uplift");
    const e1 = shift(lv, lv.start, 1, 1);
    if (shift(lv, e1, 1, 1) !== null) throw new Error("moving off the grid must be illegal");
    const edge = { w: 3, h: 3, plates: 1, buoys: [], start: {
      plate: new Int8Array(9),
      elev: new Int8Array(9),
      objs: [{ kind: "light", cell: 1 }]
    } };
    if (!goalsMet(edge, edge.start)[0]) throw new Error("edge lighthouse should see the ocean");
    console.log("self-check ok");
  }
  function auditMain(count) {
    if (process.env.AXIS === "2" && !process.env.PLACE) {
      const a191 = audit(generate(191));
      if (!a191?.temptingWrong) throw new Error("seed 191: a goal flipping false->true must count as tempting");
    }
    const fails = /* @__PURE__ */ new Map();
    const passed = [];
    let solvable = 0;
    for (let seed = 1; seed <= count; seed++) {
      const lv = generate(seed);
      const a = audit(lv);
      if (!a) continue;
      solvable++;
      if (a.pass) {
        const t = a.tempting;
        if (t.finish !== null && t.finish <= a.min) throw new Error(`seed ${seed}: tempting ${t.move} finishes at par`);
        passed.push({ seed, a });
      }
      for (const w of a.why) {
        const k = w.replace(/\d+%|\d+ < \d+/, "n");
        fails.set(k, (fails.get(k) ?? 0) + 1);
      }
    }
    console.log(`audit: ${count} generated, ${solvable} solvable <= 6, ${passed.length} pass the quality bar`);
    console.log("failure reasons:", Object.fromEntries(fails));
    const byMin = /* @__PURE__ */ new Map();
    passed.forEach((p) => byMin.set(p.a.min, (byMin.get(p.a.min) ?? 0) + 1));
    console.log("passing levels by min moves:", Object.fromEntries([...byMin.entries()].sort()));
    for (const p of passed.slice(0, 2)) {
      const lv = generate(p.seed);
      const t = p.a.tempting;
      console.log(`
seed ${p.seed}: min ${p.a.min}, land kept ${(p.a.land * 100).toFixed(0)}%, tempting ${t.move} -> ${t.finish === null ? "no finish <= 6" : `finish in ${t.finish} (par ${p.a.min})`}`);
      console.log(render(lv, lv.start));
    }
  }
  function main() {
    selfCheck();
    if (process.env.AUDIT) {
      auditMain(Number(process.argv[2] ?? 300));
      return;
    }
    const count = Number(process.argv[2] ?? 300);
    const hist = /* @__PURE__ */ new Map();
    const good = [];
    let unsolvable = 0, trivial = 0;
    const landKept = [];
    for (let seed = 1; seed <= count; seed++) {
      const lv = generate(seed);
      const r = solve(lv, 6);
      if (!r) {
        unsolvable++;
        hist.set("none<=6", (hist.get("none<=6") ?? 0) + 1);
        continue;
      }
      hist.set(String(r.min), (hist.get(String(r.min)) ?? 0) + 1);
      if (r.min <= 1) trivial++;
      if (r.min >= 4 && r.solutionsAtMin <= 4) good.push({ seed, r });
      let s = lv.start;
      for (const m of r.firstSolution) s = shift(lv, s, Number(m[1]), "NESW".indexOf(m[2]));
      landKept.push(landShare(lv, s));
    }
    landKept.sort((a, b) => a - b);
    console.log(`land kept after solution: median ${(landKept[landKept.length >> 1] * 100).toFixed(0)}%, worst ${(landKept[0] * 100).toFixed(0)}%`);
    console.log(`levels: ${count}  unsolvable<=6: ${unsolvable}  trivial(<=1 move): ${trivial}`);
    console.log("min-move histogram:", Object.fromEntries([...hist.entries()].sort()));
    console.log(`"puzzle-grade" (min>=4 and <=4 shortest solutions): ${good.length}`);
    for (const g of good.slice(0, 3)) {
      const lv = generate(g.seed);
      console.log(`
seed ${g.seed}: min ${g.r.min}, shortest solutions ${g.r.solutionsAtMin}, states ${g.r.statesSeen}`);
      console.log(render(lv, lv.start));
      let s = lv.start;
      for (const m of g.r.firstSolution) {
        s = shift(lv, s, Number(m[1]), "NESW".indexOf(m[2]));
      }
      console.log("solution:", g.r.firstSolution.join(" "));
      console.log(render(lv, s));
    }
  }
  if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("plates.ts")) main();

  // spikes/plates/levels.json
  var levels_default = [{ name: "First Peak", seed: 0, w: 6, h: 4, plates: 2, axis: [1, 1], maxTravel: 2, plate: [-1, -1, -1, -1, -1, -1, -1, 0, 0, 1, 1, -1, -1, 0, 0, 1, 1, -1, -1, -1, -1, -1, -1, -1], elev: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0], objs: [{ kind: "goat", cell: 9 }], buoys: [], par: 1 }, { name: "Open Water", seed: 0, w: 7, h: 4, plates: 2, axis: [1, 1], maxTravel: 2, plate: [-1, -1, -1, -1, -1, -1, -1, -1, 0, 0, 0, 1, 1, -1, -1, 0, 0, 0, 1, 1, -1, -1, -1, -1, -1, -1, -1, -1], elev: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], objs: [], buoys: [10], par: 1 }, { name: "Mind the Village", seed: 0, w: 6, h: 4, plates: 2, axis: [1, 0], maxTravel: 2, plate: [-1, -1, -1, -1, -1, -1, -1, 0, 0, 1, 1, -1, -1, 0, 0, 1, 1, -1, -1, -1, -1, -1, -1, -1], elev: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0], objs: [{ kind: "goat", cell: 9 }, { kind: "village", cell: 15 }], buoys: [], par: 2 }, { name: "Two Wishes", seed: 0, w: 7, h: 5, plates: 3, axis: [1, 1, 0], maxTravel: 2, plate: [-1, -1, -1, -1, -1, -1, -1, -1, 0, 0, 1, 1, 1, -1, -1, 0, 0, 1, 1, 1, -1, -1, 2, 2, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1], elev: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], objs: [{ kind: "goat", cell: 10 }], buoys: [18], par: 2 }, { name: "Dip and Return", seed: 56, w: 6, h: 5, plates: 2, axis: [1, 0], maxTravel: 2, plate: [-1, -1, -1, -1, -1, -1, -1, 0, 1, 1, 1, -1, -1, 0, 0, 1, 1, -1, -1, 0, 0, 1, 1, -1, -1, -1, -1, -1, -1, -1], elev: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0], objs: [{ kind: "goat", cell: 7 }, { kind: "goat", cell: 21 }, { kind: "village", cell: 15 }], buoys: [], par: 3 }, { name: "Puzzle 1", seed: 4, w: 7, h: 7, plates: 3, axis: [0, 1, 0], maxTravel: 2, plate: [-1, -1, -1, -1, -1, -1, -1, -1, 1, 1, 1, 0, 0, -1, -1, 1, 1, 1, 0, 0, -1, -1, 2, 2, 2, 0, 0, -1, -1, 2, 2, 2, 0, 0, -1, -1, 2, 2, 2, 2, 0, -1, -1, -1, -1, -1, -1, -1, -1], elev: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0], objs: [{ kind: "goat", cell: 32 }, { kind: "goat", cell: 18 }, { kind: "village", cell: 16 }, { kind: "village", cell: 24 }], buoys: [25], par: 3 }, { name: "Puzzle 2", seed: 12, w: 7, h: 7, plates: 3, axis: [1, 0, 0], maxTravel: 2, plate: [-1, -1, -1, -1, -1, -1, -1, -1, 2, 0, 0, 0, 0, -1, -1, 2, 0, 0, 0, 0, -1, -1, 2, 0, 1, 1, 1, -1, -1, 1, 1, 1, 1, 1, -1, -1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, -1, -1], elev: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], objs: [{ kind: "goat", cell: 16 }, { kind: "village", cell: 22 }, { kind: "light", cell: 18 }], buoys: [23], par: 3 }, { name: "Puzzle 3", seed: 15, w: 7, h: 7, plates: 3, axis: [1, 1, 1], maxTravel: 2, plate: [-1, -1, -1, -1, -1, -1, -1, -1, 0, 0, 1, 1, 1, -1, -1, 0, 0, 1, 1, 1, -1, -1, 0, 0, 1, 1, 1, -1, -1, 2, 2, 1, 1, 1, -1, -1, 2, 2, 2, 1, 1, -1, -1, -1, -1, -1, -1, -1, -1], elev: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], objs: [{ kind: "goat", cell: 30 }, { kind: "goat", cell: 10 }, { kind: "light", cell: 12 }], buoys: [31], par: 3 }, { name: "Puzzle 4", seed: 58, w: 7, h: 7, plates: 3, axis: [0, 0, 1], maxTravel: 2, plate: [-1, -1, -1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, -1, -1, 0, 0, 1, 1, 2, -1, -1, 0, 0, 0, 2, 2, -1, -1, 0, 0, 0, 0, 2, -1, -1, 0, 0, 0, 0, 2, -1, -1, -1, -1, -1, -1, -1, -1], elev: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], objs: [{ kind: "goat", cell: 19 }, { kind: "goat", cell: 25 }, { kind: "village", cell: 9 }, { kind: "village", cell: 12 }, { kind: "light", cell: 37 }], buoys: [16], par: 3 }, { name: "Puzzle 5", seed: 7, w: 7, h: 7, plates: 3, axis: [0, 0, 1], maxTravel: 2, plate: [-1, -1, -1, -1, -1, -1, -1, -1, 0, 0, 0, 2, 2, -1, -1, 0, 0, 2, 2, 1, -1, -1, 0, 2, 2, 2, 1, -1, -1, 2, 2, 2, 1, 1, -1, -1, 2, 2, 2, 1, 1, -1, -1, -1, -1, -1, -1, -1, -1], elev: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], objs: [{ kind: "goat", cell: 25 }, { kind: "goat", cell: 38 }, { kind: "village", cell: 31 }, { kind: "village", cell: 10 }, { kind: "light", cell: 12 }], buoys: [18], par: 4 }, { name: "Puzzle 6", seed: 34, w: 7, h: 7, plates: 3, axis: [1, 0, 1], maxTravel: 2, plate: [-1, -1, -1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 0, -1, -1, 1, 1, 1, 0, 0, -1, -1, 1, 1, 0, 0, 0, -1, -1, 2, 2, 0, 0, 0, -1, -1, 2, 2, 0, 0, 0, -1, -1, -1, -1, -1, -1, -1, -1], elev: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], objs: [{ kind: "goat", cell: 24 }, { kind: "goat", cell: 23 }, { kind: "village", cell: 31 }, { kind: "light", cell: 36 }], buoys: [30], par: 4 }, { name: "Puzzle 7", seed: 56, w: 7, h: 7, plates: 3, axis: [0, 0, 1], maxTravel: 2, plate: [-1, -1, -1, -1, -1, -1, -1, -1, 0, 0, 1, 1, 1, -1, -1, 0, 0, 1, 1, 1, -1, -1, 0, 0, 2, 1, 1, -1, -1, 0, 0, 2, 2, 1, -1, -1, 0, 0, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1], elev: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0], objs: [{ kind: "goat", cell: 33 }, { kind: "village", cell: 40 }, { kind: "light", cell: 29 }], buoys: [32], par: 4 }, { name: "Puzzle 8", seed: 57, w: 7, h: 7, plates: 3, axis: [0, 0, 0], maxTravel: 2, plate: [-1, -1, -1, -1, -1, -1, -1, -1, 1, 0, 0, 0, 0, -1, -1, 1, 0, 0, 0, 0, -1, -1, 1, 1, 2, 0, 0, -1, -1, 1, 1, 2, 2, 2, -1, -1, 1, 1, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1], elev: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], objs: [{ kind: "goat", cell: 30 }, { kind: "goat", cell: 24 }], buoys: [25], par: 4 }];

  // spikes/plates/play.ts
  var LEVELS = levels_default.map((r) => ({
    name: r.name,
    par: r.par,
    lv: {
      w: r.w,
      h: r.h,
      plates: r.plates,
      axis: r.axis,
      maxTravel: r.maxTravel,
      buoys: r.buoys,
      start: { plate: Int8Array.from(r.plate), elev: Int8Array.from(r.elev), objs: r.objs }
    }
  }));
  var PLATE_COL = ["#d9a441", "#86a96a", "#a58ad1", "#d1708a"];
  var ICON = { goat: "\u{1F410}", village: "\u{1F3D8}\uFE0F", light: "\u{1F5FC}" };
  var GOAL_TEXT = { goat: "Goat on a mountain (height 2+)", village: "Village dry and not crushed", light: "Lighthouse on the coast" };
  var CELL = 64;
  var cv = document.getElementById("board");
  var ctx = cv.getContext("2d");
  var ui = {
    title: document.getElementById("title"),
    moves: document.getElementById("moves"),
    goals: document.getElementById("goals"),
    msg: document.getElementById("msg"),
    select: document.getElementById("levels")
  };
  var li = 0;
  var history = [];
  var sel = 0;
  var preview = null;
  var cur = () => history[history.length - 1];
  var L = () => LEVELS[li].lv;
  function load(i) {
    li = i;
    history = [L().start];
    sel = 0;
    preview = null;
    ui.select.value = String(i);
    draw();
  }
  function tryMove(d, commit) {
    const t = shift(L(), cur(), sel, d);
    if (commit && t) {
      history.push(t);
      preview = null;
    }
    return t;
  }
  function drawState(s, ghost) {
    const lv = L();
    const sea = seaMask(lv, s);
    for (let i = 0; i < lv.w * lv.h; i++) {
      const x = i % lv.w * CELL, y = (i / lv.w | 0) * CELL;
      ctx.globalAlpha = ghost ? 0.55 : 1;
      if (s.plate[i] < 0) {
        ctx.fillStyle = sea[i] ? "#2bb3c0" : "#2f7d6a";
        ctx.fillRect(x, y, CELL, CELL);
      } else {
        ctx.fillStyle = PLATE_COL[s.plate[i]];
        ctx.fillRect(x, y, CELL, CELL);
        for (let h = 0; h < s.elev[i]; h++) {
          ctx.fillStyle = "rgba(60,40,20,0.28)";
          ctx.fillRect(x + 6 + h * 6, y + 6 + h * 6, CELL - 12 - h * 12, CELL - 12 - h * 12);
        }
        if (s.elev[i] >= 3) {
          ctx.fillStyle = "#fff";
          ctx.fillRect(x + 24, y + 24, 16, 16);
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.lineWidth = 3;
    for (let i = 0; i < lv.w * lv.h; i++) {
      if (s.plate[i] < 0) continue;
      const cx = i % lv.w, cy = i / lv.w | 0;
      const edges = [[0, -1, 0, 0, 1], [1, 0, 1, 0, 0], [0, 1, 0, 1, 1], [-1, 0, 0, 0, 0]];
      for (const [dx, dy, ox, oy, horiz] of edges) {
        const nx = cx + dx, ny = cy + dy;
        const other = nx < 0 || ny < 0 || nx >= lv.w || ny >= lv.h ? -2 : s.plate[nx + ny * lv.w];
        if (other === s.plate[i]) continue;
        ctx.strokeStyle = s.plate[i] === sel ? "#ffffff" : "rgba(30,20,10,0.8)";
        ctx.beginPath();
        const x0 = (cx + ox) * CELL, y0 = (cy + oy) * CELL;
        ctx.moveTo(x0, y0);
        ctx.lineTo(horiz ? x0 + CELL : x0, horiz ? y0 : y0 + CELL);
        ctx.stroke();
      }
    }
    ctx.font = "30px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const met = goalsMet(lv, s);
    s.objs.forEach((o, k) => {
      const x = o.cell % lv.w * CELL + CELL / 2, y = (o.cell / lv.w | 0) * CELL + CELL / 2;
      ctx.fillText(ICON[o.kind], x, y);
      ctx.fillStyle = met[k] ? "#2ecc40" : "#e74c3c";
      ctx.beginPath();
      ctx.arc(x + 22, y - 22, 6, 0, 7);
      ctx.fill();
    });
    lv.buoys.forEach((b, k) => {
      const x = b % lv.w * CELL + CELL / 2, y = (b / lv.w | 0) * CELL + CELL / 2;
      ctx.fillText("\u{1F6DF}", x, y);
      ctx.fillStyle = met[s.objs.length + k] ? "#2ecc40" : "#e74c3c";
      ctx.beginPath();
      ctx.arc(x + 22, y - 22, 6, 0, 7);
      ctx.fill();
    });
  }
  function drawRail() {
    const lv = L();
    const s = cur();
    const cells = [];
    for (let i = 0; i < lv.w * lv.h; i++) if (s.plate[i] === sel) cells.push(i);
    if (!cells.length) return;
    const cx = cells.reduce((a2, i) => a2 + i % lv.w, 0) / cells.length, cy = cells.reduce((a2, i) => a2 + (i / lv.w | 0), 0) / cells.length;
    const horiz = lv.axis[sel] === 1;
    const off = s.off ? s.off[sel] : 0;
    const mt = lv.maxTravel ?? 2;
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.lineWidth = 4;
    const px = (cx + 0.5) * CELL, py = (cy + 0.5) * CELL;
    const a = (k) => horiz ? [px + (k - off) * CELL, py] : [px, py + (k - off) * CELL];
    ctx.beginPath();
    const [x0, y0] = a(-mt), [x1, y1] = a(mt);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    for (let k = -mt; k <= mt; k++) {
      const [x, y] = a(k);
      ctx.beginPath();
      ctx.arc(x, y, k === off ? 9 : 5, 0, 7);
      ctx.fill();
    }
  }
  function draw() {
    const lv = L();
    cv.width = lv.w * CELL;
    cv.height = lv.h * CELL;
    drawState(cur(), false);
    if (preview) drawState(preview, true);
    drawRail();
    const moves = history.length - 1;
    ui.title.textContent = LEVELS[li].name;
    ui.moves.textContent = `Moves ${moves} \xB7 Par ${LEVELS[li].par}`;
    const met = goalsMet(lv, cur());
    const labels = [...cur().objs.map((o) => `${ICON[o.kind]} ${GOAL_TEXT[o.kind]}`), ...lv.buoys.map(() => "\u{1F6DF} Buoy in the open sea")];
    ui.goals.innerHTML = labels.map((t, k) => `<li class="${met[k] ? "ok" : ""}">${met[k] ? "\u2714" : "\u25CB"} ${t}</li>`).join("");
    if (solved(lv, cur())) ui.msg.textContent = moves <= LEVELS[li].par ? `Solved at par! \u2605  (Enter: next level)` : `Solved in ${moves} (par ${LEVELS[li].par}). Enter: next, R: retry for par`;
    else ui.msg.textContent = "Click a plate (or Tab), arrow keys slide it along its rail. Hold Shift + arrow to preview. Z undo, R restart.";
    window.__plates = { level: li, moves, solved: solved(lv, cur()), sel, preview: preview !== null };
  }
  var KEY_DIR = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
  addEventListener("keydown", (e) => {
    if (e.key in KEY_DIR) {
      e.preventDefault();
      if (e.shiftKey) {
        preview = tryMove(KEY_DIR[e.key], false);
        draw();
        return;
      }
      if (!tryMove(KEY_DIR[e.key], true)) {
        ui.msg.textContent = "That plate cannot move that way (rail end or map edge).";
        return;
      }
      draw();
    } else if (e.key === "Tab") {
      e.preventDefault();
      sel = (sel + 1) % L().plates;
      preview = null;
      draw();
    } else if (e.key === "z" || e.key === "Z") {
      if (history.length > 1) history.pop();
      preview = null;
      draw();
    } else if (e.key === "r" || e.key === "R") {
      load(li);
    } else if (e.key === "Enter" && solved(L(), cur()) && li + 1 < LEVELS.length) load(li + 1);
    else if (e.key === "h" || e.key === "H") {
      const r = solve({ ...L(), start: cur() }, 6);
      ui.msg.textContent = r ? `Hint: ${r.firstSolution[0]} (P = plate number by colour order)` : "No solution from here within 6 moves: undo.";
    }
  });
  addEventListener("keyup", (e) => {
    if (e.key === "Shift") {
      preview = null;
      draw();
    }
  });
  cv.addEventListener("click", (e) => {
    const r = cv.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / (r.width / L().w)), y = Math.floor((e.clientY - r.top) / (r.height / L().h));
    const p = cur().plate[x + y * L().w];
    if (p >= 0) {
      sel = p;
      preview = null;
      draw();
    }
  });
  LEVELS.forEach((l, i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = `${i + 1}. ${l.name} (par ${l.par})`;
    ui.select.appendChild(o);
  });
  ui.select.addEventListener("change", () => load(Number(ui.select.value)));
  load(0);
})();
