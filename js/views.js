// js/views.js — pure render functions
import { esc, clamp, todayISO, iso, fmtDate, greeting } from "./utils.js";
import { icons } from "./icons.js";
import {
  effectiveProgress, pillarProgress, stageProgress, readiness,
  streak, todaysBudget, nextUpTasks, appTotals, dsaStats,
  workoutStats, weightStats, DEFAULT_TEMPLATES, DSA_TOPICS,
  PILLAR_COLORS, progressBand, pillarFn, pillarColorVar,
  streakWithGrace, effortScore, effortSparkline, weeklyDelta,
  lastWeekStats, shouldShowRecap, personalRecords,
  milestoneStatus, MILESTONE_DEFS, nextSubtaskFor
} from "./state.js";
import { isAuthAvailable, getCachedUser } from "./auth.js";
import { getSyncStatus } from "./sync.js";

const LOCAL_ORDER = [[0,0],[0,1],[0,2],[1,0],[1,2],[2,0],[2,1],[2,2]];
const BLOCK_ORDER = [[0,0],[0,1],[0,2],[1,0],[1,2],[2,0],[2,1],[2,2]];

/* ============================================================
   HELPERS
   ============================================================ */
function band(p) {
  if (p >= 100) return "var(--success)";
  if (p >= 81)  return "var(--info)";
  if (p >= 51)  return "var(--accent)";
  if (p >= 21)  return "var(--attention)";
  return "var(--text-3)";
}
function priLetter(p) {
  return p === "High" ? "H" : p === "Medium" ? "M" : "L";
}
function pillColor(pillar) {
  return pillarColorVar(pillar);
}

function dueLabel(days) {
  if (days == null) return "";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days}d left`;
}

function computeTaskMeta(t, s) {
  const g = s.goals[t.goal.id];
  const totalSubs = g.subtasks.length;
  const doneSubs = g.subtasks.filter((x) => x.done).length;
  const subPct = totalSubs ? Math.round((doneSubs / totalSubs) * 100) : 0;
  const due = dueLabel(t.days);
  const meta = [t.pillar.title, totalSubs ? `${doneSubs}/${totalSubs} subtasks` : null, due]
    .filter(Boolean)
    .join(" · ");
  return { totalSubs, doneSubs, subPct, due, meta };
}

/* ============================================================
   EMPTY STATE
   ============================================================ */
export function renderEmptyState(iconName, title, subtitle, actionHtml = "") {
  const iconSvg = icons[iconName] || icons.target;
  return `
    <div class="empty-state">
      <div class="empty-icon">${iconSvg}</div>
      <h3>${esc(title)}</h3>
      <p>${esc(subtitle)}</p>
      ${actionHtml}
    </div>
  `;
}

/* ============================================================
   RING (circular progress)
   ============================================================ */
function renderRing(pct, opts = {}) {
  const size = opts.size || 200;
  const stroke = opts.stroke || 10;
  const r = size / 2 - stroke - 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, +pct || 0));
  const offset = c * (1 - p / 100);
  const trackColor = opts.track || "var(--surface-3)";
  const fillColor = opts.fill || "var(--accent)";
  return `
    <div class="ring" style="--ring-size:${size}px">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
          stroke="${trackColor}" stroke-width="${stroke}" />
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
          stroke="${fillColor}" stroke-width="${stroke}"
          stroke-linecap="round"
          stroke-dasharray="${c.toFixed(2)}"
          stroke-dashoffset="${offset.toFixed(2)}"
          transform="rotate(-90 ${size / 2} ${size / 2})" />
      </svg>
      <div class="ring-content">
        ${opts.label ? `<div class="ring-label">${esc(opts.label)}</div>` : ""}
        ${opts.sub ? `<div class="ring-sub">${esc(opts.sub)}</div>` : ""}
      </div>
    </div>
  `;
}

/* ============================================================
   MINI GRID + BUDGET + TASK CARD (shared across layouts)
   ============================================================ */
function renderMiniGrid(s) {
  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (r === 1 && c === 1) {
        cells.push(`<div class="mg-cell center">${readiness()}%</div>`);
      } else {
        const bi = BLOCK_ORDER.findIndex(([a, b]) => a === r && b === c);
        const p = s.pillars[bi];
        const prog = pillarProgress(p);
        cells.push(
          `<div class="mg-cell" data-action="jump-pillar" data-id="${p.id}" title="${esc(p.title)}">
            <div class="fill" style="height:${prog}%; background:${pillColor(p)}"></div>
          </div>`
        );
      }
    }
  }
  return `<section class="mini-grid">${cells.join("")}</section>`;
}

function renderBudgetCard(s) {
  const { logged, target } = todaysBudget();
  const pct = target ? clamp(Math.round((logged / target) * 100), 0, 100) : 0;
  return `
    <section class="budget">
      <div class="spread" style="margin-bottom:4px">
        <h3 class="label" style="margin:0">Today's budget</h3>
        <div style="display:flex; gap:8px; align-items:center">
          <span class="muted" style="font-size:12px; font-family:var(--font-mono)">${logged}h / ${target}h</span>
          <button class="btn sm ghost" data-action="reset-daily-budget" title="Reset today's logged time">Reset</button>
        </div>
      </div>
      <div class="bar">
        <i style="width:${pct}%" class="${pct >= 100 ? "done" : ""}"></i>
      </div>
      <div class="quick">
        <button data-action="log-time-minus" data-id="0.5">−0.5h</button>
        <button data-action="log-time" data-id="0.5">+0.5h</button>
        <button data-action="log-time" data-id="1">+1h</button>
        <button data-action="log-time-edit">Set…</button>
      </div>
    </section>
  `;
}

function renderTaskCard(t, s, opts = {}) {
  const g = s.goals[t.goal.id];
  const { totalSubs, doneSubs, subPct, meta } = computeTaskMeta(t, s);
  const overdue = t.days != null && t.days < 0;
  const nextSub = (g.subtasks || []).find((x) => !x.done);
  const compact = opts.compact === true;

  return `
    <div class="task ${overdue ? "overdue" : ""} ${t.boosted ? "boosted" : ""} ${compact ? "compact" : ""}">
      <button class="ck" data-action="quick-check" data-id="${t.goal.id}"
        aria-label="Complete next subtask">✓</button>
      <div class="info" data-action="open-goal" data-id="${t.goal.id}" style="cursor:pointer">
        <div class="t">${esc(t.goal.t)}</div>
        ${t.boosted ? `<div class="streak-badge">${icons.flame}<span>Keep streak alive</span></div>` : ""}
        <div class="s">${esc(meta)}</div>
        ${totalSubs ? `<div class="mini-bar"><i style="width:${subPct}%"></i></div>` : ""}
      </div>
      ${opts.showFocus && nextSub ? `
        <button class="task-focus" data-action="focus-start" data-id="${t.goal.id}"
          aria-label="Focus on this goal" title="Focus mode">${icons.focus}</button>
      ` : ""}
    </div>
  `;
}

/* ============================================================
   PR TICKER — nearest beaten record hint
   ============================================================ */
function renderPRTicker(s) {
  const recs = personalRecords();
  const todayActions = s.activity[todayISO()] || 0;
  const stored = Object.fromEntries(recs.map((r) => [r.key, r]));

  // Most actions in a day
  const bestDay = +stored.mostActionsDay?.value || 0;
  if (bestDay > 0 && todayActions > 0 && todayActions < bestDay) {
    const gap = bestDay - todayActions;
    if (gap <= 5) {
      return `<div class="pr-ticker" data-action="open-records">
        ${icons.zap}
        <span><b>${gap}</b> action${gap === 1 ? "" : "s"} from a daily PR</span>
      </div>`;
    }
  }

  // Longest streak
  const longest = +stored.longestStreak?.value || 0;
  const current = streakWithGrace();
  if (longest > 0 && current > 0 && current < longest) {
    const gap = longest - current;
    if (gap <= 3) {
      return `<div class="pr-ticker" data-action="open-records">
        ${icons.flame}
        <span><b>${gap}</b> day${gap === 1 ? "" : "s"} from your longest streak</span>
      </div>`;
    }
  }

  return "";
}

/* ============================================================
   RECAP CARD — Sunday only
   ============================================================ */
function renderRecapCard(s) {
  if (!shouldShowRecap()) return "";
  const stats = lastWeekStats();
  const delta = stats.deltaReadiness;
  const deltaSign = delta > 0 ? "+" : "";
  const deltaClass = delta > 0 ? "up" : delta < 0 ? "down" : "";
  const topPillar = stats.topPillar;
  const topName = topPillar ? topPillar.title : "—";
  const topFn = topPillar ? pillarFn(topPillar) : "reflection";

  return `
    <section class="recap-card">
      <div class="recap-head">
        <span class="label">Weekly recap</span>
        <button class="x-btn sm" data-action="dismiss-recap" aria-label="Dismiss">×</button>
      </div>
      <div class="recap-hero">
        <div class="recap-delta ${deltaClass}">
          <span class="recap-num">${deltaSign}${delta}%</span>
          <span class="recap-sub">readiness this week</span>
        </div>
      </div>
      <div class="recap-stats">
        <div class="recap-stat">
          <div class="v">${stats.actions}</div>
          <div class="k">actions</div>
        </div>
        <div class="recap-stat">
          <div class="v">${stats.hours.toFixed(1)}h</div>
          <div class="k">logged</div>
        </div>
        <div class="recap-stat">
          <div class="v pillar-fn-${topFn}" style="color:var(--pillar-ink, var(--accent))">${stats.topPillarProgress}%</div>
          <div class="k">${esc(topName.slice(0, 14))}</div>
        </div>
      </div>
      <div class="recap-actions">
        <button class="btn sm primary" data-action="view-recap">Open recap</button>
      </div>
    </section>
  `;
}

/* ============================================================
   STREAK STRIP (7-day mini row for Calm layout)
   ============================================================ */
function renderStreakStrip(s) {
  const cells = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = iso(d);
    const v = s.activity[k] || 0;
    const lvl = v === 0 ? "" : v <= 2 ? "l1" : v <= 5 ? "l2" : v <= 9 ? "l3" : "l4";
    const today = i === 0 ? "today" : "";
    cells.push(`<div class="streak-strip-cell ${lvl} ${today}" title="${k}: ${v} actions"></div>`);
  }
  const st = streakWithGrace();
  return `
    <section class="streak-strip-wrap">
      <div class="streak-strip">
        ${cells.join("")}
      </div>
      <div class="streak-strip-meta">
        <span class="streak-strip-flame">${icons.flame}</span>
        <span class="streak-strip-num">${st}</span>
        <span class="streak-strip-lbl">day streak</span>
      </div>
    </section>
  `;
}

/* ============================================================
   TODAY — dispatches to layout
   ============================================================ */
export function renderToday(s) {
  const layout = (s.settings && s.settings.todayLayout) || "momentum";
  if (layout === "precision") return renderTodayPrecision(s);
  if (layout === "calm") return renderTodayCalm(s);
  return renderTodayMomentum(s);
}

/* -------- Momentum -------- */
function renderTodayMomentum(s) {
  const st = streakWithGrace();
  const tasks = nextUpTasks(3);
  const ready = readiness();
  const pct = ready;
  const top = tasks[0];
  const nextSub = top ? nextSubtaskFor(top.goal.id) : null;
  const ctaText = top
    ? (nextSub ? nextSub.title : top.goal.t)
    : "You're all caught up.";

  const readinessRing = renderRing(pct, {
    size: 200,
    stroke: 12,
    label: `${ready}%`,
    sub: "readiness",
    fill: band(ready)
  });

  return `
    <div class="greet">
      <div>
        <h2>${greeting(s.user.name)}</h2>
        <p>${tasks.length ? `${tasks.length} thing${tasks.length === 1 ? "" : "s"} to move forward today` : "You're all caught up."}</p>
      </div>
      <div class="streak">${icons.flame}<span>${st}</span></div>
    </div>

    <section class="hero-momentum">
      ${readinessRing}
      <div class="hero-cta">
        <span class="label">Start with</span>
        <button class="hero-cta-btn ${top ? "" : "disabled"}"
          ${top ? `data-action="quick-check" data-id="${top.goal.id}"` : ""}>
          <span class="hero-cta-text">${esc(ctaText)}</span>
          ${top ? `<span class="hero-cta-icon">${icons.arrowRight}</span>` : ""}
        </button>
      </div>
    </section>

    ${renderRecapCard(s)}

    <section class="nextup">
      <h3>Next up</h3>
      ${tasks.length
        ? tasks.map((t) => renderTaskCard(t, s, { showFocus: true })).join("")
        : `<div class="empty" style="padding:14px">Nothing open. Add a goal in Grid.</div>`}
      ${tasks.length ? `<button class="add-tl" style="margin-top:8px" data-action="goto-tab" data-id="grid">See all open goals →</button>` : ""}
    </section>

    ${renderBudgetCard(s)}
    ${renderMiniGrid(s)}
  `;
}

/* -------- Precision -------- */
function renderTodayPrecision(s) {
  const tasks = nextUpTasks(6);
  const overdue = tasks.filter((t) => t.days != null && t.days < 0).length;
  const top = tasks[0];
  const rest = tasks.slice(1, 4);
  const st = streakWithGrace();
  const ticker = renderPRTicker(s);

  const summary = tasks.length
    ? `${tasks.length} thing${tasks.length === 1 ? "" : "s"} today.${overdue ? ` ${overdue} overdue.` : ""}`
    : "All clear today.";

  return `
    <section class="hero-precision">
      <div class="precision-summary">
        <span class="precision-line">${esc(summary)}</span>
        ${top ? `<button class="precision-start" data-action="quick-check" data-id="${top.goal.id}">
          Start here ${icons.arrowRight}
        </button>` : ""}
      </div>
      ${top ? `<div class="precision-top">
        <div class="precision-top-title">${esc(top.goal.t)}</div>
        <div class="precision-top-meta">${esc(top.pillar.title)}${top.days != null ? ` · ${esc(dueLabel(top.days))}` : ""}</div>
      </div>` : ""}
    </section>

    <section class="precision-meta">
      <div class="meta-pill meta-pill-streak">${icons.flame}<span>${st}</span></div>
      <div class="meta-pill">${icons.target}<span>${readiness()}%</span></div>
      ${ticker ? `<div class="meta-pill pr-pill">${ticker}</div>` : ""}
    </section>

    ${rest.length ? `
      <section class="nextup">
        <h3>Also today</h3>
        ${rest.map((t) => renderTaskCard(t, s, { compact: true, showFocus: true })).join("")}
      </section>
    ` : ""}

    ${renderBudgetCard(s)}
    ${renderMiniGrid(s)}
  `;
}

/* -------- Calm -------- */
function renderTodayCalm(s) {
  const tasks = nextUpTasks(1);
  const top = tasks[0];
  const rest = nextUpTasks(6).slice(1);

  return `
    <section class="hero-calm">
      <h2 class="calm-greet">${greeting(s.user.name)}</h2>
      <p class="calm-sub">${top ? "One thing for now." : "Nothing urgent today."}</p>
      ${top ? `
        <div class="calm-card" data-action="open-goal" data-id="${top.goal.id}" style="cursor:pointer">
          <div class="calm-card-title">${esc(top.goal.t)}</div>
          <div class="calm-card-meta">${esc(top.pillar.title)}${top.days != null ? ` · ${esc(dueLabel(top.days))}` : ""}</div>
          <div class="calm-actions">
            <button class="btn primary calm-cta" data-action="quick-check" data-id="${top.goal.id}">
              Complete next step
            </button>
            <button class="btn ghost calm-focus" data-action="focus-start" data-id="${top.goal.id}"
              aria-label="Focus on this goal" title="Focus mode">
              ${icons.focus}
            </button>
          </div>
        </div>
      ` : ""}
    </section>

    ${renderStreakStrip(s)}

    ${rest.length ? `
      <section class="nextup">
        <h3>Then</h3>
        ${rest.map((t) => renderTaskCard(t, s, { compact: true, showFocus: true })).join("")}
      </section>
    ` : ""}

    ${renderBudgetCard(s)}
    ${renderMiniGrid(s)}
  `;
}

/* ============================================================
   GRID
   ============================================================ */
export function renderGrid(s, mode) {
  const toggleHtml = `
    <div class="seg" id="gridMode">
      <button class="${mode === "map" ? "on" : ""}" data-action="grid-mode" data-id="map">Map</button>
      <button class="${mode === "full" ? "on" : ""}" data-action="grid-mode" data-id="full">Full 9×9</button>
    </div>`;

  if (mode === "full") {
    return `
      <div class="grid-head"><h2>Your Grid</h2>${toggleHtml}</div>
      <div class="card" style="padding:8px; overflow:auto; -webkit-overflow-scrolling:touch">
        ${renderFullGrid(s)}
      </div>
      <p class="tiny muted" style="text-align:center; margin-top:10px">Scroll to pan · tap any goal to open</p>
    `;
  }

  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (r === 1 && c === 1) {
        cells.push(`<button class="block center" data-action="open-stages">
          <div class="bname">${esc(s.meta.mainGoal.slice(0, 40))}</div>
          <div class="bpct">${readiness()}%</div>
        </button>`);
      } else {
        const bi = BLOCK_ORDER.findIndex(([a, b]) => a === r && b === c);
        const p = s.pillars[bi];
        const prog = pillarProgress(p);
        cells.push(`<button class="block pillar-fn-${pillarFn(p)}"
          style="--pc:${pillColor(p)}"
          data-action="open-pillar" data-id="${p.id}">
          <div class="bfill" style="height:${prog}%;"></div>
          <div class="bname">${esc(p.title)}</div>
          <div class="bpct">${prog}%</div>
        </button>`);
      }
    }
  }

  return `
    <div class="grid-head"><h2>Your Grid</h2>${toggleHtml}</div>
    <div class="blockmap">${cells.join("")}</div>
    <p class="tiny muted" style="text-align:center; margin-top:14px">Tap the center for stages · tap a pillar to see its goals</p>
  `;
}

export function renderFullGrid(s) {
  const cells = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const br = Math.floor(r / 3), bc = Math.floor(c / 3);
      const lr = r % 3, lc = c % 3;
      if (br === 1 && bc === 1) {
        if (lr === 1 && lc === 1) {
          cells.push(`<button class="goal center" data-action="open-stages">
            <div class="gtitle">${esc(s.meta.mainGoal.slice(0, 30))}</div>
            <div class="gfoot">${readiness()}%</div>
          </button>`);
        } else {
          const i = LOCAL_ORDER.findIndex(([a, b]) => a === lr && b === lc);
          const st = s.stages[i];
          if (!st) { cells.push(`<div class="goal" style="opacity:.3"></div>`); continue; }
          const avg = stageProgress(st);
          cells.push(`<button class="goal center" data-action="open-stage" data-id="${i}">
            <div class="gtitle">${esc(st.name)}</div>
            <div class="gfoot">${avg}%</div>
          </button>`);
        }
      } else {
        const bi = BLOCK_ORDER.findIndex(([a, b]) => a === br && b === bc);
        const p = s.pillars[bi];
        const li = LOCAL_ORDER.findIndex(([a, b]) => a === lr && b === lc);
        if (lr === 1 && lc === 1) {
          const prog = pillarProgress(p);
          cells.push(`<button class="goal center pillar-fn-${pillarFn(p)}"
            style="--pc:${pillColor(p)}"
            data-action="open-pillar" data-id="${p.id}">
            <div class="gtitle">${esc(p.title)}</div>
            <div class="gfoot">${prog}%</div>
          </button>`);
        } else {
          const g = (p.goals || [])[li];
          if (!g) { cells.push(`<div class="goal" style="opacity:.3"></div>`); continue; }
          const st = s.goals[g.id] || {};
          const prog = effectiveProgress(g.id);
          const done = prog >= 100 || st.status === "Completed";
          cells.push(`<button class="goal ${done ? "complete" : ""} pillar-fn-${pillarFn(p)}"
            style="--pc:${pillColor(p)}"
            data-action="open-goal" data-id="${g.id}">
            <div class="gfill" style="height:${prog}%"></div>
            <div class="gbar" style="width:${prog}%"></div>
            <div class="gtitle">${esc(g.t)}</div>
            <div class="gfoot"><span>${prog}%</span>${done ? '<span class="gtick">✓</span>' : ""}</div>
          </button>`);
        }
      }
    }
  }
  return `<div style="display:grid; grid-template-columns:repeat(9,minmax(40px,1fr)); gap:3px; min-width:640px">${cells.join("")}</div>`;
}

/* ============================================================
   PLAN
   ============================================================ */
export function renderPlan(s) {
  return `
    <div class="plan-head">
      <h2>Roadmap</h2>
      <button class="btn sm" data-action="add-month">+ Month</button>
    </div>
    <div class="tl">
      ${s.roadmap.map((r, ri) => {
        const tl = s.timeline[r.m] || { items: [] };
        const doneCount = tl.items.filter(Boolean).length;
        const isDone = tl.items.length && doneCount === tl.items.length;
        const isCurrent = !isDone && s.roadmap.findIndex((x) => {
          const t = s.timeline[x.m] || { items: [] };
          return !(t.items.length && t.items.every(Boolean));
        }) === ri;
        return `<div class="tl-month ${isDone ? "done" : ""} ${isCurrent ? "current" : ""}">
          <div class="tl-head">
            <div class="tl-title" contenteditable="true"
              data-action="inline-edit" data-scope="rm-month" data-id="${esc(r.m)}">${esc(r.m)}</div>
            <div class="tl-count">${doneCount}/${tl.items.length}${isDone ? " ✓" : ""}</div>
          </div>
          <div class="tl-focus" contenteditable="true"
            data-action="inline-edit" data-scope="rm-focus" data-id="${esc(r.m)}">${esc(r.focus || "")}</div>
          <div class="tl-items">
            ${r.items.map((it, i) => `
              <div class="tl-item ${tl.items[i] ? "on" : ""}">
                <input type="checkbox" ${tl.items[i] ? "checked" : ""} data-tl="${esc(r.m)}" data-i="${i}" />
                <span class="edit" contenteditable="true"
                  data-action="inline-edit" data-scope="rm-item"
                  data-id="${esc(r.m)}" data-i="${i}">${esc(it)}</span>
                <button class="rm" data-action="rm-tl-item" data-month="${esc(r.m)}" data-i="${i}" aria-label="Delete">×</button>
              </div>
            `).join("")}
            <button class="add-tl" data-action="add-tl-item" data-month="${esc(r.m)}">+ Add item</button>
          </div>
        </div>`;
      }).join("")}
    </div>
  `;
}

/* ============================================================
   TRACK — still exported for sub-view access
   ============================================================ */
export function renderTrack(s) {
  const w = s.weekly;
  const cats = Object.keys(w.targets);
  const totalLogged = cats.reduce((a, c) => a + (+w.logged[c] || 0), 0);
  const totalTarget = cats.reduce((a, c) => a + (+w.targets[c] || 0), 0);
  const pct = totalTarget ? Math.round((totalLogged / totalTarget) * 100) : 0;

  const catRows = cats.map((c) => {
    const tgt = +w.targets[c] || 0;
    const got = +w.logged[c] || 0;
    const p = tgt ? clamp(Math.round((got / tgt) * 100), 0, 100) : 0;
    const over = got >= tgt && tgt > 0;
    return `<div class="wk-cat">
      <div class="wk-cat-head">
        <div class="wk-cat-name">${esc(c)}</div>
        <div class="wk-cat-num ${over ? "over" : ""}">
          <input type="number" class="wk-inline" value="${got}" step="0.5" min="0"
            data-wk-log="${esc(c)}" aria-label="Hours logged" /> /
          <input type="number" class="wk-inline" value="${tgt}" step="0.5" min="0"
            data-wk-target="${esc(c)}" aria-label="Weekly target" />h
        </div>
        <button class="x-btn" data-action="wk-remove" data-id="${esc(c)}" aria-label="Remove">×</button>
      </div>
      <div class="wk-bar"><i class="${over ? "over" : ""}" style="width:${p}%"></i></div>
      <div class="wk-quick">
        <button data-action="wk-log-minus" data-id="${esc(c)}" data-v="0.5">−30m</button>
        <button data-action="wk-log" data-id="${esc(c)}" data-v="0.5">+30m</button>
        <button data-action="wk-log" data-id="${esc(c)}" data-v="1">+1h</button>
      </div>
    </div>`;
  }).join("");

  return `
    <div class="track-hero">
      <div class="big">${totalLogged}h</div>
      <div class="sub">of ${totalTarget}h planned this week</div>
      <div class="chips">
        <span class="chip">${icons.flame} <b>${streakWithGrace()}</b> day streak</span>
        <span class="chip"><b>${pct}%</b> of plan</span>
      </div>
    </div>

    <div class="spread" style="margin-bottom:10px">
      <h3 class="label" style="margin:0">Categories</h3>
      <button class="btn sm" data-action="add-wk-cat">+ Category</button>
    </div>

    ${catRows || `<div class="empty">No categories yet.</div>`}

    <section class="card" style="margin-top:16px">
      <h3>Activity — last 12 weeks</h3>
      ${renderHeatmap(s)}
    </section>
  `;
}

function renderHeatmap(s) {
  const cells = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7));
  for (let i = 11; i >= 0; i--) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(base);
      day.setDate(base.getDate() - i * 7 + d);
      const k = iso(day);
      const v = s.activity[k] || 0;
      const lvl = v === 0 ? "" : v <= 2 ? "l1" : v <= 5 ? "l2" : v <= 9 ? "l3" : "l4";
      const today = k === todayISO() ? "today" : "";
      cells.push(`<div class="heat-cell ${lvl} ${today}" title="${k}: ${v} actions"></div>`);
    }
  }
  return `<div class="heat">${cells.join("")}</div>`;
}

/* ============================================================
   AUTH SECTION (used by You tab)
   ============================================================ */
function renderAuthSection() {
  if (!isAuthAvailable()) return "";
  const user = getCachedUser();

  if (user) {
    let statusText = "Connected";
    let statusColor = "var(--success-ink, var(--success))";
    try {
      const status = getSyncStatus();
      if (status === "syncing") { statusText = "Syncing…"; statusColor = "var(--attention-ink, var(--attention))"; }
      else if (status === "synced") { statusText = "Synced"; statusColor = "var(--success-ink, var(--success))"; }
      else if (status === "error") { statusText = "Sync error"; statusColor = "var(--danger-ink, var(--danger))"; }
    } catch (e) { /* sync module not loaded */ }

    return `
      <div class="more-group-label">Account</div>
      <div class="more-list" style="margin-bottom:16px">
        <div class="more-item" style="cursor:default">
          <span class="lbl">
            <span style="display:flex;flex-direction:column;gap:2px;min-width:0">
              <span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(user.email || "Signed in")}</span>
              <span class="tiny" style="color:${statusColor}">${statusText}</span>
            </span>
          </span>
        </div>
        <button class="more-item" data-action="sync-now"><span class="lbl">Sync now</span></button>
        <button class="more-item danger" data-action="sign-out"><span class="lbl">Sign out</span></button>
      </div>
    `;
  }

  return `
    <div class="more-group-label">Account</div>
    <div class="more-list" style="margin-bottom:16px">
      <button class="more-item" data-action="sign-in">
        <span class="lbl">Sign in with Google</span>
        <span class="cnt">Sync across devices ${icons.chevronRight}</span>
      </button>
    </div>
  `;
}

/* ============================================================
   RECORDS / TROPHY CASE
   ============================================================ */
function renderRecordsSection(s) {
  const earnedMap = (s.milestones && s.milestones.earned) || {};
  const earned = MILESTONE_DEFS.filter((m) => earnedMap[m.id]);
  const total = MILESTONE_DEFS.length;
  const recs = personalRecords();
  const stored = Object.fromEntries(recs.map((r) => [r.key, r]));

  const recTiles = [];
  const fastestSolve = stored.fastestSolve;
  if (fastestSolve) {
    recTiles.push(`
      <div class="record-tile">
        <div class="record-icon">${icons.zap}</div>
        <div class="record-value">${fastestSolve.value}<span class="record-unit">${esc(fastestSolve.unit || "")}</span></div>
        <div class="record-label">Fastest solve</div>
      </div>
    `);
  }
  const longestStreak = stored.longestStreak;
  if (longestStreak && longestStreak.value) {
    recTiles.push(`
      <div class="record-tile">
        <div class="record-icon">${icons.flame}</div>
        <div class="record-value">${longestStreak.value}<span class="record-unit">days</span></div>
        <div class="record-label">Longest streak</div>
      </div>
    `);
  }
  const bestDay = stored.mostActionsDay;
  if (bestDay && bestDay.value) {
    recTiles.push(`
      <div class="record-tile">
        <div class="record-icon">${icons.trendingUp}</div>
        <div class="record-value">${bestDay.value}<span class="record-unit">acts</span></div>
        <div class="record-label">Best day</div>
      </div>
    `);
  }
  const bestWeek = stored.bestWeek;
  if (bestWeek && bestWeek.value) {
    recTiles.push(`
      <div class="record-tile">
        <div class="record-icon">${icons.trophy}</div>
        <div class="record-value">+${bestWeek.value}<span class="record-unit">%</span></div>
        <div class="record-label">Best week</div>
      </div>
    `);
  }

  const recentMilestones = earned
    .slice(-3)
    .reverse()
    .map((m) => `
      <div class="milestone-row">
        <div class="milestone-row-icon">${icons.medal}</div>
        <div class="milestone-row-copy">
          <div class="milestone-row-title">${esc(m.title)}</div>
          <div class="milestone-row-sub">${esc(m.subtitle || "")}</div>
        </div>
      </div>
    `)
    .join("");

  return `
    <div class="more-group-label">Progress</div>
    <div class="records-wrap">
      <div class="records-head">
        <div class="records-count">
          <span class="records-count-num">${earned.length}</span>
          <span class="records-count-lbl">of ${total} milestones</span>
        </div>
        <button class="btn sm ghost" data-action="open-records">See all</button>
      </div>

      ${recTiles.length ? `
        <div class="records-grid">${recTiles.join("")}</div>
      ` : `<p class="tiny muted" style="margin:8px 0 0">Complete subtasks to unlock your first records.</p>`}

      ${recentMilestones ? `
        <div class="milestone-list">${recentMilestones}</div>
      ` : ""}
    </div>
  `;
}

/* ============================================================
   YOU (was More)
   ============================================================ */
export function renderMore(s) {
  const goalType = s.user?.goalType || "career";
  const totals = appTotals();
  const dsa = dsaStats();
  const wt = workoutStats();
  const w = weightStats();
  const layout = (s.settings && s.settings.todayLayout) || "momentum";
  const a11y = (s.settings && s.settings.a11y) || "default";

  const layoutLabels = { momentum: "Momentum", precision: "Precision", calm: "Calm" };
  const a11yLabels = { default: "Default", contrast: "High contrast", "low-stim": "Low stimulation" };

  return `
    <h2 class="page-title">You</h2>

    ${renderAuthSection()}
    ${renderRecordsSection(s)}

    <div class="more-group-label">Your tools</div>
    <div class="more-list" style="margin-bottom:16px">
      <button class="more-item" data-action="open-projects">
        <span class="lbl">${icons.folder}Projects</span>
        <span class="cnt">${s.projects.length}${icons.chevronRight}</span>
      </button>
      <button class="more-item" data-action="open-apps">
        <span class="lbl">${icons.send}Applications</span>
        <span class="cnt">${totals.total}${icons.chevronRight}</span>
      </button>
      ${goalType === "career" || goalType === "other" ? `
        <button class="more-item" data-action="open-dsa">
          <span class="lbl">${icons.code}DSA Tracker</span>
          <span class="cnt">${dsa.solved}/${dsa.total}${icons.chevronRight}</span>
        </button>
      ` : ""}
      ${goalType === "fitness" || goalType === "other" ? `
        <button class="more-item" data-action="open-workouts">
          <span class="lbl">${icons.dumbbell}Workout log</span>
          <span class="cnt">${wt.thisWeek}/${wt.target} wk${icons.chevronRight}</span>
        </button>
        <button class="more-item" data-action="open-weight">
          <span class="lbl">${icons.scale}Weight tracker</span>
          <span class="cnt">${w.current ? w.current + " " + s.weight.unit : "—"}${icons.chevronRight}</span>
        </button>
      ` : ""}
    </div>

    <div class="more-group-label">Setup</div>
    <div class="more-list" style="margin-bottom:16px">
      <button class="more-item" data-action="open-ai">
        <span class="lbl">${icons.wand}AI Prompt helper</span>
        <span class="cnt">${icons.chevronRight}</span>
      </button>
      <button class="more-item" data-action="open-theme">
        <span class="lbl">${icons.palette}Theme</span>
        <span class="cnt">${esc(s.settings.theme)}${icons.chevronRight}</span>
      </button>
      <button class="more-item" data-action="open-layout">
        <span class="lbl">${icons.sliders}Today layout</span>
        <span class="cnt">${esc(layoutLabels[layout] || layout)}${icons.chevronRight}</span>
      </button>
      <button class="more-item" data-action="open-a11y">
        <span class="lbl">${icons.eye}Accessibility</span>
        <span class="cnt">${esc(a11yLabels[a11y] || a11y)}${icons.chevronRight}</span>
      </button>
      <button class="more-item" data-action="open-customize">
        <span class="lbl">${icons.edit}Customize grid</span>
        <span class="cnt">${icons.chevronRight}</span>
      </button>
    </div>

    <div class="more-group-label">Data</div>
    <div class="more-list" style="margin-bottom:16px">
      <button class="more-item" data-action="export"><span class="lbl">${icons.download}Export JSON</span></button>
      <button class="more-item" data-action="import"><span class="lbl">${icons.upload}Import JSON</span></button>
    </div>

    <div class="more-group-label" style="color:var(--danger-ink, var(--danger))">Danger zone</div>
    <div class="more-list">
      <button class="more-item danger" data-action="reset">
        <span class="lbl">${icons.alert}Reset all data</span>
      </button>
    </div>
  `;
}

/* ============================================================
   DSA
   ============================================================ */
export function renderDsa(s) {
  const stats = dsaStats();
  const targets = Object.values(s.dsa.targets).reduce((a, b) => a + b, 0);

  const topicRows = DSA_TOPICS.map((topic) => {
    const target = s.dsa.targets[topic] || 0;
    const solved = s.dsa.problems.filter((p) => p.topic === topic && p.status === "Solved").length;
    const pct = target ? clamp(Math.round((solved / target) * 100), 0, 100) : 0;
    const done = target > 0 && solved >= target;
    return `<div class="dsa-topic">
      <div class="dsa-topic-head">
        <div class="dsa-topic-name">${esc(topic)}</div>
        <div class="dsa-topic-count ${done ? "done" : ""}">${solved} / ${target}</div>
      </div>
      <div class="dsa-bar"><i class="${done ? "done" : ""}" style="width:${pct}%"></i></div>
    </div>`;
  }).join("");

  const recent = [...s.dsa.problems].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  const recentRows = recent.length
    ? recent.map((p) => `
      <div class="dsa-problem">
        <div style="min-width:0; flex:1">
          <div class="name">${esc(p.name)}</div>
          <div class="meta">
            <span>${esc(p.topic)}</span>
            <span class="diff-pill diff-${p.difficulty}">${p.difficulty}</span>
            <span>${p.timeMin || 0}m</span>
            <span>${fmtDate(p.date)}</span>
          </div>
        </div>
        <button class="rm" data-action="dsa-rm" data-id="${p.id}" aria-label="Delete">×</button>
      </div>
    `).join("")
    : renderEmptyState(
        "code",
        "No problems logged",
        "Log your first practice problem to start tracking progress and streaks.",
        `<button class="btn primary" data-action="dsa-log">Log Problem</button>`
      );

  return `
    <div class="grid-head">
      <h2>DSA Tracker</h2>
      <button class="btn sm" data-action="goto-tab" data-id="more">← Back</button>
    </div>

    <div class="dsa-stats">
      <div class="dsa-stat"><div class="v">${stats.solved}<span style="font-size:14px;color:var(--text-3)">/${targets}</span></div><div class="k">Solved</div></div>
      <div class="dsa-stat"><div class="v a">${stats.streak}d</div><div class="k">Streak</div></div>
      <div class="dsa-stat"><div class="v g">${stats.avg}m</div><div class="k">Avg time</div></div>
    </div>

    <div class="spread" style="margin-bottom:10px">
      <h3 class="label" style="margin:0">Topics</h3>
      <button class="btn sm" data-action="dsa-targets">Edit targets</button>
    </div>
    ${topicRows}

    <div class="spread" style="margin:20px 0 10px">
      <h3 class="label" style="margin:0">Recent</h3>
      <button class="btn primary sm" data-action="dsa-log">+ Log problem</button>
    </div>
    ${recentRows}
  `;
}

/* ============================================================
   WORKOUTS
   ============================================================ */
export function renderWorkouts(s) {
  const stats = workoutStats();
  const pct = stats.target ? clamp(Math.round((stats.thisWeek / stats.target) * 100), 0, 100) : 0;

  const templates = [...DEFAULT_TEMPLATES, ...s.workouts.customTemplates];
  const templateRows = templates.map((t) => `
    <div class="wk-template">
      <div class="spread">
        <div style="min-width:0; flex:1">
          <div class="name">${esc(t.name)}</div>
          <div class="exlist">${t.exercises.map((e) => `${esc(e.name)} · ${e.sets}×${e.reps}`).join("<br>")}</div>
        </div>
      </div>
      <button class="btn primary block" data-action="wk-start" data-id="${t.id}">Start session</button>
    </div>
  `).join("");

  const recent = [...s.workouts.sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const sessionRows = recent.length
    ? recent.map((sess) => `
      <div class="wk-session">
        <div class="head">
          <div class="name">${esc(sess.name)}</div>
          <div class="date">${fmtDate(sess.date)}</div>
        </div>
        ${sess.exercises.slice(0, 4).map((e) => `
          <div class="ex"><span>${esc(e.name)}</span><span>${e.sets}×${e.reps} · ${e.weight || 0}kg</span></div>
        `).join("")}
        ${sess.exercises.length > 4 ? `<div class="ex" style="color:var(--text-3)">+${sess.exercises.length - 4} more</div>` : ""}
      </div>
    `).join("")
    : renderEmptyState(
        "dumbbell",
        "No sessions yet",
        "Start a quick workout or pick one of the templates above to begin tracking.",
        `<button class="btn primary" data-action="wk-freeform">Start Freeform Session</button>`
      );

  return `
    <div class="grid-head">
      <h2>Workout Log</h2>
      <button class="btn sm" data-action="goto-tab" data-id="more">← Back</button>
    </div>

    <div class="track-hero" style="margin-bottom:16px">
      <div class="big">${stats.thisWeek} <span style="font-size:20px; color:var(--text-3)">/ ${stats.target}</span></div>
      <div class="sub">sessions this week</div>
      <div class="wk-bar" style="margin-top:12px"><i class="${stats.thisWeek >= stats.target ? "over" : ""}" style="width:${pct}%"></i></div>
    </div>

    <div class="spread" style="margin-bottom:10px">
      <h3 class="label" style="margin:0">Templates</h3>
      <button class="btn sm" data-action="wk-new-template">+ Template</button>
    </div>
    ${templateRows}

    <div class="spread" style="margin:20px 0 10px">
      <h3 class="label" style="margin:0">Recent sessions</h3>
      <button class="btn sm primary" data-action="wk-freeform">+ Freeform session</button>
    </div>
    ${sessionRows}

    <div class="card" style="margin-top:16px">
      <h3>Weekly target</h3>
      <div class="row">
        <input type="number" id="wkTarget" value="${stats.target}" min="1" max="14" step="1" style="max-width:100px" />
        <span class="muted tiny">sessions per week</span>
        <button class="btn primary sm" data-action="wk-save-target" style="margin-left:auto">Save</button>
      </div>
    </div>
  `;
}

/* ============================================================
   WEIGHT
   ============================================================ */
export function renderWeight(s) {
  const stats = weightStats();
  const unit = s.weight.unit;
  const sorted = [...stats.entries].sort((a, b) => a.date.localeCompare(b.date));
  const recent = [...sorted].reverse().slice(0, 15);

  let svg = `<svg class="wt-chart" viewBox="0 0 300 100" preserveAspectRatio="none">`;
  if (sorted.length >= 2) {
    const weights = sorted.map((e) => +e.weight);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const range = max - min || 1;
    const points = sorted.map((e, i) => {
      const x = (i / (sorted.length - 1)) * 300;
      const y = 90 - ((e.weight - min) / range) * 80;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    svg += `<polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    const fillPoints = `${points} 300,100 0,100`;
    svg += `<polygon points="${fillPoints}" fill="var(--accent)" opacity="0.08"/>`;
  } else {
    svg += `<text x="150" y="55" text-anchor="middle" fill="var(--text-3)" font-size="12">Log 2+ entries to see trend</text>`;
  }
  svg += `</svg>`;

  const recentRows = recent.length
    ? recent.map((e) => `
      <div class="wt-entry">
        <span class="d">${fmtDate(e.date)}</span>
        <span class="w">${e.weight} ${unit}</span>
      </div>
    `).join("")
    : renderEmptyState(
        "scale",
        "No entries yet",
        "Log your weight regularly to see trends and stay on track toward your goal.",
        `<button class="btn primary" data-action="wt-log">Log Weight</button>`
      );

  return `
    <div class="grid-head">
      <h2>Weight Tracker</h2>
      <button class="btn sm" data-action="goto-tab" data-id="more">← Back</button>
    </div>

    <div class="wt-hero">
      <div class="spread" style="align-items:flex-start">
        <div>
          <div class="wt-current">${stats.current || "—"}${stats.current ? `<small>${unit}</small>` : ""}</div>
          ${stats.current ? `<div class="wt-delta ${stats.delta < 0 ? "down" : stats.delta > 0 ? "up" : ""}">
            ${stats.delta > 0 ? "▲" : stats.delta < 0 ? "▼" : "—"} ${Math.abs(stats.delta)} ${unit} since last
          </div>` : ""}
        </div>
        <div class="seg">
          <button class="${unit === "kg" ? "on" : ""}" data-action="wt-unit" data-id="kg">kg</button>
          <button class="${unit === "lbs" ? "on" : ""}" data-action="wt-unit" data-id="lbs">lbs</button>
        </div>
      </div>
      ${svg}
    </div>

    <div class="card" style="margin-bottom:16px">
      <h3>Goal</h3>
      <div class="row">
        <input type="number" id="wtGoal" value="${stats.goal || ""}" step="0.1" placeholder="Target weight" style="max-width:140px" />
        <span class="muted tiny">${unit}</span>
        <button class="btn primary sm" data-action="wt-save-goal" style="margin-left:auto">Save</button>
      </div>
    </div>

    <div class="spread" style="margin-bottom:10px">
      <h3 class="label" style="margin:0">Recent</h3>
      <button class="btn primary sm" data-action="wt-log">+ Log weight</button>
    </div>
    <div class="card">${recentRows}</div>
  `;
}

/* ============================================================
   STATS PANEL (desktop right column)
   ============================================================ */
export function renderStatsPanel(s) {
  const ready = readiness();
  const st = streakWithGrace();
  const delta = weeklyDelta();
  const effort = effortScore();
  const spark = effortSparkline(7);
  const tasks = nextUpTasks(1);
  const top = tasks[0];

  const sparkMax = Math.max(1, ...spark);
  const sparkPoints = spark
    .map((v, i) => `${(i / (spark.length - 1)) * 100},${30 - (v / sparkMax) * 26}`)
    .join(" ");

  const deltaClass = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const deltaSign = delta > 0 ? "+" : "";

  return `
    <div class="panel-section">
      <div class="panel-label label">Readiness</div>
      <div class="panel-big">${ready}<span class="panel-unit">%</span></div>
      <div class="panel-delta ${deltaClass}">${deltaSign}${delta}% vs last week</div>
    </div>

    <div class="panel-section">
      <div class="panel-label label">Streak</div>
      <div class="panel-row">
        <span class="panel-icon">${icons.flame}</span>
        <span class="panel-big-sm">${st}</span>
        <span class="panel-unit">days</span>
      </div>
    </div>

    <div class="panel-section">
      <div class="panel-label label">Effort — 30d</div>
      <div class="panel-row">
        <span class="panel-big-sm">${effort}</span>
        <svg class="effort-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="${sparkPoints}" fill="none" stroke="var(--accent)" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
        </svg>
      </div>
    </div>

    ${top ? `
      <div class="panel-section">
        <div class="panel-label label">Start with</div>
        <button class="panel-starter" data-action="quick-check" data-id="${top.goal.id}">
          <span class="panel-starter-title">${esc(top.goal.t)}</span>
          <span class="panel-starter-meta">${esc(top.pillar.title)}</span>
        </button>
      </div>
    ` : ""}
  `;
}