import { esc, clamp, todayISO, iso, fmtDate } from "./utils.js";
import {
  effectiveProgress, pillarProgress, stageProgress, readiness,
  streak, todaysBudget, nextUpTasks, appTotals, dsaStats,
  workoutStats, weightStats, DEFAULT_TEMPLATES, DSA_TOPICS,
  PILLAR_COLORS
} from "./state.js";

const LOCAL_ORDER = [[0,0],[0,1],[0,2],[1,0],[1,2],[2,0],[2,1],[2,2]];
const BLOCK_ORDER = [[0,0],[0,1],[0,2],[1,0],[1,2],[2,0],[2,1],[2,2]];

function band(p){
  if (p>=100) return "var(--green)";
  if (p>=81)  return "var(--violet)";
  if (p>=51)  return "var(--accent)";
  if (p>=21)  return "var(--amber)";
  return "var(--text-3)";
}
function priLetter(p){ return p === "High" ? "H" : p === "Medium" ? "M" : "L"; }

/* ============================================================
   TODAY
   ============================================================ */
export function renderToday(s){
  const name = s.user?.name || "there";
  const st = streak();
  const tasks = nextUpTasks(3);
  const { logged, target } = todaysBudget();
  const pct = target ? clamp(Math.round(logged/target*100), 0, 100) : 0;

  const taskRows = tasks.map(t => {
    const g = s.goals[t.goal.id];
    const totalSubs = g.subtasks.length;
    const doneSubs = g.subtasks.filter(x => x.done).length;
    const subPct = totalSubs ? Math.round(doneSubs/totalSubs*100) : 0;
    const due = t.days == null ? "" :
      t.days < 0 ? `${Math.abs(t.days)}d overdue` :
      t.days === 0 ? "Today" :
      t.days === 1 ? "Tomorrow" :
      `${t.days}d left`;
    const meta = [t.pillar.title, totalSubs ? `${doneSubs}/${totalSubs} subtasks` : null, due]
      .filter(Boolean).join(" · ");

    return `<div class="task ${t.days < 0 ? "overdue" : ""}">
      <button class="ck" data-action="quick-check" data-id="${t.goal.id}" aria-label="Complete next subtask">✓</button>
      <div class="info" data-action="open-goal" data-id="${t.goal.id}" style="cursor:pointer">
        <div class="t">${esc(t.goal.t)}</div>
        <div class="s">${esc(meta)}</div>
        ${totalSubs ? `<div class="mini-bar"><i style="width:${subPct}%"></i></div>` : ""}
      </div>
    </div>`;
  }).join("");

  const miniCells = [];
  for (let r=0; r<3; r++){
    for (let c=0; c<3; c++){
      if (r === 1 && c === 1){
        miniCells.push(`<div class="mg-cell center">${readiness()}%</div>`);
      } else {
        const bi = BLOCK_ORDER.findIndex(([a,b]) => a === r && b === c);
        const p = s.pillars[bi];
        const prog = pillarProgress(p);
        miniCells.push(`<div class="mg-cell" data-action="jump-pillar" data-id="${p.id}" title="${esc(p.title)}">
          <div class="fill" style="height:${prog}%; background:${p.color}"></div>
        </div>`);
      }
    }
  }

  return `
  <div class="greet">
    <div>
      <h2>Hi ${esc(name)} 👋</h2>
      <p>${tasks.length ? `${tasks.length} thing${tasks.length === 1 ? "" : "s"} to move forward today` : "You're all caught up. Beautiful."}</p>
    </div>
    <div class="streak">🔥 ${st}</div>
  </div>

  <section class="nextup">
    <h3>NEXT UP</h3>
    ${taskRows || `<div class="empty" style="padding:14px">Nothing open. Add a goal in Grid.</div>`}
    ${tasks.length ? `<button class="add-tl" style="margin-top:8px" data-action="goto-tab" data-id="grid">See all open goals →</button>` : ""}
  </section>

  <section class="budget">
    <div class="spread">
      <h3 style="margin:0">TODAY'S BUDGET</h3>
      <span class="muted tiny">${logged}h / ${target}h</span>
    </div>
    <div class="bar"><i class="${pct >= 100 ? "done" : ""}" style="width:${pct}%"></i></div>
    <div class="quick">
      <button data-action="log-time-minus" data-id="0.5">−0.5h</button>
      <button data-action="log-time" data-id="0.5">+0.5h</button>
      <button data-action="log-time" data-id="1">+1h</button>
      <button data-action="log-time-edit">Set…</button>
    </div>
  </section>

  <section class="mini-grid">${miniCells.join("")}</section>
  `;
}

/* ============================================================
   GRID
   ============================================================ */
export function renderGrid(s, mode){
  const toggleHtml = `
    <div class="seg" id="gridMode">
      <button class="${mode === "map" ? "on" : ""}" data-action="grid-mode" data-id="map">Map</button>
      <button class="${mode === "full" ? "on" : ""}" data-action="grid-mode" data-id="full">Full 9×9</button>
    </div>`;

  if (mode === "full"){
    return `
    <div class="grid-head"><h2>Your Grid</h2>${toggleHtml}</div>
    <div class="card" style="padding:8px; overflow:auto; -webkit-overflow-scrolling:touch">
      ${renderFullGrid(s)}
    </div>
    <p class="tiny muted" style="text-align:center; margin-top:10px">Scroll to pan · tap any goal to open</p>
    `;
  }

  const cells = [];
  for (let r=0; r<3; r++){
    for (let c=0; c<3; c++){
      if (r === 1 && c === 1){
        cells.push(`<button class="block center" data-action="open-stages">
          <div class="bname">${esc(s.meta.mainGoal.slice(0,40))}</div>
          <div class="bpct">${readiness()}% ready</div>
        </button>`);
      } else {
        const bi = BLOCK_ORDER.findIndex(([a,b]) => a === r && b === c);
        const p = s.pillars[bi];
        const prog = pillarProgress(p);
        cells.push(`<button class="block" style="--pc:${p.color}" data-action="open-pillar" data-id="${p.id}">
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

export function renderFullGrid(s){
  const cells = [];
  for (let r=0; r<9; r++){
    for (let c=0; c<9; c++){
      const br = Math.floor(r/3), bc = Math.floor(c/3);
      const lr = r % 3, lc = c % 3;
      if (br === 1 && bc === 1){
        if (lr === 1 && lc === 1){
          cells.push(`<button class="goal center" data-action="open-stages">
            <div class="gtitle">${esc(s.meta.mainGoal.slice(0,30))}</div>
            <div class="gfoot">${readiness()}%</div>
          </button>`);
        } else {
          const i = LOCAL_ORDER.findIndex(([a,b]) => a === lr && b === lc);
          const st = s.stages[i];
          if (!st){ cells.push(`<div class="goal" style="opacity:.3"></div>`); continue; }
          const avg = stageProgress(st);
          cells.push(`<button class="goal center" data-action="open-stage" data-id="${i}">
            <div class="gtitle">${esc(st.name)}</div>
            <div class="gfoot">${avg}%</div>
          </button>`);
        }
      } else {
        const bi = BLOCK_ORDER.findIndex(([a,b]) => a === br && b === bc);
        const p = s.pillars[bi];
        const li = LOCAL_ORDER.findIndex(([a,b]) => a === lr && b === lc);
        if (lr === 1 && lc === 1){
          const prog = pillarProgress(p);
          cells.push(`<button class="goal center" style="--pc:${p.color}" data-action="open-pillar" data-id="${p.id}">
            <div class="gtitle">${esc(p.title)}</div>
            <div class="gfoot">${prog}%</div>
          </button>`);
        } else {
          const g = (p.goals || [])[li];
          if (!g){ cells.push(`<div class="goal" style="opacity:.3"></div>`); continue; }
          const st = s.goals[g.id] || {};
          const prog = effectiveProgress(g.id);
          const done = prog >= 100 || st.status === "Completed";
          cells.push(`<button class="goal ${done ? "complete" : ""}" style="--pc:${p.color}" data-action="open-goal" data-id="${g.id}">
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
export function renderPlan(s){
  return `
  <div class="plan-head">
    <h2>Roadmap</h2>
    <button class="btn sm" data-action="add-month">+ Month</button>
  </div>
  <div class="tl">
    ${s.roadmap.map((r, ri) => {
      const tl = s.timeline[r.m] || { items:[] };
      const doneCount = tl.items.filter(Boolean).length;
      const isDone = tl.items.length && doneCount === tl.items.length;
      const isCurrent = !isDone && s.roadmap.findIndex(x => {
        const t = s.timeline[x.m] || { items:[] };
        return !(t.items.length && t.items.every(Boolean));
      }) === ri;
      return `<div class="tl-month ${isDone ? "done" : ""} ${isCurrent ? "current" : ""}">
        <div class="tl-head">
          <div class="tl-title" contenteditable="true" data-action="inline-edit" data-scope="rm-month" data-id="${esc(r.m)}">${esc(r.m)}</div>
          <div class="tl-count">${doneCount}/${tl.items.length}${isDone ? " ✓" : ""}</div>
        </div>
        <div class="tl-focus" contenteditable="true" data-action="inline-edit" data-scope="rm-focus" data-id="${esc(r.m)}">${esc(r.focus || "")}</div>
        <div class="tl-items">
          ${r.items.map((it, i) => `
            <div class="tl-item ${tl.items[i] ? "on" : ""}">
              <input type="checkbox" ${tl.items[i] ? "checked" : ""} data-tl="${esc(r.m)}" data-i="${i}" />
              <span class="edit" contenteditable="true" data-action="inline-edit" data-scope="rm-item" data-id="${esc(r.m)}" data-i="${i}">${esc(it)}</span>
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
   TRACK
   ============================================================ */
export function renderTrack(s){
  const w = s.weekly;
  const cats = Object.keys(w.targets);
  const totalLogged = cats.reduce((a,c) => a + (+w.logged[c] || 0), 0);
  const totalTarget = cats.reduce((a,c) => a + (+w.targets[c] || 0), 0);
  const pct = totalTarget ? Math.round(totalLogged/totalTarget*100) : 0;

  const catRows = cats.map(c => {
    const tgt = +w.targets[c] || 0;
    const got = +w.logged[c] || 0;
    const p = tgt ? clamp(Math.round(got/tgt*100), 0, 100) : 0;
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
      <span class="chip">🔥 <b>${streak()}</b> day streak</span>
      <span class="chip"><b>${pct}%</b> of plan</span>
    </div>
  </div>

  <div class="spread" style="margin-bottom:10px">
    <h3 class="muted" style="margin:0; font-size:12px; letter-spacing:.02em">CATEGORIES</h3>
    <button class="btn sm" data-action="add-wk-cat">+ Category</button>
  </div>

  ${catRows || `<div class="empty">No categories yet.</div>`}

  <section class="card" style="margin-top:16px">
    <h3>ACTIVITY — LAST 12 WEEKS</h3>
    ${renderHeatmap(s)}
  </section>
  `;
}

function renderHeatmap(s){
  const cells = [];
  const base = new Date(); base.setHours(0,0,0,0);
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7));
  for (let i=11; i>=0; i--){
    for (let d=0; d<7; d++){
      const day = new Date(base);
      day.setDate(base.getDate() - i*7 + d);
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
   MORE
   ============================================================ */
export function renderMore(s){
  const goalType = s.user?.goalType || "career";
  const totals = appTotals();
  const dsa = dsaStats();
  const wt = workoutStats();
  return `
  <h2 style="margin-bottom:16px; font-size:20px; font-weight:800">More</h2>

  <div class="more-group-label">YOUR TOOLS</div>
  <div class="more-list" style="margin-bottom:16px">
    <button class="more-item" data-action="open-projects">
      <span class="lbl">📁 Projects</span>
      <span class="cnt">${s.projects.length} <span class="muted">›</span></span>
    </button>
    <button class="more-item" data-action="open-apps">
      <span class="lbl">📨 Applications</span>
      <span class="cnt">${totals.total} <span class="muted">›</span></span>
    </button>
    ${goalType === "career" || goalType === "other" ? `
      <button class="more-item" data-action="open-dsa">
        <span class="lbl">🧮 DSA Tracker</span>
        <span class="cnt">${dsa.solved}/${dsa.total} <span class="muted">›</span></span>
      </button>
    ` : ""}
    ${goalType === "fitness" || goalType === "other" ? `
      <button class="more-item" data-action="open-workouts">
        <span class="lbl">💪 Workout log</span>
        <span class="cnt">${wt.thisWeek}/${wt.target} wk <span class="muted">›</span></span>
      </button>
      <button class="more-item" data-action="open-weight">
        <span class="lbl">⚖️ Weight tracker</span>
        <span class="cnt">${weightStats().current ? weightStats().current + " " + s.weight.unit : "—"} <span class="muted">›</span></span>
      </button>
    ` : ""}
  </div>

  <div class="more-group-label">SETUP</div>
  <div class="more-list" style="margin-bottom:16px">
    <button class="more-item" data-action="open-ai">
      <span class="lbl">✨ AI Prompt helper</span><span class="cnt">›</span>
    </button>
    <button class="more-item" data-action="open-theme">
      <span class="lbl">🎨 Theme</span>
      <span class="cnt">${s.settings.theme} <span class="muted">›</span></span>
    </button>
    <button class="more-item" data-action="open-customize">
      <span class="lbl">⚙️ Customize grid</span><span class="cnt">›</span>
    </button>
  </div>

  <div class="more-group-label">DATA</div>
  <div class="more-list" style="margin-bottom:16px">
    <button class="more-item" data-action="export"><span class="lbl">⬇️ Export JSON</span></button>
    <button class="more-item" data-action="import"><span class="lbl">⬆️ Import JSON</span></button>
  </div>

  <div class="more-group-label" style="color:var(--red)">DANGER ZONE</div>
  <div class="more-list">
    <button class="more-item danger" data-action="reset"><span class="lbl">⚠️ Reset all data</span></button>
  </div>
  `;
}

/* ============================================================
   DSA TRACKER
   ============================================================ */
export function renderDsa(s){
  const stats = dsaStats();
  const totals = s.dsa.problems.length;
  const targets = Object.values(s.dsa.targets).reduce((a,b) => a+b, 0);

  const topicRows = DSA_TOPICS.map(topic => {
    const target = s.dsa.targets[topic] || 0;
    const solved = s.dsa.problems.filter(p => p.topic === topic && p.status === "Solved").length;
    const pct = target ? clamp(Math.round(solved/target*100), 0, 100) : 0;
    const done = target > 0 && solved >= target;
    return `<div class="dsa-topic">
      <div class="dsa-topic-head">
        <div class="dsa-topic-name">${esc(topic)}</div>
        <div class="dsa-topic-count ${done ? "done" : ""}">${solved} / ${target}</div>
      </div>
      <div class="dsa-bar"><i class="${done ? "done" : ""}" style="width:${pct}%"></i></div>
    </div>`;
  }).join("");

  const recent = [...s.dsa.problems].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 10);
  const recentRows = recent.length ? recent.map(p => `
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
  `).join("") : `<div class="empty" style="padding:20px">No problems logged yet.</div>`;

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
    <h3 class="muted" style="margin:0; font-size:12px; letter-spacing:.02em">TOPICS</h3>
    <button class="btn sm" data-action="dsa-targets">Edit targets</button>
  </div>
  ${topicRows}

  <div class="spread" style="margin:20px 0 10px">
    <h3 class="muted" style="margin:0; font-size:12px; letter-spacing:.02em">RECENT</h3>
    <button class="btn primary sm" data-action="dsa-log">+ Log problem</button>
  </div>
  ${recentRows}
  `;
}

/* ============================================================
   WORKOUTS
   ============================================================ */
export function renderWorkouts(s){
  const stats = workoutStats();
  const pct = stats.target ? clamp(Math.round(stats.thisWeek/stats.target*100), 0, 100) : 0;

  const templates = [...DEFAULT_TEMPLATES, ...s.workouts.customTemplates];
  const templateRows = templates.map(t => `
    <div class="wk-template">
      <div class="spread">
        <div style="min-width:0; flex:1">
          <div class="name">${esc(t.name)}</div>
          <div class="exlist">${t.exercises.map(e => `${esc(e.name)} · ${e.sets}×${e.reps}`).join("<br>")}</div>
        </div>
      </div>
      <button class="btn primary block" data-action="wk-start" data-id="${t.id}">Start session</button>
    </div>
  `).join("");

  const recent = [...s.workouts.sessions].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 8);
  const sessionRows = recent.length ? recent.map(sess => `
    <div class="wk-session">
      <div class="head">
        <div class="name">${esc(sess.name)}</div>
        <div class="date">${fmtDate(sess.date)}</div>
      </div>
      ${sess.exercises.slice(0, 4).map(e => `
        <div class="ex"><span>${esc(e.name)}</span><span>${e.sets}×${e.reps} · ${e.weight || 0}kg</span></div>
      `).join("")}
      ${sess.exercises.length > 4 ? `<div class="ex" style="color:var(--text-3)">+${sess.exercises.length - 4} more</div>` : ""}
    </div>
  `).join("") : `<div class="empty" style="padding:20px">No sessions yet.</div>`;

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
    <h3 class="muted" style="margin:0; font-size:12px; letter-spacing:.02em">TEMPLATES</h3>
    <button class="btn sm" data-action="wk-new-template">+ Template</button>
  </div>
  ${templateRows}

  <div class="spread" style="margin:20px 0 10px">
    <h3 class="muted" style="margin:0; font-size:12px; letter-spacing:.02em">RECENT SESSIONS</h3>
    <button class="btn sm primary" data-action="wk-freeform">+ Freeform session</button>
  </div>
  ${sessionRows}

  <div class="card" style="margin-top:16px">
    <h3>WEEKLY TARGET</h3>
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
export function renderWeight(s){
  const stats = weightStats();
  const unit = s.weight.unit;
  const sorted = [...stats.entries].sort((a,b) => a.date.localeCompare(b.date));
  const recent = [...sorted].reverse().slice(0, 15);

  // sparkline
  let svg = `<svg class="wt-chart" viewBox="0 0 300 100" preserveAspectRatio="none">`;
  if (sorted.length >= 2){
    const weights = sorted.map(e => +e.weight);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const range = max - min || 1;
    const points = sorted.map((e, i) => {
      const x = (i / (sorted.length - 1)) * 300;
      const y = 90 - ((e.weight - min) / range) * 80;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    svg += `<polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    // fill gradient
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const fillPoints = `${points} 300,100 0,100`;
    svg += `<polygon points="${fillPoints}" fill="var(--accent)" opacity="0.08"/>`;
  } else {
    svg += `<text x="150" y="55" text-anchor="middle" fill="var(--text-3)" font-size="12">Log 2+ entries to see trend</text>`;
  }
  svg += `</svg>`;

  const recentRows = recent.length ? recent.map(e => {
    const d = new Date(e.date);
    return `<div class="wt-entry">
      <span class="d">${fmtDate(e.date)}</span>
      <span class="w">${e.weight} ${unit}</span>
    </div>`;
  }).join("") : `<div class="empty" style="padding:20px">No entries yet.</div>`;

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
    <h3>GOAL</h3>
    <div class="row">
      <input type="number" id="wtGoal" value="${stats.goal || ""}" step="0.1" placeholder="Target weight" style="max-width:140px" />
      <span class="muted tiny">${unit}</span>
      <button class="btn primary sm" data-action="wt-save-goal" style="margin-left:auto">Save</button>
    </div>
  </div>

  <div class="spread" style="margin-bottom:10px">
    <h3 class="muted" style="margin:0; font-size:12px; letter-spacing:.02em">RECENT</h3>
    <button class="btn primary sm" data-action="wt-log">+ Log weight</button>
  </div>
  <div class="card">${recentRows}</div>
  `;
}