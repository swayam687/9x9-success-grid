import { toast, vibrate } from "./utils.js";

export const THEMES = [
  { id: "deep",   name: "Deep Focus", desc: "Near-black · cool accents" },
  { id: "sunset", name: "Sunset",     desc: "Warm · cozy · motivating" },
  { id: "neon",   name: "Neon Grid",  desc: "Electric cyan · high energy" }
];

export function applyTheme(id) {
  document.documentElement.dataset.theme = id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const colors = { deep: "#0a0a0a", sunset: "#13111C", neon: "#0A0E17" };
    meta.setAttribute("content", colors[id] || "#0a0a0a");
  }
}

const THEME_CONFETTI = {
  deep:   ["#5B8DEF", "#30A46C", "#8E4EC6", "#D29922", "#fafafa"],
  sunset: ["#FF6B4A", "#4ADE80", "#A78BFA", "#FBBF24", "#F5F1EA"],
  neon:   ["#00D4FF", "#00FF88", "#B56EFF", "#FFB020", "#E5EDF9"]
};

function spawnConfetti(opts = {}) {
  const particleCount = opts.particleCount || 60;
  const spread = opts.spread || 70;
  const originX = opts.origin?.x ?? 0.5;
  const originY = opts.origin?.y ?? 0.6;
  const colors = opts.colors || THEME_CONFETTI.deep;
  const scalar = opts.scalar || 1;

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;width:100%;height:100%";
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const cx = originX * window.innerWidth;
  const cy = originY * window.innerHeight;
  const spreadRad = (spread / 2) * (Math.PI / 180);

  const particles = [];
  for (let i = 0; i < particleCount; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * spreadRad * 2;
    const velocity = (7 + Math.random() * 9) * scalar;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * velocity + (Math.random() - 0.5) * 2,
      vy: Math.sin(angle) * velocity,
      size: (5 + Math.random() * 7) * scalar,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.3,
      life: 1,
      decay: 0.006 + Math.random() * 0.008,
      shape: Math.random() < 0.5 ? "square" : "rect"
    });
  }

  let raf;
  const tick = () => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    let alive = false;

    for (const p of particles) {
      if (p.life <= 0) continue;
      alive = true;
      p.vy += 0.35;
      p.vx *= 0.99;
      p.vy *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rotSpeed;
      p.life -= p.decay;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === "square") {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.4);
      }
      ctx.restore();
    }

    if (alive) {
      raf = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(raf);
      canvas.remove();
    }
  };
  tick();
}

export function celebrate(level = "medium") {
  const theme = document.documentElement.dataset.theme || "deep";
  const colors = THEME_CONFETTI[theme] || THEME_CONFETTI.deep;

  if (level === "small") {
    vibrate(10);
    return;
  }

  const presets = {
    medium: { particleCount: 60,  spread: 70,  origin: { y: 0.6 }, colors, scalar: 1 },
    big:    { particleCount: 140, spread: 100, origin: { y: 0.6 }, colors, scalar: 1.1 },
    huge:   { particleCount: 220, spread: 140, origin: { y: 0.6 }, colors, scalar: 1.2 }
  };
  spawnConfetti(presets[level] || presets.medium);

  vibrate(level === "huge" ? [40, 60, 40] : level === "big" ? [30, 50, 30] : 20);
}

let modalOpen = false;
let onCloseCallback = null;

export function openModal(html, opts = {}) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `<div class="modal-backdrop" data-action="close-modal"></div>
    <aside class="drawer" role="dialog" aria-modal="true">
      <div class="drawer-handle"></div>
      ${html}
    </aside>`;
  root.hidden = false;
  document.body.style.overflow = "hidden";
  onCloseCallback = opts.onClose || null;

  if (!modalOpen) {
    modalOpen = true;
    history.pushState({ modal: true }, "");
  }

  // Drag-to-close logic for mobile bottom sheet
  const drawer = root.querySelector(".drawer");
  const handle = root.querySelector(".drawer-handle");
  if (!handle) return;

  let startY = 0, currentY = 0, isDragging = false;

  handle.addEventListener("touchstart", (e) => {
    startY = e.touches[0].clientY;
    isDragging = true;
    drawer.style.transition = "none";
  }, { passive: true });

  handle.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const dy = Math.max(0, currentY - startY);
    drawer.style.transform = `translateY(${dy}px)`;
  }, { passive: true });

  handle.addEventListener("touchend", () => {
    if (!isDragging) return;
    isDragging = false;
    drawer.style.transition = "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)";
    const dy = currentY - startY;
    if (dy > 100) {
      closeModal();
    } else {
      drawer.style.transform = "";
    }
  });
}

export function closeModal(pop = true) {
  const root = document.getElementById("modalRoot");
  const wasOpen = !root.hidden;
  root.hidden = true;
  root.innerHTML = "";
  document.body.style.overflow = "";
  const cb = onCloseCallback;
  onCloseCallback = null;
  modalOpen = false;
  if (pop && wasOpen && history.state?.modal) history.back();
  if (cb) cb();
}

export function isModalOpen() {
  return modalOpen;
}

export function modalFoot(primaryLabel, primaryAction, opts = {}) {
  return `<div class="drawer-foot">
    <button class="btn" data-action="close-modal">${opts.cancelLabel || "Cancel"}</button>
    <button class="btn primary" data-action="${primaryAction}">${primaryLabel}</button>
  </div>`;
}

export { toast };