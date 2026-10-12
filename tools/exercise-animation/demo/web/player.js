/*
 * Exercise animation player (WebGL 1, no dependencies, ~8 KB).
 *
 * Plays an animation exported by export_web.py: a static body image, a few RGBA
 * cut-outs and the motion parameters. The pose is recomputed for every screen
 * refresh, so playback follows the display rate (60/120 Hz) at any speed.
 *
 *   const p = await ExercisePlayer.create(canvas, "web/bench_press/");
 *   p.play(); p.pause(); p.setSpeed(0.5); p.renderAt(0.5);
 *
 * The math mirrors animate.py (timeline, ease, arc, affine interpolation, 2-bone IK,
 * linear-blend skinning); keep both in sync when changing one.
 */
(function (global) {
  "use strict";

  // ---------------- timing ----------------
  function ease(x, kind) {
    x = Math.min(Math.max(x, 0), 1);
    if (kind === "linear") return x;
    if (kind === "sine") return 0.5 - 0.5 * Math.cos(Math.PI * x);
    if (kind === "smoothstep") return x * x * (3 - 2 * x);
    return x * x * x * (x * (6 * x - 15) + 10); // smootherstep
  }

  function makeTimeline(tm) {
    const hA = tm.hold_A, up = tm.A_to_B, hB = tm.hold_B, down = tm.B_to_A;
    const total = hA + up + hB + down;
    const kUp = tm.ease_A_to_B || tm.ease || "smootherstep";
    const kDn = tm.ease_B_to_A || tm.ease || "smootherstep";
    const offset = (tm.start || "mid_hold_A") === "mid_hold_A" ? hA / 2 : 0;
    return {
      total: total,
      s: function (time) {
        let t = (time + offset) % total;
        if (t < 0) t += total;
        if (t < hA) return 0;
        if (t < hA + up) return ease((t - hA) / up, kUp);
        if (t < hA + up + hB) return 1;
        return 1 - ease((t - hA - up - hB) / down, kDn);
      },
    };
  }

  // ---------------- geometry ----------------
  const lerp = (a, b, s) => a + (b - a) * s;
  const lerp2 = (a, b, s) => [lerp(a[0], b[0], s), lerp(a[1], b[1], s)];

  function compose(p) {
    const c = Math.cos(p[2]), s = Math.sin(p[2]);
    const sx = Math.exp(p[3]), sy = Math.exp(p[4]), k = p[5];
    // R(theta) @ [[sx, k*sx],[0, sy]]
    return [c * sx, c * k * sx - s * sy, s * sx, s * k * sx + c * sy];
  }

  function ikElbow(G, S, L1, L2, sign) {
    const vx = S[0] - G[0], vy = S[1] - G[1];
    let d = Math.hypot(vx, vy);
    const ux = vx / Math.max(d, 1e-6), uy = vy / Math.max(d, 1e-6);
    if (d >= L1 + L2) {
      const f = (d * L1) / (L1 + L2);
      return [G[0] + ux * f, G[1] + uy * f];
    }
    d = Math.max(d, Math.abs(L1 - L2) + 1e-3);
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(L1 * L1 - a * a, 0));
    return [G[0] + a * ux - sign * h * uy, G[1] + a * uy + sign * h * ux];
  }

  // ---------------- WebGL ----------------
  const VS =
    "attribute vec2 p;attribute vec2 uv;attribute float al;uniform vec2 res;varying vec2 v;varying float a;" +
    "void main(){v=uv;a=al;gl_Position=vec4(p.x/res.x*2.0-1.0,1.0-p.y/res.y*2.0,0.0,1.0);}";
  const FS =
    "precision mediump float;uniform sampler2D t;varying vec2 v;varying float a;" +
    "void main(){gl_FragColor=texture2D(t,v)*a;}";

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }

  function loadImage(url) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("cannot load " + url));
      im.src = url;
    });
  }

  function texture(gl, src) {
    const tx = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tx;
  }

  function shaftTexture(gl, profile, thick) {
    // 1 x 96 strip: across-the-bar colour profile with anti-aliased edges
    const n = 96, span = 1.3, c = document.createElement("canvas");
    c.width = 1;
    c.height = n;
    const ctx = c.getContext("2d"), img = ctx.createImageData(1, n), m = profile.length;
    for (let r = 0; r < n; r++) {
      const vn = ((r + 0.5) / n - 0.5) * span; // in units of thickness
      const idx = (Math.min(Math.max(vn, -0.5), 0.5) + 0.5) * (m - 1);
      const i0 = Math.floor(idx), i1 = Math.min(i0 + 1, m - 1), f = idx - i0;
      const al = Math.min(Math.max((0.5 - Math.abs(vn)) * thick + 0.5, 0), 1);
      for (let k = 0; k < 3; k++) img.data[r * 4 + k] = lerp(profile[i0][k], profile[i1][k], f);
      img.data[r * 4 + 3] = al * 255;
    }
    ctx.putImageData(img, 0, 0);
    return { tex: texture(gl, c), span: span };
  }

  async function create(canvas, base, opts) {
    opts = opts || {};
    base = base.endsWith("/") ? base : base + "/";
    const data = await (await fetch(base + "anim.json")).json();
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: false, antialias: true });
    if (!gl) throw new Error("WebGL unavailable");
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const loc = { p: gl.getAttribLocation(prog, "p"), uv: gl.getAttribLocation(prog, "uv"), al: gl.getAttribLocation(prog, "al") };
    gl.uniform2f(gl.getUniformLocation(prog, "res"), data.width, data.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const vbuf = gl.createBuffer(), ibuf = gl.createBuffer();
    const timeline = makeTimeline(data.timing);
    const arc = data.arc;
    const arcAt = (s) => [arc[0] * 4 * s * (1 - s), arc[1] * 4 * s * (1 - s)];

    // prepare layers
    const layers = [];
    for (const L of data.layers) {
      const o = Object.assign({}, L);
      if (L.image) o.tex = texture(gl, await loadImage(base + L.image));
      if (L.type === "shaft") {
        const T = (L.thickness.A + L.thickness.B) / 2;
        Object.assign(o, shaftTexture(gl, L.profile, T));
      }
      if (L.type === "limb") {
        o.v = new Float32Array(L.verts);
        o.n = o.v.length / 7;
        o.idx = new Uint16Array(L.tris);
        o.out = new Float32Array(o.n * 5);
        const [x0, y0, x1, y1] = L.box;
        for (let i = 0; i < o.n; i++) {
          o.out[i * 5 + 2] = (o.v[i * 7] - x0) / (x1 - x0);
          o.out[i * 5 + 3] = (o.v[i * 7 + 1] - y0) / (y1 - y0);
          o.out[i * 5 + 4] = 1;
        }
        o.ibuf = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.ibuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, o.idx, gl.STATIC_DRAW);
      }
      layers.push(o);
    }

    function drawArrays(verts, tex, mode, count) {
      gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(loc.p);
      gl.enableVertexAttribArray(loc.uv);
      gl.enableVertexAttribArray(loc.al);
      gl.vertexAttribPointer(loc.p, 2, gl.FLOAT, false, 20, 0);
      gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, 20, 8);
      gl.vertexAttribPointer(loc.al, 1, gl.FLOAT, false, 20, 16);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (mode === "elements") gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
      else gl.drawArrays(gl.TRIANGLE_STRIP, 0, count);
    }

    function quad(M, box, tex) {
      // M maps source px -> target px: [a, b, c, d, tx, ty]
      const [x0, y0, x1, y1] = box;
      const P = (x, y) => [M[0] * x + M[1] * y + M[4], M[2] * x + M[3] * y + M[5]];
      const a = P(x0, y0), b = P(x1, y0), c = P(x0, y1), d = P(x1, y1);
      drawArrays(new Float32Array([a[0], a[1], 0, 0, 1, b[0], b[1], 1, 0, 1, c[0], c[1], 0, 1, 1, d[0], d[1], 1, 1, 1]), tex, "strip", 4);
    }

    function drawRigid(L, s) {
      const p = L.pA.map((v, i) => lerp(v, L.pB[i], s));
      const lin = compose(p);
      const off = arcAt(s);
      const cx = lerp(L.cA[0], L.cB[0], s) + off[0], cy = lerp(L.cA[1], L.cB[1], s) + off[1];
      const tx = cx - (lin[0] * L.pivot[0] + lin[1] * L.pivot[1]);
      const ty = cy - (lin[2] * L.pivot[0] + lin[3] * L.pivot[1]);
      quad([lin[0], lin[1], lin[2], lin[3], tx, ty], L.box, L.tex);
    }

    function drawShaft(L, s) {
      const off = arcAt(s);
      const P0 = lerp2(L.ends.A[0], L.ends.B[0], s), P1 = lerp2(L.ends.A[1], L.ends.B[1], s);
      P0[0] += off[0]; P0[1] += off[1]; P1[0] += off[0]; P1[1] += off[1];
      const T = lerp(L.thickness.A, L.thickness.B, s);
      const len = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]);
      const dx = (P1[0] - P0[0]) / len, dy = (P1[1] - P0[1]) / len, nx = -dy, ny = dx;
      const hw = (T * L.span) / 2, f = Math.min(L.fade || 0, len);
      const v = [];
      for (const [t, al] of [[0, 0], [f, 1], [len, 1]]) {
        const cx = P0[0] + dx * t, cy = P0[1] + dy * t;
        v.push(cx - nx * hw, cy - ny * hw, 0.5, 0, al, cx + nx * hw, cy + ny * hw, 0.5, 1, al);
      }
      drawArrays(new Float32Array(v), L.tex, "strip", 6);
    }

    function drawLimb(L, s) {
      const J = L.joints, off = arcAt(s);
      const G = lerp2(J.A[0], J.B[0], s);
      G[0] += off[0]; G[1] += off[1];
      const S = lerp2(J.A[2], J.B[2], s);
      const L1 = lerp(L.lengths.A[0], L.lengths.B[0], s), L2 = lerp(L.lengths.A[1], L.lengths.B[1], s);
      const E = ikElbow(G, S, L1, L2, L.sign);
      E[0] += lerp(L.corr.A[0], L.corr.B[0], s);
      E[1] += lerp(L.corr.A[1], L.corr.B[1], s);
      const tj = [G, E, S], sj = J[L.src];
      let wd = null;
      if (L.widths.A && L.widths.B) wd = L.widths.A.map((w, i) => lerp(w, L.widths.B[i], s));
      const bones = [];
      for (let b = 0; b < 2; b++) {
        const t0 = tj[b], t1 = tj[b + 1];
        const Lt = Math.hypot(t1[0] - t0[0], t1[1] - t0[1]);
        const dx = (t1[0] - t0[0]) / Lt, dy = (t1[1] - t0[1]) / Lt;
        let kw = 1;
        if (wd) { const ws = L.widths[L.src]; kw = (wd[b] + wd[b + 1]) / (ws[b] + ws[b + 1]); }
        bones.push([t0[0], t0[1], Lt * dx, Lt * dy, -dy * kw, dx * kw]);
      }
      const v = L.v, out = L.out, b0 = bones[0], b1 = bones[1];
      for (let i = 0; i < L.n; i++) {
        const k = i * 7, u0 = v[k + 2], v0 = v[k + 3], u1 = v[k + 4], v1 = v[k + 5], w1 = v[k + 6], w0 = 1 - w1;
        out[i * 5] = w0 * (b0[0] + u0 * b0[2] + v0 * b0[4]) + w1 * (b1[0] + u1 * b1[2] + v1 * b1[4]);
        out[i * 5 + 1] = w0 * (b0[1] + u0 * b0[3] + v0 * b0[5]) + w1 * (b1[1] + u1 * b1[3] + v1 * b1[5]);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, L.ibuf);
      drawArrays(out, L.tex, "elements", L.idx.length);
    }

    function resize() {
      const dpr = Math.min(global.devicePixelRatio || 1, 3);
      const w = Math.min(Math.round(canvas.clientWidth * dpr), opts.maxWidth || data.width);
      const h = Math.round((w * data.height) / data.width);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function renderAt(s) {
      resize();
      gl.clearColor(1, 1, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      for (const L of layers) {
        if (L.type === "body") quad([1, 0, 0, 1, 0, 0], L.box, L.tex);
        else if (L.type === "rigid") drawRigid(L, s);
        else if (L.type === "shaft") drawShaft(L, s);
        else if (L.type === "limb") drawLimb(L, s);
      }
    }

    // ---------------- playback ----------------
    let playing = false, speed = 1, animTime = 0, last = null, raf = 0;
    const listeners = [];
    function frame(now) {
      if (last !== null) animTime += ((now - last) / 1000) * speed;
      last = now;
      const s = timeline.s(animTime);
      renderAt(s);
      for (const f of listeners) f(animTime % timeline.total, s);
      if (playing) raf = requestAnimationFrame(frame);
    }
    const api = {
      data: data,
      duration: timeline.total,
      play() { if (!playing) { playing = true; last = null; raf = requestAnimationFrame(frame); } },
      pause() { playing = false; cancelAnimationFrame(raf); },
      get playing() { return playing; },
      setSpeed(r) { speed = r; },
      seek(t) { animTime = t; renderAt(timeline.s(t)); },
      renderAt: renderAt,
      poseAt: (t) => timeline.s(t),
      onFrame(f) { listeners.push(f); },
    };
    document.addEventListener("visibilitychange", () => { if (document.hidden) last = null; });
    renderAt(timeline.s(0));
    return api;
  }

  global.ExercisePlayer = { create: create };
})(window);
