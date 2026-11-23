/* stage3d.js - a floodlit WebGL stadium for the tactics board (three.js r128, no other dependencies).
   World units are metres. Pitch (x, y) maps to world (x - 52.5, ., y - 34); +Z is the near touchline, +Y is up. */
(function () {
  "use strict";
  const W = 105, H = 68, PX = 32, MARG = 7, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  const col = h => new window.THREE.Color(h).convertSRGBToLinear();
  const S3 = window.S3 = { ok: false, quality: "high", playerScale: 1.12, ballScale: 1.0 };
  let T, renderer, scene, camera, host, sun, hemi, clock;
  let rigs = [], ballMesh, ballShadow, ballTrail, pathsGroup, areaGroup, overlayTex, overlayMesh, flags = [], flashes = [], goalsFull = [];
  const kit = { c: ["#f2c14e", "#5fb0e8"], gk: ["#2fd47b", "#ff8a3d"] };
  const labels = {};                                   // "team:num" -> name
  const mats = {};
  let vw = 800, vh = 500, ballPrev = null, tNow = 0;

  /* ---------- procedural textures ---------- */
  function tex(c, srgb, repeat) {
    const t = new T.CanvasTexture(c);
    if (srgb !== false) t.encoding = T.sRGBEncoding;
    t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; }
    return t;
  }
  function pitchTexture() {
    const hi = S3.quality === "high", ppm = hi ? PX : 22, w = (W + 2 * MARG) * ppm, h = (H + 2 * MARG) * ppm, c = mk(w, h), g = c.getContext("2d"), r = rng(5);
    g.fillStyle = "#2b6a2e"; g.fillRect(0, 0, w, h);
    const n = 15, sw = W / n;
    for (let i = -2; i < n + 2; i++) {                                              // mowing stripes along the length
      const x = (MARG + i * sw) * ppm, e = i % 2 === 0, gr = g.createLinearGradient(x, 0, x + sw * ppm, 0);
      gr.addColorStop(0, e ? "#3a8b3b" : "#2d7632"); gr.addColorStop(1, e ? "#34813a" : "#296d2f");
      g.fillStyle = gr; g.fillRect(x, 0, sw * ppm + 1, h);
    }
    g.fillStyle = "rgba(0,20,5,.28)"; g.fillRect(0, 0, w, MARG * ppm - 0); g.fillRect(0, (MARG + H) * ppm, w, MARG * ppm); g.fillRect(0, 0, MARG * ppm, h); g.fillRect((MARG + W) * ppm, 0, MARG * ppm, h);
    for (let i = 0; i < 1400; i++) {                                                // large soft patches
      const x = r() * w, y = r() * h, rad = 30 + r() * 170, gr = g.createRadialGradient(x, y, 0, x, y, rad), dk = r() > .5;
      gr.addColorStop(0, dk ? "rgba(0,28,6,.05)" : "rgba(200,235,130,.04)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < (hi ? 140000 : 60000); i++) {                               // grass grain
      g.fillStyle = r() > .5 ? "rgba(215,248,160,.10)" : "rgba(0,30,6,.13)"; g.fillRect(r() * w, r() * h, 1, 2 + r() * (hi ? 4 : 3));
    }
    const wear = (x, y, rx, ry, a) => {                                             // worn patches: goalmouths and spots
      g.save(); g.translate((MARG + x) * ppm, (MARG + y) * ppm); g.scale(rx * ppm, ry * ppm);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, `rgba(120,96,52,${a})`); gr.addColorStop(1, "rgba(120,96,52,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
    };
    wear(2.5, H / 2, 5, 7, .30); wear(W - 2.5, H / 2, 5, 7, .30); wear(W / 2, H / 2, 3.2, 3.2, .22); wear(11, H / 2, 1.8, 1.8, .24); wear(W - 11, H / 2, 1.8, 1.8, .24);
    g.save(); g.translate(MARG * ppm, MARG * ppm); g.scale(ppm, ppm);
    g.strokeStyle = "rgba(246,248,242,.93)"; g.fillStyle = "rgba(246,248,242,.93)"; g.lineWidth = .12;
    g.strokeRect(0, 0, W, H); g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, 9.15, 0, TAU); g.stroke(); g.beginPath(); g.arc(W / 2, H / 2, .22, 0, TAU); g.fill();
    for (const s of [0, 1]) {
      const x = s ? W : 0, d = s ? -1 : 1;
      g.strokeRect(s ? W - 16.5 : 0, (H - 40.32) / 2, 16.5, 40.32); g.strokeRect(s ? W - 5.5 : 0, (H - 18.32) / 2, 5.5, 18.32);
      g.beginPath(); g.arc(x + d * 11, H / 2, .22, 0, TAU); g.fill();
      g.beginPath(); g.arc(x + d * 11, H / 2, 9.15, s ? Math.PI - .926 : -.926, s ? Math.PI + .926 : .926); g.stroke();
    }
    for (const [cx, cy, a] of [[0, 0, 0], [W, 0, Math.PI / 2], [W, H, Math.PI], [0, H, 1.5 * Math.PI]]) { g.beginPath(); g.arc(cx, cy, 1, a, a + Math.PI / 2); g.stroke(); }
    g.restore();
    for (let i = 0; i < 30000; i++) { g.fillStyle = "rgba(52,128,58,.35)"; g.fillRect(r() * w, r() * h, 1, 1 + r() * 2); }   // grass breaks the paint
    return tex(c);
  }
  function crowdTexture() {
    const c = mk(2048, 1024), g = c.getContext("2d"), r = rng(9);
    g.fillStyle = "#0b1020"; g.fillRect(0, 0, 2048, 1024);
    const blocks = ["#b8433f", "#c9cfdc", "#355fb8", "#c9a24a", "#2a7d63", "#c9cfdc", "#b8433f"], pal = ["#b8433f", "#c9cfdc", "#355fb8", "#c9a24a", "#262d46", "#12172a", "#12172a", "#12172a", "#7c8bb0"], skin = ["#f0c8a0", "#d9a37a", "#b57a52", "#7a4b2e", "#4d3020"];
    const bw = 256, bh = 128;
    for (let by = 0; by < 1024; by += bh) for (let bx = 0; bx < 2048; bx += bw) {
      const dom = blocks[Math.floor(r() * blocks.length)], mix = .5 + r() * .3, tone = .42 + r() * .4;
      for (let y = by + 8; y < by + bh; y += 18) for (let x = bx + 4 + ((y / 18) % 2) * 7; x < bx + bw - 6; x += 14) {
        if (r() < .07) continue;
        const col = r() < mix ? dom : pal[Math.floor(r() * pal.length)];
        g.globalAlpha = tone * (.78 + r() * .22); g.fillStyle = col; g.beginPath(); g.ellipse(x, y + 6, 6, 5.5, 0, 0, TAU); g.fill();
        g.globalAlpha = tone; g.fillStyle = skin[Math.floor(r() * skin.length)]; g.beginPath(); g.arc(x, y - 2, 3.1, 0, TAU); g.fill();
      }
      g.globalAlpha = 1; g.fillStyle = "rgba(4,6,14,.85)"; g.fillRect(bx, by, 3, bh); g.fillRect(bx, by + bh - 3, bw, 3);                // aisles and gangways
    }
    g.globalAlpha = 1; const dk = g.createLinearGradient(0, 0, 0, 1024); dk.addColorStop(0, "rgba(4,6,14,.72)"); dk.addColorStop(.6, "rgba(4,6,14,.25)"); dk.addColorStop(1, "rgba(4,6,14,0)"); g.fillStyle = dk; g.fillRect(0, 0, 2048, 1024);
    return tex(c, true, true);
  }
  function boardTexture() {
    const c = mk(4096, 128), g = c.getContext("2d"), items = [["TACTICS LAB", "#0b2a55", "#3ec1ff"], ["PLAN  ·  REPLAY  ·  COMPARE", "#16103a", "#f2c14e"], ["FINAL YEAR PROJECT", "#06241f", "#22d3a6"], ["ANALYSE THE GAME", "#2a0d1c", "#ff7a9c"]];
    items.concat(items).forEach(([t, bg, fg], i) => {
      const x = i * 512, gr = g.createLinearGradient(x, 0, x, 128); gr.addColorStop(0, bg); gr.addColorStop(1, "#050810");
      g.fillStyle = gr; g.fillRect(x, 0, 512, 128); g.fillStyle = fg; g.font = "800 38px Segoe UI, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t, x + 256, 66);
      g.fillStyle = fg; g.globalAlpha = .5; g.fillRect(x + 8, 10, 496, 3); g.fillRect(x + 8, 115, 496, 3); g.globalAlpha = 1;
    });
    g.fillStyle = "rgba(0,0,0,.35)"; for (let y = 0; y < 128; y += 4) g.fillRect(0, y, 4096, 1);
    return tex(c);
  }
  function netTexture() {
    const c = mk(64, 64), g = c.getContext("2d"); g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 2.4; g.strokeRect(0, 0, 64, 64);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke(); return tex(c, true, true);
  }
  function skyTexture() {
    const c = mk(8, 512), g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, "#03060f"); gr.addColorStop(.35, "#0a1634"); gr.addColorStop(.5, "#1a2e5c"); gr.addColorStop(.58, "#3c4f86"); gr.addColorStop(.6, "#0b1020"); gr.addColorStop(1, "#05070d");
    g.fillStyle = gr; g.fillRect(0, 0, 8, 512); return tex(c);
  }
  function glowTexture() {
    const c = mk(128, 128), g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.25, "rgba(255,246,220,.55)"); gr.addColorStop(1, "rgba(255,240,200,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return tex(c);
  }
  function blobTexture() {
    const c = mk(64, 64), g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, "rgba(0,0,0,.62)"); gr.addColorStop(.6, "rgba(0,0,0,.28)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return tex(c, false);
  }
  function ballTexture() {
    const w = 512, h = 256, c = mk(w, h), g = c.getContext("2d"), im = g.createImageData(w, h), phi = (1 + Math.sqrt(5)) / 2;
    const nrm = v => { const l = Math.hypot(...v); return v.map(a => a / l); };
    const pent = [], hex = [];
    for (const a of [-1, 1]) for (const b of [-phi, phi]) { pent.push(nrm([0, a, b]), nrm([a, b, 0]), nrm([b, 0, a])); }
    for (const a of [-1, 1]) for (const b of [-1, 1]) for (const d of [-1, 1]) hex.push(nrm([a, b, d]));
    for (const a of [-1, 1]) for (const b of [-1 / phi, 1 / phi]) { const e = a * phi; hex.push(nrm([0, b, e]), nrm([b, e, 0]), nrm([e, 0, b])); }
    const all = pent.map(p => [p, 1]).concat(hex.map(p => [p, 0]));
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const f = px / w * TAU, t = py / h * Math.PI, d = [-Math.cos(f) * Math.sin(t), Math.cos(t), Math.sin(f) * Math.sin(t)];
      let b1 = -2, b2 = -2, p1 = 0;
      for (const [v, ip] of all) { const dot = v[0] * d[0] + v[1] * d[1] + v[2] * d[2]; if (dot > b1) { b2 = b1; b1 = dot; p1 = ip; } else if (dot > b2) b2 = dot; }
      const seam = b1 - b2 < .018, k = (py * w + px) * 4, v = seam ? 70 : p1 ? 22 : 246 - 18 * (1 - b1);
      im.data[k] = v; im.data[k + 1] = v; im.data[k + 2] = seam ? 76 : p1 ? 26 : v - 2; im.data[k + 3] = 255;
    }
    g.putImageData(im, 0, 0); return tex(c);
  }
  function numberTexture(num, name, shirt) {
    const c = mk(128, 128), g = c.getContext("2d"), fg = lum(shirt) > .58 ? "#0b1424" : "#ffffff";
    g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
    if (name) { let s = 26; g.font = `800 ${s}px Segoe UI, Arial, sans-serif`; const nm = name.toUpperCase().slice(0, 14); while (g.measureText(nm).width > 118 && s > 12) { s -= 2; g.font = `800 ${s}px Segoe UI, Arial, sans-serif`; } g.fillText(nm, 64, 22); }
    g.font = "900 78px Segoe UI, Arial, sans-serif"; g.fillText(String(num), 64, name ? 82 : 64);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
  }

  /* ---------- the stadium ---------- */
  function plane(L, d0, y0, d1, y1, tile) {                                         // quad along the length L, rising from (d0, y0) to (d1, y1)
    const g = new T.BufferGeometry(), v = [-L / 2, y0, d0, L / 2, y0, d0, L / 2, y1, d1, -L / 2, y1, d1];
    g.setAttribute("position", new T.Float32BufferAttribute(v, 3)); g.setAttribute("uv", new T.Float32BufferAttribute([0, 0, L / tile, 0, L / tile, 1, 0, 1], 2));
    g.setIndex([0, 2, 1, 0, 3, 2]); g.computeVertexNormals(); return g;
  }
  function buildStand(L, depth, mt) {
    const grp = new T.Group(), up = depth;
    const lower = new T.Mesh(plane(L, 7.5, 1.0, 26, 11.2, 60), mt.crowd); const upper = new T.Mesh(plane(L, 28.5, 15.5, 28.5 + up, 15.5 + up * 0.62, 60), mt.crowd);
    const face = new T.Mesh(plane(L, 26, 11.2, 28.5, 15.5, 60), mt.concrete); face.geometry.attributes.uv.array.fill(0);
    const apron = new T.Mesh(plane(L, 5.8, 0, 7.5, 1.0, 60), mt.concrete);
    const wall = new T.Mesh(new T.PlaneGeometry(L, 1.1), mt.concrete); wall.position.set(0, 0.55, 5.8); wall.rotation.y = Math.PI;
    const roofLen = 28.5 + up, roof = new T.Mesh(new T.BoxGeometry(L + 2, 0.7, roofLen - 14), mt.roof); roof.position.set(0, 15.5 + up * 0.62 + 6.5, 14 + (roofLen - 14) / 2); roof.rotation.x = -0.05;
    const under = new T.Mesh(new T.PlaneGeometry(L + 2, roofLen - 14), mt.lights); under.rotation.x = Math.PI / 2; under.position.set(0, roof.position.y - 0.38, roof.position.z);
    const rail = new T.Mesh(new T.BoxGeometry(L, 0.12, 0.12), mt.rail); rail.position.set(0, 11.9, 26.1);
    for (const o of [lower, upper]) o.receiveShadow = false;
    grp.add(lower, upper, face, apron, wall, roof, under, rail);
    const glass = new T.Mesh(new T.PlaneGeometry(L, 2.2), mt.glass); glass.position.set(0, 13.4, 26.4); glass.rotation.y = Math.PI; grp.add(glass);
    return grp;
  }
  function buildGoal(w, h, d, mt) {
    const g = new T.Group(), r = 0.06, post = new T.CylinderGeometry(r, r, h, 12);
    for (const s of [-1, 1]) { const p = new T.Mesh(post, mt.white); p.position.set(s * w / 2, h / 2, 0); p.castShadow = true; g.add(p); const b = new T.Mesh(new T.CylinderGeometry(r * .8, r * .8, h, 8), mt.white); b.position.set(s * w / 2, h / 2, -d); g.add(b); }
    const bar = new T.Mesh(new T.CylinderGeometry(r, r, w + r * 2, 12), mt.white); bar.rotation.z = Math.PI / 2; bar.position.set(0, h, 0); bar.castShadow = true; g.add(bar);
    const bar2 = bar.clone(); bar2.scale.set(.8, 1, .8); bar2.position.z = -d; g.add(bar2);
    for (const s of [-1, 1]) { const t = new T.Mesh(new T.CylinderGeometry(r * .7, r * .7, d, 8), mt.white); t.rotation.x = Math.PI / 2; t.position.set(s * w / 2, h, -d / 2); g.add(t); }
    const net = (nw, nh, rx, ry, rz, px, py, pz) => { const t = mt.netTex.clone(); t.needsUpdate = true; t.repeat.set(nw / .12, nh / .12); const m = new T.Mesh(new T.PlaneGeometry(nw, nh), new T.MeshBasicMaterial({ map: t, transparent: true, opacity: .55, side: T.DoubleSide, depthWrite: false, toneMapped: false, alphaTest: .05 })); m.rotation.set(rx, ry, rz); m.position.set(px, py, pz); g.add(m); };
    net(w, h, 0, 0, 0, 0, h / 2, -d); net(w, d, -Math.PI / 2, 0, 0, 0, h, -d / 2); net(d, h, 0, Math.PI / 2, 0, -w / 2, h / 2, -d / 2); net(d, h, 0, Math.PI / 2, 0, w / 2, h / 2, -d / 2);
    return g;
  }
  function buildStadium() {
    const mt = {
      crowd: new T.MeshLambertMaterial({ map: crowdTexture(), emissive: col(0xffffff), emissiveMap: null, color: col(0xcfd8f5) }),
      concrete: new T.MeshStandardMaterial({ color: col(0x2a3042), roughness: .9 }), roof: new T.MeshStandardMaterial({ color: col(0x141a2a), roughness: .6, metalness: .3 }),
      rail: new T.MeshStandardMaterial({ color: col(0x8892aa), roughness: .4, metalness: .6 }), white: new T.MeshStandardMaterial({ color: col(0xf5f7fa), roughness: .35, metalness: .1 }),
      glass: new T.MeshBasicMaterial({ color: col(0x9fd0ff), transparent: true, opacity: .20, toneMapped: false, depthWrite: false }),
      lights: new T.MeshBasicMaterial({ color: col(0xffefd0), toneMapped: false }), netTex: netTexture()
    };
    mt.crowd.emissiveMap = mt.crowd.map; mt.crowd.emissiveIntensity = .34;
    const lc = mk(64, 64), lg = lc.getContext("2d"); lg.fillStyle = "#24293a"; lg.fillRect(0, 0, 64, 64); lg.fillStyle = "#ffeccc"; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) lg.fillRect(i * 16 + 4, j * 16 + 4, 8, 8);
    const lt = tex(lc, true, true); lt.repeat.set(30, 10); mt.lights.map = lt;
    mats.stadium = mt;
    const stands = new T.Group();
    const sides = [[0, W + 30, 46], [Math.PI, W + 30, 46], [Math.PI / 2, H + 12, 34], [-Math.PI / 2, H + 12, 34]];          // [rotation, length, depth]
    sides.forEach(([rot, len, dep], i) => {
      const s = buildStand(len, dep, mt), off = i < 2 ? H / 2 : W / 2;
      s.rotation.y = rot; s.position.set(Math.sin(rot) * off, 0, Math.cos(rot) * off); stands.add(s);
    });
    scene.add(stands);
    // advertising boards ring the pitch
    const bt = boardTexture(), bm = new T.MeshBasicMaterial({ map: bt, toneMapped: false });
    const mkBoard = (len, x, z, ry) => { const t = bt.clone(); t.needsUpdate = true; t.wrapS = T.RepeatWrapping; t.repeat.set(len / 40, 1); const m = new T.Mesh(new T.PlaneGeometry(len, .95), new T.MeshBasicMaterial({ map: t, toneMapped: false })); m.position.set(x, .62, z); m.rotation.y = ry; scene.add(m); const back = new T.Mesh(new T.BoxGeometry(len, .95, .14), mt.concrete); back.position.set(x, .5, z); back.rotation.y = ry; back.translateZ(ry ? .1 : (z > 0 ? .1 : -.1)); };
    mkBoard(W + 13, 0, -H / 2 - 5.3, 0); mkBoard(W + 13, 0, H / 2 + 5.3, Math.PI); mkBoard(H + 10.6, -W / 2 - 6.2, 0, Math.PI / 2); mkBoard(H + 10.6, W / 2 + 6.2, 0, -Math.PI / 2);
    // goals
    for (const s of [-1, 1]) { const gl = buildGoal(7.32, 2.44, 2.1, mt); gl.position.set(s * W / 2, 0, 0); gl.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; scene.add(gl); goalsFull.push(gl); }
    // corner flags
    for (const [x, z] of [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]]) {
      const pole = new T.Mesh(new T.CylinderGeometry(.018, .018, 1.55, 8), new T.MeshStandardMaterial({ color: col(0xffffff) })); pole.position.set(x, .78, z); scene.add(pole);
      const fl = new T.Mesh(new T.PlaneGeometry(.45, .3), new T.MeshBasicMaterial({ color: col(0xffd23c), side: T.DoubleSide })); fl.geometry.translate(.22, 0, 0); fl.position.set(x, 1.4, z); scene.add(fl); flags.push(fl);
    }
    // floodlight masts
    const glow = glowTexture();
    for (const [x, z] of [[-W / 2 - 26, -H / 2 - 24], [W / 2 + 26, -H / 2 - 24], [W / 2 + 26, H / 2 + 24], [-W / 2 - 26, H / 2 + 24]]) {
      const mast = new T.Mesh(new T.CylinderGeometry(.5, .8, 46, 8), mt.concrete); mast.position.set(x, 23, z); scene.add(mast);
      const head = new T.Mesh(new T.BoxGeometry(9, 5.5, .6), new T.MeshBasicMaterial({ map: lt, toneMapped: false })); head.position.set(x, 47, z); head.lookAt(0, 20, 0); scene.add(head);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: glow, color: col(0xfff1d6), transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false })); sp.scale.set(46, 46, 1); sp.position.set(x, 47, z); scene.add(sp);
      const spot = new T.SpotLight(col(0xfff1dc), .42, 0, 1.0, .55, 1); spot.position.set(x, 46, z); spot.target.position.set(0, 0, 0); scene.add(spot, spot.target);
    }
    // camera flashes in the crowd
    for (let k = 0; k < 5; k++) {
      const n = 60, pos = new Float32Array(n * 3), r = rng(30 + k);
      for (let i = 0; i < n; i++) { const side = Math.floor(r() * 4), tt = r(), d = 12 + r() * 36, y = 1 + (d - 7.5) * .5; const L = side < 2 ? W + 26 : H + 10, a = (tt - .5) * L; const rot = [0, Math.PI, Math.PI / 2, -Math.PI / 2][side], off = side < 2 ? H / 2 : W / 2; const lx = a, lz = d; pos[i * 3] = Math.sin(rot) * off + lx * Math.cos(rot) + lz * Math.sin(rot); pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.cos(rot) * off - lx * Math.sin(rot) + lz * Math.cos(rot); }
      const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.BufferAttribute(pos, 3));
      const pts = new T.Points(geo, new T.PointsMaterial({ color: col(0xffffff), size: 1.6, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true })); scene.add(pts); flashes.push({ pts, f: 0.7 + k * .37, p: k * 1.3 });
    }
    // dugouts on the far side
    for (const x of [-12, 12]) {
      const d = new T.Group(), shell = new T.Mesh(new T.BoxGeometry(9, 2.2, 1.2), new T.MeshStandardMaterial({ color: col(0x9fc8ff), transparent: true, opacity: .22, roughness: .1 })); shell.position.y = 1.1;
      const roof = new T.Mesh(new T.BoxGeometry(9.4, .15, 1.9), mt.roof); roof.position.y = 2.25; const seat = new T.Mesh(new T.BoxGeometry(8, .4, .5), new T.MeshStandardMaterial({ color: col(0x1b2234) })); seat.position.set(0, .4, -.1);
      d.add(shell, roof, seat); d.position.set(x, 0, -H / 2 - 3.6); scene.add(d);
    }
  }

  /* ---------- players ---------- */
  const skinTones = [0xf1c7a3, 0xe0a97f, 0xc68b5e, 0x8a5a3b, 0x5a3a25], hairTones = [0x17120e, 0x3b2616, 0x7b5a2e, 0xc9a45c, 0x222222];
  let G = null;
  function geoms() {
    if (G) return G;
    const cyl = (a, b, h, s, ty) => { const g = new T.CylinderGeometry(a, b, h, s || 14); if (ty) g.translate(0, ty, 0); return g; };
    G = {
      torso: cyl(.2, .165, .58, 22), upper: cyl(.056, .048, .3, 12, -.15), fore: cyl(.046, .038, .27, 12, -.135), hand: new T.SphereGeometry(.05, 10, 8),
      glove: new T.SphereGeometry(.075, 10, 8), thigh: cyl(.088, .068, .46, 14, -.23), shortsLeg: cyl(.1, .112, .22, 14, -.11), shorts: cyl(.19, .2, .26, 20), shin: cyl(.064, .046, .42, 14, -.21),
      boot: new T.BoxGeometry(.105, .075, .29).translate(0, -.03, .075), head: new T.SphereGeometry(.105, 22, 16), hair: new T.SphereGeometry(.111, 22, 10, 0, TAU, 0, 1.75), neck: cyl(.046, .052, .1, 10),
      blob: new T.PlaneGeometry(1.9, 1.9).rotateX(-Math.PI / 2), ring: new T.RingGeometry(.95, 1.12, 48).rotateX(-Math.PI / 2), cone: new T.CylinderGeometry(.9, 2.7, 22, 28, 1, true).translate(0, 11, 0)
    };
    return G;
  }
  function teamMats() {
    ["0", "1"].forEach(t => {
      mats["shirt" + t] = new T.MeshStandardMaterial({ roughness: .78, metalness: 0 }); mats["sleeve" + t] = new T.MeshStandardMaterial({ roughness: .78 });
      mats["shorts" + t] = new T.MeshStandardMaterial({ roughness: .8 }); mats["sock" + t] = new T.MeshStandardMaterial({ roughness: .85 });
      mats["gk" + t] = new T.MeshStandardMaterial({ roughness: .75 }); mats["gkShorts" + t] = new T.MeshStandardMaterial({ roughness: .8 }); mats["glove" + t] = new T.MeshStandardMaterial({ roughness: .6 });
    });
    mats.skin = skinTones.map(c => new T.MeshStandardMaterial({ color: col(c), roughness: .62 })); mats.hair = hairTones.map(c => new T.MeshStandardMaterial({ color: col(c), roughness: .8 }));
    mats.boot = new T.MeshStandardMaterial({ color: col(0x0d0f14), roughness: .35, metalness: .25 });
    mats.blob = new T.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: false });
    mats.ring = new T.MeshBasicMaterial({ color: col(0xffffff), transparent: true, opacity: .95, depthWrite: false, toneMapped: false });
    mats.cone = new T.MeshBasicMaterial({ color: col(0xffffff), transparent: true, opacity: .2, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false });
  }
  function applyKits() {
    const dark = "#0e1730", white = "#f4f6fa";
    for (const t of [0, 1]) {
      const c = col(kit.c[t]), l = lum(kit.c[t]);
      mats["shirt" + t].color.copy(c); mats["sleeve" + t].color.copy(c).multiplyScalar(.92);
      mats["shorts" + t].color.copy(col(l > .56 ? dark : white)); mats["sock" + t].color.copy(c);
      mats["gk" + t].color.copy(col(kit.gk[t])); mats["gkShorts" + t].color.copy(col(dark)); mats["glove" + t].color.copy(col(l > .5 ? "#ffffff" : "#d8ff3c"));
    }
    rigs.forEach(r => labelRig(r));
  }
  function labelRig(r) {
    const key = r.team + ":" + r.num, name = labels[key] || "", shirt = r.gk ? kit.gk[r.team] : kit.c[r.team];
    if (r.numTex) r.numTex.dispose(); r.numTex = numberTexture(r.num, name, shirt); r.numMesh.material.map = r.numTex; r.numMesh.material.needsUpdate = true;
  }
  function makeRig(team, num) {
    const g = geoms(), k = team + "", root = new T.Group(), hips = new T.Group(), torso = new T.Group();
    const cast = m => { m.castShadow = true; return m; };
    const skin = mats.skin[(num * 3 + team * 2) % 5], hair = mats.hair[(num + team * 2) % 5];
    hips.position.y = .95; root.add(hips);
    const shorts = cast(new T.Mesh(g.shorts, mats["shorts" + k])); shorts.position.y = -.02; shorts.scale.z = .78; hips.add(shorts);
    const shirt = cast(new T.Mesh(g.torso, mats["shirt" + k])); shirt.position.y = .35; shirt.scale.set(1.12, 1, .62); torso.add(shirt);
    const neck = new T.Mesh(g.neck, skin); neck.position.y = .66; torso.add(neck);
    const head = cast(new T.Mesh(g.head, skin)); head.position.y = .79; head.scale.set(.95, 1.12, 1); torso.add(head);
    const hr = new T.Mesh(g.hair, hair); hr.position.set(0, .795, -.012); hr.scale.set(.95, 1.12, 1.02); torso.add(hr);
    const numMesh = new T.Mesh(new T.PlaneGeometry(.3, .3), new T.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, toneMapped: false }));
    numMesh.position.set(0, .38, -.136); numMesh.rotation.y = Math.PI; torso.add(numMesh);
    const arm = s => {
      const sh = new T.Group(), up = cast(new T.Mesh(g.upper, mats["sleeve" + k])), el = new T.Group(), fo = cast(new T.Mesh(g.fore, skin)), hd = new T.Mesh(g.hand, skin);
      sh.position.set(s * .245, .56, 0); el.position.y = -.3; hd.position.y = -.28; sh.add(up, el); el.add(fo, hd);
      const gl = new T.Mesh(g.glove, mats["glove" + k]); gl.position.y = -.29; gl.visible = false; el.add(gl); torso.add(sh); return { sh, el, gl, hd };
    };
    const armL = arm(-1), armR = arm(1);
    const leg = s => {
      const hp = new T.Group(), th = cast(new T.Mesh(g.thigh, skin)), sl = cast(new T.Mesh(g.shortsLeg, mats["shorts" + k])), kn = new T.Group(), sn = cast(new T.Mesh(g.shin, mats["sock" + k])), bt = cast(new T.Mesh(g.boot, mats.boot)), an = new T.Group();
      hp.position.set(s * .098, -.02, 0); kn.position.y = -.46; an.position.y = -.42; an.add(bt); kn.add(sn, an); hp.add(th, sl, kn); hips.add(hp); return { hp, kn, an };
    };
    const legL = leg(-1), legR = leg(1);
    hips.add(torso);
    const blob = new T.Mesh(g.blob, mats.blob); blob.position.y = .03; blob.renderOrder = 1; root.add(blob);
    const ring = new T.Mesh(g.ring, mats.ring); ring.position.y = .05; ring.visible = false; root.add(ring);
    const cone = new T.Mesh(g.cone, mats.cone); cone.visible = false; root.add(cone);
    root.scale.setScalar(S3.playerScale); scene.add(root);
    return { team, num, gk: false, root, hips, torso, head, armL, armR, legL, legR, blob, ring, cone, shirt, shorts, numMesh, hair: hr, heading: team ? -Math.PI / 2 : Math.PI / 2, phase: num * 1.7, amp: 0, sock: [legL, legR], base: new T.Vector2(), has: false };
  }
  function setGK(r, on) {
    if (r.gk === on) return; r.gk = on; const k = r.team + "";
    r.shirt.material = on ? mats["gk" + k] : mats["shirt" + k]; r.armL.sh.children[0].material = r.armR.sh.children[0].material = on ? mats["gk" + k] : mats["sleeve" + k];
    r.shorts.material = on ? mats["gkShorts" + k] : mats["shorts" + k]; r.armL.gl.visible = r.armR.gl.visible = on; r.armL.hd.visible = r.armR.hd.visible = !on; labelRig(r);
  }
  const kickLerp = (a, b, t) => lerp(a, b, ease(clamp(t, 0, 1)));
  function pose(r, p, dt, animDt, look) {
    const speed = Math.hypot(p.vx || 0, p.vy || 0), kk = p.kick, H0 = r.heading;
    let target = H0;
    if (kk && kk.faceTo && kk.t < 0.9) target = Math.atan2(kk.faceTo[0] - p.x, kk.faceTo[1] - p.y);
    else if (speed > .8) target = Math.atan2(p.vx, p.vy);
    else if (look) target = Math.atan2(look[0] - p.x, look[1] - p.y);
    r.heading += angDiff(target, r.heading) * (1 - Math.exp(-dt * (kk ? 18 : speed > .8 ? 10 : 5)));
    const A = clamp((speed - .4) / 5.2, 0, 1);
    r.amp += (A - r.amp) * (1 - Math.exp(-dt * 9)); if (speed > .4) r.phase += (3.4 + .8 * speed) * animDt;
    const a = r.amp, ph = r.phase, s = Math.sin(ph), c = Math.cos(ph), sw = .95 * a;
    // run cycle
    let tL = s * sw, tR = -s * sw, kL = .05 + (.15 + 1.1 * a) * Math.max(0, -c), kR = .05 + (.15 + 1.1 * a) * Math.max(0, c);
    let aL = -s * sw * .9, aR = s * sw * .9, eL = -(.35 + .9 * a), eR = -(.35 + .9 * a), azL = -.07, azR = .07;
    let lean = -.1 * a, twist = -s * .18 * a, hipY = .95 - .03 * a + .05 * a * (1 - Math.abs(s)), breath = Math.sin(tNow * 2.1 + r.num) * .006 * (1 - a);
    if (r.gk && a < .3) { const w = 1 - a / .3; hipY -= .07 * w; kL += .3 * w; kR += .3 * w; tL -= .2 * w; tR -= .2 * w; aL += -.7 * w; aR += -.7 * w; eL -= .7 * w; eR -= .7 * w; lean -= .14 * w; azL -= .5 * w; azR += .5 * w; }
    if (kk && kk.type !== "none") {
      const t = kk.t, ty = kk.type, left = !!kk.left;
      const end = { pass: .6, shot: .75, header: .9, throw: .8 }[ty] || .6, w = t < end ? 1 : clamp(1 - (t - end) / .3, 0, 1);
      if (w > 0) {
        let kt, kn, pt, pn, ln = 0, hy = hipY, a1 = aL, a2 = aR, e1 = eL, e2 = eR, z1 = azL, z2 = azR, tw = twist;
        if (ty === "pass" || ty === "shot") {
          const T0 = ty === "shot" ? .16 : .14, T1 = ty === "shot" ? .25 : .22, back = ty === "shot" ? 1.0 : .8, front = ty === "shot" ? -1.5 : -1.1;
          if (t < T0) { const u = t / T0; kt = kickLerp(0, back, u); kn = kickLerp(.1, 1.55, u); ln = kickLerp(0, .12, u); }
          else if (t < T1) { const u = (t - T0) / (T1 - T0); kt = lerp(back, front, 1 - Math.pow(1 - u, 2)); kn = kickLerp(1.55, .05, u); ln = kickLerp(.12, -.12, u); }
          else { const u = clamp((t - T1) / .35, 0, 1); kt = kickLerp(front, front - .3, u); kn = kickLerp(.05, .8, u); ln = -.12 - u * .1; }
          pt = -.12; pn = .4; hy = .95 - .05; a1 = t < T1 ? .7 : -.2; a2 = t < T1 ? -.8 : .3; z1 = -.5; z2 = .5; e1 = -.4; e2 = -.4; tw = t < T1 ? .35 : -.25;
        } else if (ty === "header") {
          const jump = Math.sin(Math.PI * clamp(t / .62, 0, 1)); hy = .95 + .5 * jump; const hv = t < .26 ? kickLerp(.35, -.55, (t - .1) / .16) : kickLerp(-.55, -.2, (t - .26) / .4);
          kt = pt = -.35 * jump + .1; kn = pn = 1.15 * jump + .1; ln = hv; a1 = a2 = -.5 * jump; z1 = -1.0 * jump; z2 = 1.0 * jump; e1 = e2 = -.3;
        } else {                                                                                  // throw-in
          const up = t < .16 ? kickLerp(0, 1, t / .16) : 1, rel = t < .34 ? 0 : kickLerp(0, 1, (t - .34) / .3);
          const sh = lerp(lerp(-2.55, -2.1, kickLerp(0, 1, (t - .16) / .18)), -.4, rel), el = lerp(lerp(.2, 1.3, up) * (t < .16 ? 1 : 1) - (t >= .16 ? kickLerp(0, 1.35, (t - .16) / .18) : 0), -.2, rel);
          a1 = a2 = lerp(0, sh, 1); e1 = e2 = el; z1 = -.12; z2 = .12; ln = t < .2 ? kickLerp(0, .3, t / .2) : kickLerp(.3, -.38, (t - .2) / .2) * (1 - rel * .3);
          kt = .35; pt = -.3; kn = .2; pn = .1; hy = .95 - .03;
        }
        const mix = (cur, val) => lerp(cur, val, w);
        const kl = left;
        if (kl) { tL = mix(tL, kt); kL = mix(kL, kn); tR = mix(tR, pt); kR = mix(kR, pn); } else { tR = mix(tR, kt); kR = mix(kR, kn); tL = mix(tL, pt); kL = mix(kL, pn); }
        hipY = mix(hipY, hy); lean = mix(lean, ln === 0 ? lean : ln); twist = mix(twist, tw); aL = mix(aL, kl ? a2 : a1); aR = mix(aR, kl ? a1 : a2); eL = mix(eL, e1); eR = mix(eR, e2); azL = mix(azL, z1); azR = mix(azR, z2);
      }
    }
    r.hips.position.y = hipY; r.legL.hp.rotation.x = tL; r.legR.hp.rotation.x = tR; r.legL.kn.rotation.x = kL; r.legR.kn.rotation.x = kR;
    r.legL.an.rotation.x = -.35 * kL; r.legR.an.rotation.x = -.35 * kR;
    r.armL.sh.rotation.x = aL; r.armR.sh.rotation.x = aR; r.armL.el.rotation.x = eL; r.armR.el.rotation.x = eR; r.armL.sh.rotation.z = azL; r.armR.sh.rotation.z = azR;
    r.torso.rotation.x = lean; r.torso.rotation.y = twist; r.torso.scale.y = 1 + breath; r.head.rotation.x = -lean * .5;
    r.root.rotation.y = r.heading;
  }

  /* ---------- ball, paths, area ---------- */
  function buildBall() {
    const R = .19, m = new T.Mesh(new T.SphereGeometry(R, 32, 24), new T.MeshStandardMaterial({ map: ballTexture(), roughness: .42, metalness: .04 }));
    m.castShadow = true; scene.add(m); ballMesh = m;
    ballShadow = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mats.blob); ballShadow.position.y = .035; scene.add(ballShadow);
    const n = 14, g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(new Float32Array(n * 3), 3)); const col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const f = 1 - i / n; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = f * f * .9; } g.setAttribute("color", new T.BufferAttribute(col, 3));
    ballTrail = new T.Line(g, new T.LineBasicMaterial({ vertexColors: true, blending: T.AdditiveBlending, transparent: true, depthWrite: false })); ballTrail.frustumCulled = false; ballTrail.userData.hist = []; scene.add(ballTrail);
  }
  const PATH_COL = { ground: 0x7fd0ff, lofted: 0xffd166, driven: 0xff6b6b, carry: 0xffffff };
  S3.setPaths = function (list) {
    if (!S3.ok) return;
    if (pathsGroup) { scene.remove(pathsGroup); pathsGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
    pathsGroup = new T.Group();
    for (const p of list) {
      if (p.pts.length < 2) continue;
      const v = p.pts.map(q => new T.Vector3(q[0] - W / 2, q[2], q[1] - H / 2)), curve = new T.CatmullRomCurve3(v), pc = p.shot ? 0xff3b3b : (PATH_COL[p.kind] || 0xffffff), rad = (p.shot ? .14 : .095) * (p.active ? 1.5 : 1);
      const tube = new T.Mesh(new T.TubeGeometry(curve, 36, rad, 6, false), new T.MeshBasicMaterial({ color: col(pc), transparent: true, opacity: p.active ? .98 : .72, toneMapped: false, depthWrite: false, fog: false }));
      pathsGroup.add(tube);
      if (p.kind === "lofted" || p.kind === "driven") {
        const gp = v.map(q => new T.Vector3(q.x, .05, q.z)), line = new T.Line(new T.BufferGeometry().setFromPoints(gp), new T.LineBasicMaterial({ color: col(pc), transparent: true, opacity: .35, depthWrite: false })); pathsGroup.add(line);
      }
      const e = v[v.length - 1], d = e.clone().sub(v[v.length - 3]).normalize(), cone = new T.Mesh(new T.ConeGeometry(rad * 3.2, rad * 9, 12), new T.MeshBasicMaterial({ color: col(pc), toneMapped: false, fog: false }));
      cone.position.copy(e); cone.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d); pathsGroup.add(cone);
      if (p.shot) { const ring = new T.Mesh(new T.RingGeometry(.9, 1.1, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: col(0xff3b3b), transparent: true, opacity: .8, toneMapped: false, depthWrite: false })); ring.position.set(e.x, .06, e.z); pathsGroup.add(ring); }
    }
    scene.add(pathsGroup);
  };
  S3.setArea = function (a) {
    if (!S3.ok) return;
    if (areaGroup) { scene.remove(areaGroup); areaGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); areaGroup = null; }
    const small = a && a.n < 11; goalsFull.forEach(g => g.visible = !small || a.n >= 9);
    if (!small) return;
    areaGroup = new T.Group();
    const cm = new T.MeshStandardMaterial({ color: col(0xff7a1a), roughness: .5, emissive: col(0x401800) }), cg = new T.ConeGeometry(.17, .38, 14).translate(0, .19, 0), put = (x, y) => { const c = new T.Mesh(cg, cm); c.position.set(x - W / 2, 0, y - H / 2); c.castShadow = true; areaGroup.add(c); };
    const seg = (x0, y0, x1, y1) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 6)); for (let i = 0; i < n; i++) put(lerp(x0, x1, i / n), lerp(y0, y1, i / n)); };
    seg(a.x0, a.y0, a.x1, a.y0); seg(a.x1, a.y0, a.x1, a.y1); seg(a.x1, a.y1, a.x0, a.y1); seg(a.x0, a.y1, a.x0, a.y0);
    if (a.n < 9) {
      const gw = clamp(a.Wd * .22, 2.4, 5.5);
      for (const s of [0, 1]) { const gl = buildGoal(gw, gw * .5, 1.0, mats.stadium); gl.position.set((s ? a.x1 : a.x0) - W / 2, 0, 0); gl.rotation.y = s ? -Math.PI / 2 : Math.PI / 2; areaGroup.add(gl); }
    }
    scene.add(areaGroup);
  };

  /* ---------- camera ---------- */
  const cam = { az: 0, el: .4, dist: 80, fov: 30, tx: 0, ty: 1, tz: 0, g: { az: 0, el: .4, dist: 80, fov: 30, tx: 0, ty: 1, tz: 0 }, mode: "broadcast", drone: false };
  const PRESETS = {
    broadcast: { az: 0, el: .40, dist: 82, fov: 30, follow: "ball" }, sideline: { az: 0, el: .15, dist: 46, fov: 40, follow: "ball" }, end: { az: Math.PI / 2, el: .30, dist: 76, fov: 32, follow: "ball" },
    high: { az: 0, el: .88, dist: 98, fov: 32, follow: "none" }, top: { az: 0, el: 1.52, dist: 118, fov: 35, follow: "none" }, orbit: { az: .55, el: .5, dist: 86, fov: 30, follow: "none" }, drone: { az: .5, el: .45, dist: 70, fov: 34, follow: "ball" },
    follow: { az: 0, el: .22, dist: 15, fov: 52, follow: "player" }
  };
  S3.setCamera = function (name) {
    const p = PRESETS[name]; if (!p) return; cam.mode = name; cam.follow = p.follow; cam.drone = name === "drone";
    const g = cam.g; g.fov = p.fov; g.dist = p.dist; g.el = p.el;
    if (name === "orbit" || name === "follow") { /* keep position for orbit, behind-player is set per frame */ }
    if (name !== "follow") { g.az = p.az + Math.round((cam.az - p.az) / TAU) * TAU; }
    if (p.follow === "none") { g.tx = 0; g.ty = 1; g.tz = 0; if (name === "orbit") { g.tx = cam.tx; g.tz = cam.tz; } }
  };
  S3.orbit = function (dx, dy) { cam.follow = "none"; cam.mode = "orbit"; cam.g.az -= dx * .006; cam.g.el = clamp(cam.g.el + dy * .006, .05, 1.52); cam.drone = false; };
  S3.zoom = function (d) { cam.g.dist = clamp(cam.g.dist * Math.exp(d * .0012), 8, 170); };
  S3.pan = function (dx, dy) {
    cam.follow = "none"; cam.mode = "orbit"; const k = cam.g.dist * .0016, ca = Math.cos(cam.az), sa = Math.sin(cam.az);
    cam.g.tx = clamp(cam.g.tx - (dx * ca) * k - dy * sa * k * (cam.el > 1 ? 1 : .6), -70, 70); cam.g.tz = clamp(cam.g.tz + dx * sa * k - dy * ca * k * (cam.el > 1 ? 1 : .6), -50, 50);
  };
  S3.cameraMode = () => cam.mode;
  function stepCamera(dt, model) {
    const k = 1 - Math.exp(-dt * 3.6), g = cam.g, b = model && model.ball;
    if (cam.drone) g.az += dt * .09;
    if (cam.follow === "ball" && b) { const f = cam.mode === "end" ? .45 : .62; g.tx = clamp((b.x - W / 2) * f, -34, 34); g.tz = cam.mode === "end" ? clamp((b.y - H / 2) * .4, -12, 12) : clamp((b.y - H / 2) * .18, -6, 6); g.ty = 1; }
    else if (cam.follow === "player" && model && model.followIdx !== undefined && rigs[model.followIdx] && rigs[model.followIdx].root.visible) { const r = rigs[model.followIdx]; g.tx = r.root.position.x; g.tz = r.root.position.z; g.ty = 1.3; g.az = r.heading + Math.PI + Math.round((cam.az - r.heading - Math.PI) / TAU) * TAU; }
    cam.az += (g.az - cam.az) * k; cam.el += (g.el - cam.el) * k; cam.dist += (g.dist - cam.dist) * k; cam.fov += (g.fov - cam.fov) * k;
    const kt = 1 - Math.exp(-dt * 4.5); cam.tx += (g.tx - cam.tx) * kt; cam.ty += (g.ty - cam.ty) * kt; cam.tz += (g.tz - cam.tz) * kt;
    const ce = Math.cos(cam.el); camera.position.set(cam.tx + cam.dist * ce * Math.sin(cam.az), Math.max(.6, cam.ty + cam.dist * Math.sin(cam.el)), cam.tz + cam.dist * ce * Math.cos(cam.az));
    camera.fov = cam.fov; camera.updateProjectionMatrix(); camera.lookAt(cam.tx, cam.ty, cam.tz); camera.updateMatrixWorld();
  }

  /* ---------- public api ---------- */
  S3.init = function (container) {
    T = window.THREE; host = container; if (!T) return false;
    try {
      const params = new URLSearchParams(location.search), headless = !!navigator.webdriver;
      if (params.get("q")) S3.quality = params.get("q"); else if (headless) S3.quality = "low";
      renderer = new T.WebGLRenderer({ antialias: S3.quality !== "low", powerPreference: "high-performance", preserveDrawingBuffer: true });
      if (!renderer.getContext()) return false;
      renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
      const cv = renderer.domElement; cv.id = "gl"; cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block"; host.insertBefore(cv, host.firstChild);
      scene = new T.Scene(); scene.fog = new T.Fog(col(0x0b1328), 150, 460);
      const sky = new T.Mesh(new T.SphereGeometry(520, 24, 16), new T.MeshBasicMaterial({ map: skyTexture(), side: T.BackSide, fog: false, toneMapped: false })); scene.add(sky);
      camera = new T.PerspectiveCamera(30, 1.6, .5, 1400);
      hemi = new T.HemisphereLight(col(0xb9ccff), col(0x1d4224), .62); scene.add(hemi); scene.add(new T.AmbientLight(col(0x8fa0c8), .16));
      sun = new T.DirectionalLight(col(0xfff3df), 1.25); sun.position.set(-26, 74, 40); sun.target.position.set(0, 0, 0); sun.castShadow = true;
      const sc = sun.shadow.camera; sc.left = -66; sc.right = 66; sc.top = 46; sc.bottom = -46; sc.near = 20; sc.far = 190; sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
      scene.add(sun, sun.target);
      S3.setQuality(S3.quality, true);
      const ground = new T.Mesh(new T.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: col(0x0c1410), roughness: 1 })); ground.position.y = -.04; scene.add(ground);
      const pitchMesh = new T.Mesh(new T.PlaneGeometry(W + 2 * MARG, H + 2 * MARG).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: pitchTexture(), roughness: .93, metalness: 0 })); pitchMesh.receiveShadow = true; scene.add(pitchMesh);
      teamMats(); buildStadium(); buildBall();
      for (let t = 0; t < 2; t++) for (let i = 1; i <= 11; i++) rigs.push(makeRig(t, i));
      applyKits(); clock = new T.Clock(); S3.ok = true; S3.canvas = cv; S3.resize(); return true;
    } catch (e) { console.error("3D init failed", e); S3.ok = false; return false; }
  };
  S3.setQuality = function (q, silent) {
    S3.quality = q; if (!renderer) return;
    renderer.setPixelRatio(q === "high" ? Math.min(2, window.devicePixelRatio || 1) : 1);
    const size = q === "high" ? (renderer.capabilities.maxTextureSize >= 8192 ? 4096 : 2048) : q === "med" ? 2048 : 1024;
    sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    if (!silent) S3.resize();
  };
  S3.resize = function () {
    if (!renderer || !host) return; vw = host.clientWidth || 800; vh = host.clientHeight || 500;
    renderer.setSize(vw, vh, false); camera.aspect = vw / vh; camera.updateProjectionMatrix();
  };
  S3.setOverlay = function (canvas) {
    overlayTex = new T.CanvasTexture(canvas); overlayTex.encoding = T.sRGBEncoding; overlayTex.anisotropy = 8; overlayTex.minFilter = T.LinearFilter;
    overlayMesh = new T.Mesh(new T.PlaneGeometry(W + 2 * MARG, H + 2 * MARG).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: overlayTex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    overlayMesh.position.y = .03; overlayMesh.renderOrder = 2; scene.add(overlayMesh);
  };
  S3.touchOverlay = () => { if (overlayTex) overlayTex.needsUpdate = true; };
  S3.setKits = function (home, away, gkHome, gkAway) { kit.c = [home, away]; if (gkHome) kit.gk = [gkHome, gkAway]; if (S3.ok) applyKits(); };
  S3.setLabel = function (team, num, name) { labels[team + ":" + num] = name || ""; const r = rigs[team * 11 + num - 1]; if (r && S3.ok) labelRig(r); };
  S3.project = function (x, y, z) {
    camera.updateMatrixWorld(); const v = new T.Vector3(x - W / 2, z || 0, y - H / 2), d = v.distanceTo(camera.position); v.project(camera);
    return [(v.x * .5 + .5) * vw, (-v.y * .5 + .5) * vh, (vh / 2) / (Math.tan(camera.fov * Math.PI / 360) * d)];
  };
  const ray = new (window.THREE ? window.THREE.Raycaster : function () { })();
  S3.ground = function (sx, sy) {
    camera.updateMatrixWorld(); ray.setFromCamera({ x: sx / vw * 2 - 1, y: -(sy / vh) * 2 + 1 }, camera); const o = ray.ray.origin, d = ray.ray.direction;
    if (d.y > -1e-4) return null; const t = -o.y / d.y; return [o.x + d.x * t + W / 2, o.z + d.z * t + H / 2];
  };
  S3.size = () => [vw, vh];
  S3.camState = () => ({ az: cam.az, el: cam.el, dist: cam.dist, mode: cam.mode });
  /* model: {players:[{team,num,x,y,vx,vy,gk,kick,sel,spot,look}], ball:{x,y,z}, follow:{x,y,heading}, animDt} */
  S3.render = function (model, dt) {
    if (!S3.ok) return; tNow += dt;
    const seen = new Set(), ad = model.animDt || 0;
    for (const p of model.players) {
      const idx = p.team * 11 + p.num - 1, r = rigs[idx]; if (!r) continue;
      seen.add(idx); r.root.visible = true; setGK(r, !!p.gk);
      r.root.position.set(p.x - W / 2, 0, p.y - H / 2); pose(r, p, dt, ad, model.ball ? [model.ball.x, model.ball.y] : null);
      r.ring.visible = !!p.sel; r.cone.visible = !!p.spot; if (p.sel) r.ring.rotation.y += dt * .8;
      r.blob.visible = true;
    }
    rigs.forEach((r, i) => { if (!seen.has(i)) r.root.visible = false; });
    const b = model.ball;
    if (b && b.visible !== false) {
      ballMesh.visible = true; const R = .19, bx = b.x - W / 2, bz = b.y - H / 2, by = Math.max(R, b.z || R);
      if (ballPrev) {
        const dx = bx - ballPrev[0], dz = bz - ballPrev[1], dy = by - ballPrev[2], d = Math.hypot(dx, dz, dy);
        if (d > 1e-5 && d < 12 && ad > 0) { const ax = new T.Vector3(dz, 0, -dx).add(new T.Vector3(0, 0, 0)); if (ax.lengthSq() > 1e-9) { ax.normalize(); ballMesh.rotateOnWorldAxis(ax, d / R * .9); } }
      }
      ballPrev = [bx, bz, by]; ballMesh.position.set(bx, by, bz);
      const h = Math.max(0, by - R), sc = 1.1 + h * .12; ballShadow.visible = true; ballShadow.position.set(bx, .04, bz); ballShadow.scale.set(sc, 1, sc); ballShadow.material.opacity = clamp(1 - h * .06, .35, 1);
      const hist = ballTrail.userData.hist; hist.unshift([bx, by, bz]); if (hist.length > 14) hist.pop();
      const pos = ballTrail.geometry.attributes.position, speedy = ballPrev && ad > 0; for (let i = 0; i < 14; i++) { const q = hist[Math.min(i, hist.length - 1)] || [bx, by, bz]; pos.setXYZ(i, q[0], q[1], q[2]); }
      pos.needsUpdate = true; ballTrail.visible = ad > 0 && hist.length > 3;
    } else { ballMesh.visible = false; ballShadow.visible = false; ballTrail.visible = false; ballPrev = null; }
    flags.forEach((f, i) => { f.rotation.y = Math.sin(tNow * 3 + i) * .35; f.rotation.z = Math.sin(tNow * 5 + i * 2) * .06; });
    flashes.forEach(fl => { const v = Math.sin(tNow * fl.f * 9 + fl.p); fl.pts.material.opacity = v > .94 ? 1 : 0; });
    stepCamera(dt, model);
    renderer.render(scene, camera);
  };
  S3.snapshot = () => S3.canvas;
  S3._dbg = () => ({ scene, camera, renderer });
})();
