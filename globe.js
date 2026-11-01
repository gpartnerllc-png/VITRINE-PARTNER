// Animated neural globe for the hero. Pure canvas, no dependencies.
const TAU = Math.PI * 2;

function fibSphere(count) {
  const nodes = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    nodes.push({
      x: Math.cos(theta) * r,
      y,
      z: Math.sin(theta) * r,
      hue: (Math.sin(i * 12.9898) * 43758.5453) % 1,
    });
  }
  return nodes;
}

function buildEdges(nodes, maxEdges) {
  const edges = [];
  const threshold = 0.46;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    let best = [];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dz = a.z - b.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < threshold * threshold) best.push({ j, d });
    }
    best.sort((x, y) => x.d - y.d);
    for (let k = 0; k < Math.min(3, best.length); k++) {
      edges.push([i, best[k].j]);
      if (edges.length >= maxEdges) return edges;
    }
  }
  return edges;
}

export function initGlobe(canvas, opts = {}) {
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return { destroy() {} };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;
  let radius = 200;
  let cx = 0;
  let cy = 0;
  let nodes = [];
  let edges = [];
  let pulses = [];
  let stars = [];
  let raf = 0;
  let visible = true;
  let running = false;
  let t = 0;
  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;

  const palette = ["#a78bfa", "#22d3ee", "#f5c45e", "#e9d5ff", "#67e8f9"];

  function setup() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const area = width * height;
    const count = Math.round(Math.min(760, Math.max(260, area / 2100)));
    radius = Math.min(width, height) * (width < 720 ? 0.38 : 0.335);
    cx = width * 0.5;
    cy = height * (width < 720 ? 0.46 : 0.475);

    nodes = fibSphere(count);
    edges = buildEdges(nodes, Math.round(count * 2.6));
    pulses = Array.from({ length: 18 }, () => ({
      e: Math.floor(Math.random() * edges.length),
      t: Math.random(),
      speed: 0.0016 + Math.random() * 0.0026,
    }));
    stars = Array.from({ length: Math.round(Math.min(120, area / 12000)) }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.3 + 0.35,
      a: Math.random() * 0.5 + 0.12,
      s: Math.random() * 0.0008 + 0.0002,
    }));
  }

  const cos = Math.cos;
  const sin = Math.sin;

  function rotatePoint(p, ay, ax) {
    const x1 = p.x * cos(ay) - p.z * sin(ay);
    const z1 = p.x * sin(ay) + p.z * cos(ay);
    const y1 = p.y * cos(ax) - z1 * sin(ax);
    const z2 = p.y * sin(ax) + z1 * cos(ax);
    return { x: x1, y: y1, z: z2 };
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);

    for (const s of stars) {
      s.a = 0.12 + Math.abs(Math.sin(time * s.s * 2 + s.x)) * 0.38;
      ctx.beginPath();
      ctx.fillStyle = `rgba(220, 225, 255, ${s.a.toFixed(3)})`;
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }

    const ay = t * 0.00013 + mouseX * 0.5;
    const ax = -0.24 + mouseY * 0.32;
    const pts = new Array(nodes.length);
    for (let i = 0; i < nodes.length; i++) {
      const r = rotatePoint(nodes[i], ay, ax);
      const persp = 1.9 / (1.9 - r.z * 0.62);
      pts[i] = {
        x: cx + r.x * radius * persp,
        y: cy + r.y * radius * persp,
        z: r.z,
        s: persp,
      };
    }

    ctx.lineWidth = 1;
    const edgeCount = edges.length;
    for (let e = 0; e < edgeCount; e++) {
      const [a, b] = edges[e];
      const pa = pts[a];
      const pb = pts[b];
      const depth = (pa.z + pb.z) * 0.5;
      if (depth < -0.42) continue;
      const alpha = Math.max(0, (depth + 0.62) / 1.62) * 0.32;
      ctx.strokeStyle = `rgba(150, 150, 235, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    for (let i = 0; i < nodes.length; i++) {
      const p = pts[i];
      if (p.z < -0.5) continue;
      const alpha = 0.18 + (p.z + 1) * 0.42;
      const hue = nodes[i].hue;
      const color = palette[Math.floor((hue + 1.4) * palette.length) % palette.length];
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (p.z > 0.55 ? 1.7 : 1.1) * p.s, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const pulse of pulses) {
      pulse.t += pulse.speed * 16;
      if (pulse.t > 1) {
        pulse.t = 0;
        pulse.e = Math.floor(Math.random() * edges.length);
      }
      const [a, b] = edges[pulse.e];
      const pa = pts[a];
      const pb = pts[b];
      if (pa.z < -0.3 || pb.z < -0.3) continue;
      const x = pa.x + (pb.x - pa.x) * pulse.t;
      const y = pa.y + (pb.y - pa.y) * pulse.t;
      const rad = 7 + Math.sin(pulse.t * Math.PI) * 7;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, "rgba(255, 236, 179, 0.95)");
      grad.addColorStop(0.35, "rgba(245, 196, 94, 0.45)");
      grad.addColorStop(1, "rgba(245, 196, 94, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, TAU);
      ctx.fill();
    }

    const halo = ctx.createRadialGradient(cx, cy, radius * 0.55, cx, cy, radius * 1.25);
    halo.addColorStop(0, "rgba(124, 58, 237, 0)");
    halo.addColorStop(0.55, "rgba(124, 58, 237, 0.08)");
    halo.addColorStop(1, "rgba(34, 211, 238, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.25, 0, TAU);
    ctx.fill();
  }

  function frame(time) {
    t = time;
    mouseX += (targetX - mouseX) * 0.045;
    mouseY += (targetY - mouseY) * 0.045;
    draw(time);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduced) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function onPointer(e) {
    const rect = canvas.getBoundingClientRect();
    targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 0.7;
    targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 0.6;
  }

  function onLeave() {
    targetX = 0;
    targetY = 0;
  }

  const resizeObserver = new ResizeObserver(() => {
    setup();
    if (reduced) draw(0);
  });
  resizeObserver.observe(canvas);

  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !document.hidden) start();
      else stop();
    },
    { threshold: 0.02 },
  );
  io.observe(canvas);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (visible) start();
  });

  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("pointerleave", onLeave, { passive: true });

  setup();
  if (reduced) {
    draw(1200);
  } else {
    start();
  }
  canvas.classList.add("is-live");

  return {
    destroy() {
      stop();
      resizeObserver.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerleave", onLeave);
    },
    redraw() {
      setup();
      draw(0);
    },
  };
}

if (typeof window !== "undefined") {
  window.__initGlobe = initGlobe;
}
