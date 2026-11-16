// Canvas effects: drifting embers, hammer sparks, impact rings.
// Everything is sized to the scene and DPR aware.

export const fx = (() => {
  let canvas = null;
  let ctx = null;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let raf = 0;
  let last = 0;
  let emberClock = 0;

  const embers = [];
  const sparks = [];
  const rings = [];

  function resize() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, Math.floor(rect.width));
    H = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawnEmber() {
    const size = 0.8 + Math.random() * 1.9;
    embers.push({
      x: Math.random() * W,
      y: H + 8 + Math.random() * 30,
      vx: (Math.random() - 0.5) * 9,
      vy: -(11 + Math.random() * 26),
      size,
      life: 5 + Math.random() * 7,
      max: 0,
      wob: Math.random() * Math.PI * 2,
      hot: Math.random(),
    });
    const e = embers[embers.length - 1];
    e.max = e.life;
  }

  function addSparks(list, x, y, n, opts) {
    const { color = "#ffb45e", speed = 210, spread = Math.PI * 2, upward = -90, size = 2.1, life = 0.7 } = opts || {};
    for (let i = 0; i < n; i += 1) {
      const angle = -Math.PI * 0.1 + (Math.random() - 0.5) * spread;
      const v = speed * (0.35 + Math.random() * 0.9);
      list.push({
        x, y,
        vx: Math.cos(angle) * v * (opts ? 1 : 0.6),
        vy: Math.sin(angle) * v + upward,
        life: life * (0.5 + Math.random() * 0.8),
        max: life,
        size: size * (0.5 + Math.random()),
        color,
        gravity: 420,
      });
    }
  }

  function strike(x, y, crit) {
    rings.push({ x, y, r: 12, maxR: crit ? 88 : 58, life: 0.42, max: 0.42, width: crit ? 3.5 : 2 });
    addSparks(sparks, x, y, crit ? 30 : 16, {
      color: crit ? "#ffe9a8" : "#ffae54",
      speed: crit ? 300 : 200,
      spread: Math.PI * 1.1,
      upward: -150,
      size: crit ? 2.6 : 2,
      life: crit ? 0.9 : 0.65,
    });
    if (crit) {
      addSparks(sparks, x, y, 12, { color: "#fff6d8", speed: 160, spread: Math.PI, upward: -220, size: 1.6, life: 1 });
    }
  }

  function burst(x, y, color = "#7fe0d0", count = 34) {
    rings.push({ x, y, r: 10, maxR: 96, life: 0.55, max: 0.55, width: 3 });
    addSparks(sparks, x, y, count, {
      color, speed: 320, spread: Math.PI * 2, upward: -40, size: 2.4, life: 0.9,
    });
    addSparks(sparks, x, y, Math.round(count / 2), {
      color: "#ffffff", speed: 140, spread: Math.PI * 2, upward: -60, size: 1.2, life: 0.6,
    });
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!ctx) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;

    ctx.clearRect(0, 0, W, H);

    // Ambient embers
    emberClock += dt;
    const target = W < 560 ? 34 : 56;
    if (emberClock > 0.12 && embers.length < target) {
      emberClock = 0;
      spawnEmber();
    }

    ctx.globalCompositeOperation = "lighter";

    for (let i = embers.length - 1; i >= 0; i -= 1) {
      const e = embers[i];
      e.life -= dt;
      if (e.life <= 0 || e.y < -30) {
        embers.splice(i, 1);
        continue;
      }
      e.wob += dt * 2.2;
      e.x += (e.vx + Math.sin(e.wob) * 12) * dt;
      e.y += e.vy * dt;
      e.vy += 3 * dt;
      const a = Math.min(1, e.life / 1.6) * (0.25 + e.hot * 0.45);
      const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.size * 5);
      grad.addColorStop(0, `rgba(255,${170 + Math.floor(e.hot * 60)},90,${a})`);
      grad.addColorStop(0.4, `rgba(255,130,50,${a * 0.4})`);
      grad.addColorStop(1, "rgba(255,110,40,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size * 5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const s = sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      s.vy += s.gravity * dt;
      s.vx *= 1 - 1.1 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const t = Math.max(0, s.life / s.max);
      ctx.globalAlpha = t;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * (0.5 + t * 0.8), 0, Math.PI * 2);
      ctx.fill();
      // short motion tail
      ctx.globalAlpha = t * 0.35;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size * 0.6;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.018, s.y - s.vy * 0.018);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (let i = rings.length - 1; i >= 0; i -= 1) {
      const r = rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        rings.splice(i, 1);
        continue;
      }
      const p = 1 - r.life / r.max;
      const radius = r.r + (r.maxR - r.r) * p;
      ctx.globalAlpha = (1 - p) * 0.6;
      ctx.lineWidth = r.width * (1 - p * 0.6);
      ctx.strokeStyle = "rgba(255,205,120,1)";
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  return {
    init(canvasEl) {
      canvas = canvasEl;
      if (!canvas) return;
      ctx = canvas.getContext("2d");
      resize();
      window.addEventListener("resize", resize, { passive: true });
      if (typeof ResizeObserver !== "undefined") {
        try { new ResizeObserver(resize).observe(canvas); } catch { /* ignore */ }
      }
      // Seed a little ambience immediately.
      for (let i = 0; i < 18; i += 1) {
        spawnEmber();
        const e = embers[embers.length - 1];
        e.y = Math.random() * H;
        e.life = 2 + Math.random() * 7;
        e.max = e.life;
      }
    },
    start() {
      if (!raf) raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
    strike,
    burst,
    resize,
  };
})();
