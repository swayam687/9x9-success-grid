// js/ui.js — Themes, a11y modes, confetti, modals, overlays
import { toast, vibrate, esc } from "./utils.js";

/* ============================================================
   THEMES
   ============================================================ */
export const THEMES = [
  { id: "paper",  name: "Paper",      desc: "Light · warm · daytime" },
  { id: "deep",   name: "Deep Focus", desc: "Near-black · cool accents" },
  { id: "sunset", name: "Sunset",     desc: "Warm · cozy · motivating" },
  { id: "neon",   name: "Neon Grid",  desc: "Electric cyan · high energy" }
];

export const A11Y_MODES = [
  { id: "default",  name: "Default",         desc: "Balanced color and contrast" },
  { id: "contrast", name: "High contrast",   desc: "Stronger text · thicker borders" },
  { id: "low-stim", name: "Low stimulation", desc: "Minimal color · calmer motion" }
];

const THEME_COLORS = {
  paper:  "#F7F5F0",
  deep:   "#0A0A0B",
  sunset: "#13111C",
  neon:   "#0A0E17"
};

export function applyTheme(id) {
  const valid = THEMES.some((t) => t.id === id) ? id : "deep";
  document.documentElement.dataset.theme = valid;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[valid] || THEME_COLORS.deep);
}

export function applyA11y(mode) {
  const valid = A11Y_MODES.some((m) => m.id === mode) ? mode : "default";
  document.documentElement.dataset.a11y = valid;
}

export function getA11y() {
  return document.documentElement.dataset.a11y || "default";
}

/* ============================================================
   CONFETTI
   ============================================================ */
const THEME_CONFETTI = {
  paper:  ["#2D6CDF", "#1F8A4C", "#8B5CF6", "#E46F1E", "#1A1815"],
  deep:   ["#5B8DEF", "#30A46C", "#8E4EC6", "#F5A524", "#FAFAFA"],
  sunset: ["#FF6B4A", "#4ADE80", "#A78BFA", "#FBBF24", "#F5F1EA"],
  neon:   ["#00D4FF", "#00FF88", "#B56EFF", "#FFD60A", "#E5EDF9"]
};

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
}

function shouldSkipConfetti() {
  if (getA11y() === "low-stim") return true;
  if (prefersReducedMotion()) return true;
  return false;
}

function spawnConfetti(opts = {}) {
  const particleCount = opts.particleCount || 60;
  const spread = opts.spread || 70;
  const originX = opts.origin?.x ?? 0.5;
  const originY = opts.origin?.y ?? 0.6;
  const colors = opts.colors || THEME_CONFETTI.deep;
  const scalar = opts.scalar || 1;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;width:100%;height:100%";
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
  if (level === "small") {
    vibrate(10);
    return;
  }

  if (shouldSkipConfetti()) {
    vibrate(
      level === "huge" ? [40, 60, 40] : level === "big" ? [30, 50, 30] : 20
    );
    return;
  }

  const theme = document.documentElement.dataset.theme || "deep";
  const colors = THEME_CONFETTI[theme] || THEME_CONFETTI.deep;

  const presets = {
    medium: { particleCount: 60,  spread: 70,  origin: { y: 0.6 }, colors, scalar: 1 },
    big:    { particleCount: 140, spread: 100, origin: { y: 0.6 }, colors, scalar: 1.1 },
    huge:   { particleCount: 220, spread: 140, origin: { y: 0.6 }, colors, scalar: 1.2 }
  };
  spawnConfetti(presets[level] || presets.medium);

  vibrate(
    level === "huge" ? [40, 60, 40] : level === "big" ? [30, 50, 30] : 20
  );
}

/* ============================================================
   MODAL / DRAWER
   ============================================================ */
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

  /** @type {HTMLElement | null} */
  const drawer = /** @type {any} */ (root.querySelector(".drawer"));
  /** @type {HTMLElement | null} */
  const handle = /** @type {any} */ (root.querySelector(".drawer-handle"));
  if (!handle || !drawer) return;

  let startY = 0,
    currentY = 0,
    isDragging = false;

  handle.addEventListener(
    "touchstart",
    (e) => {
      startY = e.touches[0].clientY;
      isDragging = true;
      drawer.style.transition = "none";
    },
    { passive: true }
  );

  handle.addEventListener(
    "touchmove",
    (e) => {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
      const dy = Math.max(0, currentY - startY);
      drawer.style.transform = `translateY(${dy}px)`;
    },
    { passive: true }
  );

  handle.addEventListener("touchend", () => {
    if (!isDragging) return;
    isDragging = false;
    drawer.style.transition =
      "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)";
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

/* ============================================================
   MILESTONE OVERLAY (earned rewards only)
   ------------------------------------------------------------
   Usage:
     openMilestone({
       icon: icons.flame,        // optional, raw SVG string
       kicker: "NEW PERSONAL BEST",
       title: "7-day streak",
       subtitle: "You've never done this before.",
       cta: "Nice"                // optional, default "Nice"
     });
   Auto-dismisses after 5s. Esc closes. Backdrop click closes.
   ============================================================ */
let milestoneOpen = false;
let _milestoneTimer = null;

export function openMilestone({
  icon = "",
  kicker = "MILESTONE",
  title = "",
  subtitle = "",
  cta = "Nice"
} = {}) {
  const root = document.getElementById("milestoneRoot");
  if (!root) return;
  if (_milestoneTimer) {
    clearTimeout(_milestoneTimer);
    _milestoneTimer = null;
  }

  root.innerHTML = `
    <button class="milestone-backdrop" data-milestone-close aria-label="Dismiss"></button>
    <div class="milestone-card" role="dialog" aria-modal="true" aria-live="polite">
      ${icon ? `<div class="milestone-icon">${icon}</div>` : ""}
      <div class="milestone-kicker label">${esc(kicker)}</div>
      <h2 class="milestone-title">${esc(title)}</h2>
      ${subtitle ? `<p class="milestone-sub">${esc(subtitle)}</p>` : ""}
      <button class="btn primary" data-milestone-close>${esc(cta)}</button>
    </div>
  `;
  root.hidden = false;
  milestoneOpen = true;

  root.querySelectorAll("[data-milestone-close]").forEach((el) => {
    el.addEventListener("click", () => closeMilestone());
  });

  _milestoneTimer = setTimeout(() => closeMilestone(), 5000);
}

export function closeMilestone() {
  const root = document.getElementById("milestoneRoot");
  if (!root) return;
  if (_milestoneTimer) {
    clearTimeout(_milestoneTimer);
    _milestoneTimer = null;
  }
  root.hidden = true;
  root.innerHTML = "";
  milestoneOpen = false;
}

export function isMilestoneOpen() {
  return milestoneOpen;
}

/* ============================================================
   FOCUS MODE
   ------------------------------------------------------------
   Usage:
     openFocus({
       goalTitle: "Ship portfolio v1",
       pillarTitle: "CRAFT",
       pillarColor: "var(--pillar-craft)",
       subtaskTitle: "Wire up the About page"
     });
   Fires "focus:done" or "focus:skip" events on document.
   Read elapsed time with getFocusSeconds() before close.
   ============================================================ */
let focusOpen = false;
let _focusTimer = null;
let _focusSeconds = 0;

function updateFocusClock() {
  const el = document.getElementById("focusClock");
  if (!el) return;
  const m = Math.floor(_focusSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (_focusSeconds % 60).toString().padStart(2, "0");
  el.textContent = `${m}:${s}`;
}

function startFocusTimer() {
  stopFocusTimer();
  _focusSeconds = 0;
  updateFocusClock();
  _focusTimer = setInterval(() => {
    _focusSeconds++;
    updateFocusClock();
  }, 1000);
}

function stopFocusTimer() {
  if (_focusTimer) {
    clearInterval(_focusTimer);
    _focusTimer = null;
  }
}

export function openFocus({
  goalTitle = "",
  pillarTitle = "",
  pillarColor = "",
  subtaskTitle = ""
} = {}) {
  const root = document.getElementById("focusRoot");
  if (!root) return;

  root.innerHTML = `
    <div class="focus-screen" role="dialog" aria-modal="true" aria-label="Focus mode">
      <div class="focus-head">
        <div class="focus-crumb" style="color:${pillarColor || "var(--accent)"}">${esc(pillarTitle)}</div>
        <button class="x-btn" data-focus-exit aria-label="Exit focus">×</button>
      </div>
      <div class="focus-body">
        <h2 class="focus-goal">${esc(goalTitle)}</h2>
        <p class="focus-subtask">${esc(subtaskTitle || "No open subtask")}</p>
      </div>
      <div class="focus-timer" id="focusTimer" aria-live="off">
        <span id="focusClock">00:00</span>
      </div>
      <div class="focus-actions">
        <button class="btn primary" data-focus-done>Done</button>
        <button class="btn ghost" data-focus-skip>Skip</button>
      </div>
    </div>
  `;
  root.hidden = false;
  focusOpen = true;

  startFocusTimer();

  root
    .querySelector("[data-focus-exit]")
    ?.addEventListener("click", () => closeFocus());

  root.querySelector("[data-focus-done]")?.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("focus:done"));
    closeFocus();
  });

  root.querySelector("[data-focus-skip]")?.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("focus:skip"));
    closeFocus();
  });
}

export function closeFocus() {
  const root = document.getElementById("focusRoot");
  if (!root) return;
  stopFocusTimer();
  root.hidden = true;
  root.innerHTML = "";
  focusOpen = false;
}

export function isFocusOpen() {
  return focusOpen;
}

export function getFocusSeconds() {
  return _focusSeconds;
}

/* ============================================================
   COMMAND PALETTE
   ------------------------------------------------------------
   Usage:
     openCommand({
       commands: [
         { icon: icons.grid, label: "Go to Grid", hint: "G", action: () => { ... } },
         ...
       ]
     });
   Enter runs the first visible command. Esc closes.
   ============================================================ */
let commandOpen = false;

export function openCommand({ commands = [], placeholder = "Type a command…" } = {}) {
  const root = document.getElementById("cmdRoot");
  if (!root) return;

  const items = commands
    .map(
      (c, i) => `
    <button class="cmd-item" data-cmd-i="${i}">
      <span class="cmd-icon">${c.icon || ""}</span>
      <span class="cmd-label">${esc(c.label)}</span>
      ${c.hint ? `<span class="cmd-hint">${esc(c.hint)}</span>` : ""}
    </button>
  `
    )
    .join("");

  root.innerHTML = `
    <button class="cmd-backdrop" data-cmd-close aria-label="Close"></button>
    <div class="cmd-panel" role="dialog" aria-modal="true" aria-label="Command palette">
      <input
        id="cmdInput"
        class="cmd-input"
        type="text"
        placeholder="${esc(placeholder)}"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
      />
      <div class="cmd-results" id="cmdResults">${items}</div>
    </div>
  `;
  root.hidden = false;
  commandOpen = true;

  /** @type {HTMLInputElement | null} */
  const input = /** @type {any} */ (root.querySelector("#cmdInput"));

  const filter = (q) => {
    const needle = q.trim().toLowerCase();
    root.querySelectorAll(".cmd-item").forEach((el) => {
      const label = el.querySelector(".cmd-label")?.textContent.toLowerCase() || "";
      const hint = el.querySelector(".cmd-hint")?.textContent.toLowerCase() || "";
      const match = !needle || label.includes(needle) || hint.includes(needle);
      /** @type {HTMLElement} */ (el).hidden = !match;
    });
  };

  input?.addEventListener("input", () => filter(input.value));
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = root.querySelector(".cmd-item:not([hidden])");
      if (first) {
        const i = +/** @type {HTMLElement} */ (first).dataset.cmdI;
        closeCommand();
        commands[i]?.action?.();
      }
    }
  });

  root
    .querySelector("[data-cmd-close]")
    ?.addEventListener("click", () => closeCommand());

  root.querySelectorAll(".cmd-item").forEach((el) => {
    el.addEventListener("click", () => {
      const i = +/** @type {HTMLElement} */ (el).dataset.cmdI;
      closeCommand();
      commands[i]?.action?.();
    });
  });

  setTimeout(() => input?.focus(), 60);
}

export function closeCommand() {
  const root = document.getElementById("cmdRoot");
  if (!root) return;
  root.hidden = true;
  root.innerHTML = "";
  commandOpen = false;
}

export function isCommandOpen() {
  return commandOpen;
}

/* ============================================================
   MODAL FOOTER HELPER
   ============================================================ */
export function modalFoot(primaryLabel, primaryAction, opts = {}) {
  return `<div class="drawer-foot">
    <button class="btn" data-action="close-modal">${opts.cancelLabel || "Cancel"}</button>
    <button class="btn primary" data-action="${primaryAction}">${primaryLabel}</button>
  </div>`;
}

/* ============================================================
   GLOBAL KEYBOARD — Esc closes topmost overlay
   ------------------------------------------------------------
   Order of precedence: command > focus > milestone > modal.
   app.js keeps its own Esc handler for modals; this one only
   fires for the new overlays.
   ============================================================ */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (commandOpen) {
    closeCommand();
    return;
  }
  if (focusOpen) {
    closeFocus();
    return;
  }
  if (milestoneOpen) {
    closeMilestone();
    return;
  }
  // Do NOT close the modal here — app.js handles it.
});

export { toast };