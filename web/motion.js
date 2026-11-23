/* motion.js - pure logic for the tactics board: ball flight, kicks, team sizes, set pieces, heatmaps.
   No DOM access, so it can be unit-tested in Node (tests/test_motion.js). */
(function (g) {
  "use strict";
  const W = 105, H = 68, SEG_SEC = 1.6, BALL_R = 0.19;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  /* ---------- segments: how the ball leaves one keyframe and reaches the next ---------- */
  const FLIGHTS = ["ground", "lofted", "driven"];
  const KICKS = ["auto", "pass", "shot", "header", "throw", "none"];
  const defaultSeg = () => ({ flight: "ground", kick: "auto", curve: null, carrier: null });
  const getSeg = (segs, i) => Object.assign(defaultSeg(), (segs && segs[i]) || {});
  const KICK_T = { pass: 0.2, shot: 0.24, header: 0.26, throw: 0.34, none: 0 };      // seconds until the ball leaves
  const KICK_END = { pass: 0.6, shot: 0.75, header: 0.9, throw: 0.8, none: 0 };      // seconds until the pose is finished

  function posAt(frames, u) {                                                          // 22 x [x, y] at timeline position u
    const i = clamp(Math.floor(u), 0, frames.length - 2), t = ease(clamp(u - i, 0, 1));
    return frames[i].slice(0, 22).map((p, k) => [lerp(p[0], frames[i + 1][k][0], t), lerp(p[1], frames[i + 1][k][1], t)]);
  }
  const inGoal = B => (B[0] > W - 1.5 || B[0] < 1.5) && Math.abs(B[1] - H / 2) < 4.4;
  const resolveKick = (seg, B) => seg.kick !== "auto" ? seg.kick : (inGoal(B) ? "shot" : "pass");
  const ctrl = (A, B, M) => [2 * M[0] - (A[0] + B[0]) / 2, 2 * M[1] - (A[1] + B[1]) / 2];  // quadratic control so the curve passes through M
  function xyAt(A, B, curve, s) {
    if (!curve) return [lerp(A[0], B[0], s), lerp(A[1], B[1], s)];
    const C = ctrl(A, B, curve), a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, c = s * s;
    return [a * A[0] + b * C[0] + c * B[0], a * A[1] + b * C[1] + c * B[1]];
  }
  const FRAC = { ground: 0.92, lofted: 1, driven: 0.6 };                               // share of the flight time the ball is moving
  function flight(seg, A, B, tau) {                                                    // tau 0..1 over the flight -> {x,y,z}
    const len = dist(A, B), tt = clamp(tau / FRAC[seg.flight], 0, 1);
    let s = tt, z = BALL_R;
    if (seg.flight === "ground") s = 1 - Math.pow(1 - tt, 1.7);
    else if (seg.flight === "lofted") z += 4 * clamp(0.2 * len, 2.5, 16) * tt * (1 - tt);
    else { s = 1 - Math.pow(1 - tt, 1.25); z += 4 * clamp(0.035 * len, 0.25, 1.6) * tt * (1 - tt); }
    const [x, y] = xyAt(A, B, seg.curve, s);
    return { x, y, z };
  }
  function kickerOf(frames, i) {                                                        // nearest player to the ball at the start of segment i
    const A = frames[i][22]; let best = -1, bd = 6;
    for (let k = 0; k < 22; k++) { const d = dist(frames[i][k], A); if (d < bd) { bd = d; best = k; } }
    return best;
  }
  /* The full ball state at timeline position u (keyframe mode). */
  function ballState(frames, segs, u) {
    const n = frames.length;
    if (n < 2) { const b = n ? frames[0][22] : [W / 2, H / 2]; return { x: b[0], y: b[1], z: BALL_R, kicker: -1, kick: null, kickT: 0, held: false, carrier: null, seg: -1, flight: "ground" }; }
    const i = clamp(Math.floor(u), 0, n - 2), seg = getSeg(segs, i), A = frames[i][22], B = frames[i + 1][22];
    const lt = clamp(u - i, 0, 1) * SEG_SEC, out = { x: A[0], y: A[1], z: BALL_R, kicker: -1, kick: null, kickT: lt, held: false, carrier: null, seg: i, flight: seg.flight };
    if (seg.carrier !== null && seg.carrier >= 0 && seg.carrier < 22) {
      const c = seg.carrier, p0 = posAt(frames, i + clamp(u - i, 0, 1)), p1 = posAt(frames, Math.min(n - 1, u + 0.04)), p2 = posAt(frames, Math.max(0, u - 0.04));
      let dx = p1[c][0] - p2[c][0], dy = p1[c][1] - p2[c][1]; const l = Math.hypot(dx, dy);
      if (l > 1e-3) { dx /= l; dy /= l; } else { dx = 1; dy = 0; }
      const f = clamp(u - i, 0, 1), touch = 0.55 + 0.45 * Math.abs(Math.sin(lt * 5.2));
      let x = p0[c][0] + dx * touch, y = p0[c][1] + dy * touch;
      if (f < 0.1) { const k = ease(f / 0.1); x = lerp(A[0], x, k); y = lerp(A[1], y, k); }
      if (f > 0.88) { const k = ease((f - 0.88) / 0.12); x = lerp(x, B[0], k); y = lerp(y, B[1], k); }
      out.x = x; out.y = y; out.carrier = c; return out;
    }
    const kick = resolveKick(seg, B), tk = KICK_T[kick] || 0, kicker = kickerOf(frames, i);
    if (kicker >= 0 && kick !== "none" && lt < KICK_END[kick] + 0.4) { out.kicker = kicker; out.kick = kick; }
    if (kick === "throw" && kicker >= 0 && lt < tk) { out.held = true; const p = frames[i][kicker]; out.x = p[0]; out.y = p[1]; out.z = 2.15; return out; }
    const tau = clamp((lt - tk) / (SEG_SEC - tk), 0, 1), f = flight(seg, A, B, tau);
    out.x = f.x; out.y = f.y; out.z = f.z; return out;
  }
  /* Points for drawing a segment's ball path. */
  function pathSamples(frames, segs, i, n) {
    n = n || 28; const seg = getSeg(segs, i), A = frames[i][22], B = frames[i + 1][22], pts = [];
    if (seg.carrier !== null && seg.carrier >= 0) {
      for (let k = 0; k <= n; k++) { const p = posAt(frames, i + k / n)[seg.carrier]; pts.push([p[0], p[1], BALL_R]); }
      return { pts, kind: "carry", shot: false, kick: "none" };
    }
    const kick = resolveKick(seg, B), len = dist(A, B);
    for (let k = 0; k <= n; k++) {
      const t = k / n, [x, y] = xyAt(A, B, seg.curve, t); let z = BALL_R;
      if (seg.flight === "lofted") z += 4 * clamp(0.2 * len, 2.5, 16) * t * (1 - t);
      else if (seg.flight === "driven") z += 4 * clamp(0.035 * len, 0.25, 1.6) * t * (1 - t);
      pts.push([x, y, z]);
    }
    return { pts, kind: seg.flight, shot: kick === "shot", kick };
  }

  /* ---------- team sizes ---------- */
  const SIZE_AREA = { 3: [30, 20], 4: [36, 24], 5: [40, 28], 6: [48, 32], 7: [55, 38], 8: [60, 42], 9: [70, 48], 10: [90, 60], 11: [105, 68] };
  const SIZE_FORMS = {
    3: ["1-2", "2-1", "1-1-1"], 4: ["2-2", "1-2-1", "2-1-1"], 5: ["2-2", "1-2-1", "2-1-1", "1-3"],
    6: ["2-2-1", "3-1-1", "2-1-2", "1-3-1"], 7: ["2-3-1", "3-2-1", "2-2-2", "3-1-2"], 8: ["3-3-1", "3-2-2", "2-3-2", "3-1-3"],
    9: ["3-3-2", "3-2-3", "2-4-2", "4-3-1"], 10: ["4-4-1", "3-4-2", "4-3-2", "3-5-1"]
  };
  const hasKeeper = n => n >= 5;
  function area(n) {
    const [L, Wd] = SIZE_AREA[n] || SIZE_AREA[11];
    return { x0: (W - L) / 2, x1: (W + L) / 2, y0: (H - Wd) / 2, y1: (H + Wd) / 2, L, Wd, n };
  }
  function genForm(n, name) {                                                           // n [distance from own goal line, y] in pitch metres, for team 0
    const a = area(n), lines = name.split("-").map(Number), out = [];
    if (hasKeeper(n)) out.push([a.x0 + 0.04 * a.L, H / 2]);
    lines.forEach((m, j) => {
      const fx = lines.length > 1 ? lerp(0.22, 0.8, j / (lines.length - 1)) : 0.5, span = Math.min(0.92, 0.3 + 0.2 * m);
      for (let i = 0; i < m; i++) out.push([a.x0 + fx * a.L, a.y0 + (0.5 + ((i + 0.5) / m - 0.5) * span) * a.Wd]);
    });
    return out;
  }

  /* ---------- set pieces ----------
     Written for the team attacking the right-hand goal, with the taker at the top touchline ("attack-right, top").
     The result is mirrored for the other team and for the bottom side, and squeezed into the play area for small-sided games. */
  const SP = {
    corner: {
      label: "Corner", phases: ["Setup", "Delivery", "Finish"],
      A: [[104.3, 0.8], [100.5, 28.5], [94, 33.5], [100, 41.5], [88.5, 26], [88.5, 42], [101.5, 36], [93, 25], [93, 45], [100.5, 6]],
      D: [[104, 30.8], [104, 37.2], [100.5, 32], [100.5, 36.5], [95.5, 34.5], [90.5, 27], [90.5, 41], [96, 28.5], [102, 4], [97, 40]],
      gk: [103.6, 34.5], ball: [104.6, 0.5], aMap: [30, 0.5], dMap: [62, 0.45],
      ph: [
        { A: { 1: [97.5, 30.5], 2: [94.5, 34.2], 3: [99, 40], 4: [91, 29], 5: [91, 41], 6: [101, 37], 0: [103.8, 2] }, D: { 0: [103, 31.5], 1: [103, 36.5], 2: [100, 33], 3: [99.5, 37], 4: [95.5, 34.8] }, gk: [103.2, 34.4], ball: [94.5, 34.2], seg: { flight: "lofted", kick: "pass" } },
        { A: { 1: [99, 32], 3: [100.5, 38.5], 6: [102, 35.5], 2: [95.6, 34] }, D: {}, gk: [104.2, 32.6], ball: [105.9, 33.2], seg: { flight: "driven", kick: "header" } }]
    },
    throw: {
      label: "Throw-in", phases: ["Setup", "Throw to feet", "Third-man run"],
      A: x => [[x, -0.8], [x - 3.5, 6], [x + 6, 3.5], [x - 2, 17], [x + 8, 22], [x + 13, 30]],
      D: x => [[x - 2.5, 8], [x + 8, 5.5], [x, 19], [x + 10, 24], [x + 14, 32], [x + 6, 15]],
      gk: [100, 34], ball: x => [x, 0.2], aMap: [0, 1], dMap: [0, 1],
      ph: x => [
        { A: { 1: [x - 3.5, 6.5], 2: [x + 10, 5], 3: [x + 2, 14], 4: [x + 8, 26] }, D: { 0: [x - 2.5, 8.5], 1: [x + 9, 6.5], 2: [x + 1, 16] }, ball: [x - 3.5, 6.5], seg: { flight: "ground", kick: "throw" } },
        { A: { 2: [x + 14, 6.5], 5: [x + 17, 24], 4: [x + 12, 28] }, D: { 1: [x + 12, 8], 3: [x + 13, 25] }, ball: [x + 14, 6.5], seg: { flight: "ground", kick: "pass" } }]
    },
    free: {
      label: "Free kick", phases: ["Setup", "Strike", "Parry and rebound"],
      aMap: [30, 0.5], dMap: [62, 0.45], gk: [104.1, 33.4]
    },
    goalkick: {
      label: "Goal kick", phases: ["Setup", "Short pass", "Third-man pass"],
      A: [[14, 17], [14, 51], [26, 5], [26, 63], [31, 34], [46, 22], [46, 46], [59, 8], [59, 60], [73, 34]],
      D: [[27, 29], [27, 39], [50, 14], [50, 28], [50, 40], [50, 54], [75, 12], [75, 27], [75, 41], [75, 56]],
      gk: [100, 34], agk: [5.5, 34], ball: [5.5, 34], aMap: [0, 1], dMap: [0, 1],
      ph: [
        { A: { 0: [12.2, 18], 4: [27, 30], 5: [44, 20] }, D: { 0: [24, 24], 1: [26, 38] }, ball: [12.2, 18], seg: { flight: "ground", kick: "pass" } },
        { A: { 4: [28.5, 31], 5: [50, 20], 6: [48, 40] }, D: { 0: [30, 26], 1: [31, 36] }, ball: [28.5, 31], seg: { flight: "ground", kick: "pass" } }]
    },
    penalty: {
      label: "Penalty", phases: ["Setup", "Strike", "Follow-up"],
      A: [[92.2, 34], [83.5, 24], [83.5, 30], [83.5, 38], [83.5, 44], [78, 34]], D: [[85, 27], [85, 33], [85, 35], [85, 41], [84, 22], [84, 46]],
      gk: [104.6, 34], ball: [94, 34], aMap: [0, 1], dMap: [0, 1],
      ph: [
        { A: { 0: [93.2, 34] }, D: {}, gk: [104.9, 37], ball: [105.7, 31.2], seg: { flight: "driven", kick: "shot" } },
        { A: { 1: [98, 24], 2: [98, 29], 3: [99, 36], 4: [97, 41], 0: [100, 31] }, D: {}, gk: [104.9, 37], ball: [105.7, 31.2], seg: { flight: "ground", kick: "none" } }]
    }
  };
  function freeKick(x) {
    const S = [x, 26], G = [105, 34], d = dist(S, G), u = [(G[0] - S[0]) / d, (G[1] - S[1]) / d], pp = [-u[1], u[0]];
    const wc = [S[0] + 9.15 * u[0], S[1] + 9.15 * u[1]], wall = [-1.5, -0.5, 0.5, 1.5].map(o => [wc[0] + pp[0] * o * 0.62, wc[1] + pp[1] * o * 0.62]);
    const M = [(S[0] + 104.7) / 2 + pp[0] * 2.4, (S[1] + 38.4) / 2 + pp[1] * 2.4];
    SP.free.A = [[S[0] - 0.6, S[1] + 0.2], [S[0] + 1.5, S[1] + 1.4], [97, 39], [99, 31.5], [92, 41], [96.5, 34.5], [91, 24], [88, 36]];
    SP.free.D = wall.concat([[98.5, 39.3], [99.7, 32.5], [95.5, 34], [93, 26]]);
    SP.free.ball = S;
    SP.free.ph = [
      { A: { 0: [S[0] + 1.2, S[1] + 0.5], 2: [98, 38.5], 3: [99.3, 32.5] }, D: {}, gk: [104.4, 37], ball: [104.7, 38.4], seg: { flight: "lofted", kick: "shot", curve: M } },
      { A: { 6: [99.2, 28.5] }, D: {}, gk: [104, 35], ball: [99.2, 28.5], seg: { flight: "ground", kick: "none" } }];
  }

  function setPiece(kind, o) {
    o = o || {}; const n = o.n || 11, att = o.attack | 0, bottom = o.side === "bottom", a = area(n), x = clamp(o.x || (kind === "throw" ? 78 : 83), 20, 98);
    const spec = SP[kind]; if (!spec) return null;
    if (kind === "free") freeKick(x);
    const get = v => typeof v === "function" ? v(x) : v;
    const AL = get(spec.A), DL = get(spec.D), PH = get(spec.ph), ball0 = get(spec.ball);
    const sx = v => a.x0 + v / W * a.L, sy = v => a.y0 + v / H * a.Wd, sq = p => n < 11 ? [sx(p[0]), sy(p[1])] : p;
    const base = o.base, A = att, D = 1 - att;
    // pitch -> attack-right/top frame (self-inverse)
    const T = p => [att ? W - p[0] : p[0], bottom ? H - p[1] : p[1]];
    const pos = base.slice(0, 22).map(T), ballP = T(base[22] || [W / 2, H / 2]);
    const keep = hasKeeper(n), out = k => n < 11 && (k % 11) >= n;
    const outfield = t => { const r = []; for (let j = keep ? 1 : 0; j < Math.min(n, 11); j++) r.push(t * 11 + j); return r; };
    const gkOf = t => keep ? t * 11 : -1;
    const cur = pos.map(p => p.slice()), assigned = {};
    const assign = (team, slots) => {
      const free = outfield(team).filter(k => true);
      slots.forEach((s, si) => {
        if (!free.length) return; const sp = sq(s); let bi = 0, bd = 1e9;
        free.forEach((k, fi) => { const d = dist(pos[k], sp); if (d < bd) { bd = d; bi = fi; } });
        const k = free.splice(bi, 1)[0]; assigned[k] = si; cur[k] = sp.slice();
      });
      free.forEach(k => {                                                               // everyone else: a compact supporting shape
        const m = team === A ? spec.aMap : spec.dMap, p = pos[k];
        cur[k] = [m[1] === 1 && m[0] === 0 ? p[0] : m[0] + (p[0] - 25) * m[1] + (team === D ? 0 : 0), 34 + (p[1] - 34) * 0.78];
        if (m[1] !== 1 || m[0] !== 0) cur[k][0] = clamp(cur[k][0], 3, 102);
      });
    };
    assign(A, AL); assign(D, DL);
    const slotOwner = (team, si) => Object.keys(assigned).map(Number).find(k => Math.floor(k / 11) === team && assigned[k] === si);
    if (keep) { cur[gkOf(D)] = sq(spec.gk); cur[gkOf(A)] = sq(spec.agk || pos[gkOf(A)]); }
    const snap = ball => cur.map(p => p.slice()).concat([ball.slice()]);
    const frames = [snap(sq(ball0))], segs = [], names = [spec.phases[0]];
    PH.forEach((ph, pi) => {
      for (const [si, p] of Object.entries(ph.A || {})) { const k = slotOwner(A, +si); if (k !== undefined) cur[k] = sq(p).slice(); }
      for (const [si, p] of Object.entries(ph.D || {})) { const k = slotOwner(D, +si); if (k !== undefined) cur[k] = sq(p).slice(); }
      if (ph.gk && keep) cur[gkOf(D)] = sq(ph.gk).slice();
      frames.push(snap(sq(ph.ball))); segs.push(Object.assign(defaultSeg(), ph.seg, ph.seg && ph.seg.curve ? { curve: sq(ph.seg.curve) } : {})); names.push(spec.phases[pi + 1]);
    });
    // back to pitch coordinates; players outside the play area stay where they were
    const back = f => f.map((p, k) => (k < 22 && out(k)) ? base[k].slice() : T(p));
    const fr = frames.map(back), sg = segs.map(s => s.curve ? Object.assign({}, s, { curve: T(s.curve) }) : s);
    return { frames: fr, segs: sg, names, kind, label: spec.label };
  }

  /* ---------- heatmaps ---------- */
  function heatGrid(samples, o) {
    o = o || {}; const cell = o.cell || 0.5, sg = o.sigma || 3.2, nx = Math.round(W / cell), ny = Math.round(H / cell), g = new Float32Array(nx * ny), r = Math.ceil(2.6 * sg / cell);
    for (const [x, y, wt] of samples) {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell), w = wt === undefined ? 1 : wt;
      for (let j = Math.max(0, cy - r); j <= Math.min(ny - 1, cy + r); j++) for (let i = Math.max(0, cx - r); i <= Math.min(nx - 1, cx + r); i++) {
        const dx = (i + 0.5) * cell - x, dy = (j + 0.5) * cell - y; g[j * nx + i] += w * Math.exp(-(dx * dx + dy * dy) / (2 * sg * sg));
      }
    }
    let mx = 0; for (let k = 0; k < g.length; k++) if (g[k] > mx) mx = g[k];
    if (mx > 0) for (let k = 0; k < g.length; k++) g[k] /= mx;
    return { nx, ny, g, max: mx };
  }
  const RAMP = [[0, [0, 0, 0, 0]], [0.08, [40, 110, 255, 0]], [0.22, [34, 170, 255, 120]], [0.4, [30, 220, 150, 165]], [0.58, [190, 235, 60, 190]], [0.78, [255, 170, 30, 215]], [1, [255, 50, 40, 235]]];
  function ramp(v) {
    for (let i = 1; i < RAMP.length; i++) if (v <= RAMP[i][0]) { const [a, ca] = RAMP[i - 1], [b, cb] = RAMP[i], t = (v - a) / (b - a || 1); return ca.map((c, k) => Math.round(lerp(c, cb[k], t))); }
    return RAMP[RAMP.length - 1][1];
  }

  g.Motion = { W, H, SEG_SEC, BALL_R, FLIGHTS, KICKS, KICK_T, KICK_END, SIZE_AREA, SIZE_FORMS, SP,
    clamp, lerp, ease, defaultSeg, getSeg, posAt, ballState, pathSamples, resolveKick, kickerOf, xyAt, ctrl, flight, inGoal,
    area, genForm, hasKeeper, setPiece, heatGrid, ramp };
  if (typeof module !== "undefined") module.exports = g.Motion;
})(typeof window !== "undefined" ? window : globalThis);
