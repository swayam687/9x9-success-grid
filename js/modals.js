// js/modals.js — imperative modal openers
import { $, esc, clamp, todayISO, uid, fmtDate, toast } from "./utils.js";
import {
  getState, saveState, findGoal, effectiveProgress, pillarProgress, stageProgress,
  DEFAULT_TEMPLATES, DSA_TOPICS, DSA_DIFFICULTIES, DSA_STATUSES,
  PILLAR_COLORS, STAGE_NAMES,
  nextSubtaskFor, personalRecords, milestoneStatus,
  lastWeekStats, markRecapSeen, pillarFn, pillarColorVar,
  MILESTONE_DEFS
} from "./state.js";
import {
  openModal, closeModal, THEMES, A11Y_MODES, applyTheme, applyA11y,
  modalFoot, openFocus, openCommand
} from "./ui.js";
import { renderDsa, renderWorkouts, renderWeight, renderEmptyState, renderStatsPanel } from "./views.js";
import { icons } from "./icons.js";

function priLetter(p) { return p === "High" ? "H" : p === "Medium" ? "M" : "L"; }
function priColor(p) {
  return p === "High" ? "var(--danger)" : p === "Medium" ? "var(--attention)" : "var(--text-3)";
}

/* ============================================================
   GOAL
   ============================================================ */
export function openGoal(id, opts = {}) {
  const s = getState();
  const { pillar, goal } = findGoal(id);
  if (!goal) return;
  const st = s.goals[id] || {
    progress: 0, status: "Not Started", priority: "Medium",
    targetDate: "", notes: "", autoSync: false, subtasks: []
  };
  const prog = effectiveProgress(id);
  const statusCls = st.status === "Completed" ? "cp"
    : st.status === "In Progress" ? "ip"
    : st.status === "Needs Review" ? "nr" : "ns";
  const days = (function (dstr) {
    if (!dstr) return null;
    const dd = new Date(dstr);
    if (isNaN(dd.getTime())) return null;
    const a = dd.setHours(0, 0, 0, 0);
    const b = new Date().setHours(0, 0, 0, 0);
    return Math.round((a - b) / 86400000);
  })(st.targetDate);
  const dueTxt = days == null ? "" : days < 0 ? `${Math.abs(days)}d overdue`
    : days === 0 ? "Due today" : `${days} days left`;
  const nextSub = (st.subtasks || []).find((x) => !x.done);

  openModal(`
    <div class="drawer-head">
      <div style="min-width:0">
        <div class="crumb pillar-fn-${pillarFn(pillar)}" style="color:var(--pillar-ink, var(--accent))">${esc(pillar.title)}</div>
        <h2>${esc(goal.t)}</h2>
        <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap">
          <span class="pill ${statusCls}">${esc(st.status)}</span>
          ${dueTxt ? `<span class="pill ns">${dueTxt}</span>` : ""}
        </div>
      </div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <p class="tiny muted" style="margin:0 0 14px">${esc(goal.d)}</p>

      ${nextSub ? `
        <button class="btn primary block" data-action="focus-start" data-id="${id}" style="margin:0 0 14px">
          ${icons.focus} <span>Focus on: ${esc(nextSub.title.slice(0, 40))}</span>
        </button>
      ` : ""}

      <div class="note-box">
        Priority: <span class="pri ${priLetter(st.priority)}">${priLetter(st.priority)}</span>
        <b style="color:${priColor(st.priority)}">${esc(st.priority)}</b>
        ${st.autoSync ? ' · <b>Auto-synced from subtasks</b>' : ""}
      </div>

      <div class="field">
        <label class="fl">Progress</label>
        <div class="slider-row">
          <input type="range" min="0" max="100" value="${prog}" data-goal-progress ${st.autoSync ? "disabled" : ""} />
          <span style="font-size:20px;font-weight:800;color:var(--accent);min-width:60px;text-align:right;font-family:var(--font-mono)" id="goalPct">${prog}%</span>
        </div>
      </div>

      <div class="grid2 field">
        <div><label class="fl">Status</label>
          <select data-goal-status>
            ${["Not Started", "In Progress", "Completed", "Needs Review"].map((v) => `<option${st.status === v ? " selected" : ""}>${v}</option>`).join("")}
          </select></div>
        <div><label class="fl">Priority</label>
          <select data-goal-priority>
            ${["High", "Medium", "Low"].map((v) => `<option${st.priority === v ? " selected" : ""}>${v}</option>`).join("")}
          </select></div>
      </div>

      <div class="field">
        <label class="fl">Target date</label>
        <input type="date" value="${esc(st.targetDate || "")}" data-goal-date />
      </div>

      <div class="field">
        <label class="fl">Subtasks ${st.subtasks.filter((x) => x.done).length}/${st.subtasks.length}</label>
        <div class="subtasks">
          ${st.subtasks.length ? st.subtasks.map((x) => `
            <div class="subtask">
              <input type="checkbox" ${x.done ? "checked" : ""} data-action="toggle-subtask" data-id="${x.id}" />
              <span class="${x.done ? "done" : ""}">${esc(x.title)}</span>
              <button class="del" data-action="del-subtask" data-id="${x.id}" aria-label="Delete">×</button>
            </div>
          `).join("") : `<p class="tiny muted" style="margin:0">No subtasks yet.</p>`}
        </div>
        <label class="tl-item tiny" style="padding:10px 12px;background:var(--surface-2);border-radius:10px">
          <input type="checkbox" ${st.autoSync ? "checked" : ""} data-goal-sync />
          <span>Auto-sync progress from subtasks</span>
        </label>
      </div>

      <div class="field">
        <label class="fl">Notes</label>
        <textarea data-goal-notes placeholder="What did you learn? What is blocking you?">${esc(st.notes)}</textarea>
      </div>
    </div>
    <div class="drawer-foot" style="justify-content:stretch">
      <input type="text" placeholder="Add a subtask…" id="newSubtask" style="flex:1" />
      <button class="btn primary" data-action="add-subtask" data-id="${id}">Add</button>
    </div>
  `, { onClose: opts.onClose });

  const drawer = document.querySelector(".drawer");
  if (drawer instanceof HTMLElement) drawer.dataset.goalId = id;

  if (opts.focus) setTimeout(() => $("#newSubtask")?.focus({ preventScroll: true }), 250);
}

/* ============================================================
   PILLAR
   ============================================================ */
export function openPillar(id) {
  const s = getState();
  const p = s.pillars.find((x) => x.id === id);
  if (!p) return;
  const avg = pillarProgress(p);
  const LOCAL_ORDER = [[0,0],[0,1],[0,2],[1,0],[1,2],[2,0],[2,1],[2,2]];
  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (r === 1 && c === 1) {
        cells.push(`<div class="goal center" style="--pc:${p.color}">
          <div class="gtitle">${esc(p.title)}</div>
          <div class="gfoot">${avg}%</div>
        </div>`);
      } else {
        const li = LOCAL_ORDER.findIndex(([a, b]) => a === r && b === c);
        const g = (p.goals || [])[li];
        if (!g) { cells.push(`<div class="goal" style="opacity:.3"></div>`); continue; }
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
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb" style="color:${p.color}">Pillar</div><h2>${esc(p.title)}</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <div class="note-box">${esc(p.tagline || "")}</div>
      <div class="goalmap">${cells.join("")}</div>
    </div>
    <div class="drawer-foot"><button class="btn primary" data-action="close-modal">Close</button></div>
  `);
}

/* ============================================================
   STAGES
   ============================================================ */
export function openStages() {
  const s = getState();
  const stageRows = s.stages.map((st, i) => {
    const p = s.pillars.find((x) => x.id === st.src[0]);
    const prog = stageProgress(st);
    const cls = prog >= 100 ? "done" : "";
    return `<button class="tl-month ${cls}" data-action="open-stage" data-id="${i}"
      style="text-align:left;width:100%;cursor:pointer;font-family:inherit;color:var(--text-1);border:1px solid var(--border);">
      <div class="tl-head">
        <div class="tl-title">${esc(st.name)}</div>
        <div class="tl-count">${prog}%</div>
      </div>
      <div class="tl-focus">${esc(p ? p.title : "")}</div>
      <div class="tiny muted">${esc(st.desc || "")}</div>
    </button>`;
  }).join("");
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb" style="color:var(--accent)">Progress phases</div><h2>8 Stages</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">${stageRows}</div>
    <div class="drawer-foot"><button class="btn primary" data-action="close-modal">Close</button></div>
  `);
}

/* ============================================================
   PROJECTS
   ============================================================ */
export function openProjects() {
  const s = getState();
  const rows = s.projects.length ? s.projects.map((p) => `
    <div class="proj">
      <div class="spread">
        <h4>${esc(p.name)}</h4>
        <div class="row">
          <button class="btn sm" data-action="edit-project" data-id="${p.id}">Edit</button>
          <button class="btn sm danger" data-action="del-project" data-id="${p.id}">×</button>
        </div>
      </div>
      <p class="tiny muted">${esc(p.desc || "")}</p>
      <div>${(p.stack || "").split(",").map((x) => x.trim()).filter(Boolean).map((x) => `<span class="tag">${esc(x)}</span>`).join("")}</div>
      <div class="kv"><span>Status <b>${esc(p.status || "")}</b></span><span>Progress <b>${p.progress || 0}%</b></span></div>
    </div>
  `).join("") : renderEmptyState(
    "folder",
    "No projects yet",
    "Start building your portfolio by adding your first project.",
    `<button class="btn primary" data-action="add-project">Add Project</button>`
  );

  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">You</div><h2>Projects</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      ${rows}
      ${s.projects.length ? `<button class="btn primary block" data-action="add-project" style="margin-top:14px">+ Add project</button>` : ""}
    </div>
  `);
}

export function openProjectModal(id) {
  const s = getState();
  const p = id ? s.projects.find((x) => x.id === id) : null;
  const v = p || { name: "", desc: "", stack: "", github: "", live: "", status: "Not Started", progress: 0, notes: "" };
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">Projects</div><h2>${p ? "Edit" : "Add"} project</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <input type="hidden" id="projId" value="${p ? p.id : ""}" />
      <div class="field"><label class="fl">Name</label><input id="pName" value="${esc(v.name)}" /></div>
      <div class="field"><label class="fl">Description</label><textarea id="pDesc">${esc(v.desc)}</textarea></div>
      <div class="field"><label class="fl">Stack (comma sep)</label><input id="pStack" value="${esc(v.stack)}" /></div>
      <div class="grid2 field">
        <div><label class="fl">GitHub URL</label><input id="pGithub" value="${esc(v.github)}" /></div>
        <div><label class="fl">Live URL</label><input id="pLive" value="${esc(v.live)}" /></div>
      </div>
      <div class="grid2 field">
        <div><label class="fl">Status</label>
          <select id="pStatus">${["Not Started", "In Progress", "Completed", "Paused"].map((x) => `<option${v.status === x ? " selected" : ""}>${x}</option>`).join("")}</select>
        </div>
        <div><label class="fl">Progress %</label><input type="number" id="pProg" min="0" max="100" value="${v.progress}" /></div>
      </div>
      <div class="field"><label class="fl">Notes</label><textarea id="pNotes">${esc(v.notes)}</textarea></div>
    </div>
    <div class="drawer-foot">
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn primary" data-action="save-project">Save</button>
    </div>
  `);
}

/* ============================================================
   APPLICATIONS
   ============================================================ */
export function openApps() {
  const s = getState();
  const rows = s.applications.length ? s.applications.map((a) => `
    <div class="proj">
      <div class="spread">
        <div style="min-width:0">
          <h4>${esc(a.company || "")}</h4>
          <div class="tiny muted">${esc(a.role || "")}</div>
        </div>
        <button class="btn sm danger" data-action="del-app" data-id="${a.id}">×</button>
      </div>
      <div class="kv"><span>Status <b>${esc(a.status || "")}</b></span><span>${esc(a.date || "")}</span></div>
    </div>
  `).join("") : renderEmptyState(
    "send",
    "No applications yet",
    "Track your job applications, interviews, and offers in one place.",
    `<button class="btn primary" data-action="add-app">Add Application</button>`
  );

  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">You</div><h2>Applications</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      ${rows}
      ${s.applications.length ? `<button class="btn primary block" data-action="add-app" style="margin-top:14px">+ Add application</button>` : ""}
    </div>
  `);
}

export function openAppModal() {
  const statuses = ["Saved", "Preparing", "Applied", "Assessment", "Interview", "Rejected", "Offer", "Withdrawn"];
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">Applications</div><h2>Add application</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <div class="field"><label class="fl">Company</label><input id="aCompany" /></div>
      <div class="field"><label class="fl">Role</label><input id="aRole" /></div>
      <div class="grid2 field">
        <div><label class="fl">Status</label>
          <select id="aStatus">${statuses.map((x) => `<option>${x}</option>`).join("")}</select>
        </div>
        <div><label class="fl">Date</label><input type="date" id="aDate" value="${todayISO()}" /></div>
      </div>
      <div class="field"><label class="fl">Notes</label><textarea id="aNotes"></textarea></div>
    </div>
    <div class="drawer-foot">
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn primary" data-action="save-app">Save</button>
    </div>
  `);
}

/* ============================================================
   DSA
   ============================================================ */
export function openDsaLog() {
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">DSA Tracker</div><h2>Log a problem</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <div class="field"><label class="fl">Problem name</label><input id="dName" placeholder="e.g. Two Sum" /></div>
      <div class="grid2 field">
        <div><label class="fl">Topic</label>
          <select id="dTopic">${DSA_TOPICS.map((x) => `<option>${x}</option>`).join("")}</select>
        </div>
        <div><label class="fl">Difficulty</label>
          <select id="dDifficulty">${DSA_DIFFICULTIES.map((x) => `<option>${x}</option>`).join("")}</select>
        </div>
      </div>
      <div class="grid2 field">
        <div><label class="fl">Time (min)</label><input type="number" id="dTime" value="30" min="1" /></div>
        <div><label class="fl">Status</label>
          <select id="dStatus">${DSA_STATUSES.map((x) => `<option>${x}</option>`).join("")}</select>
        </div>
      </div>
      <div class="field"><label class="fl">Date</label><input type="date" id="dDate" value="${todayISO()}" /></div>
      <div class="field"><label class="fl">Notes</label><textarea id="dNotes" placeholder="What was the key idea?"></textarea></div>
    </div>
    <div class="drawer-foot">
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn primary" data-action="dsa-save">Save</button>
    </div>
  `);
}

export function openDsaTargets() {
  const s = getState();
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">DSA Tracker</div><h2>Edit targets</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      ${DSA_TOPICS.map((t) => `
        <div class="field" style="display:flex; align-items:center; gap:12px">
          <label style="flex:1; margin:0">${esc(t)}</label>
          <input type="number" min="0" value="${s.dsa.targets[t] || 0}" data-dsa-target="${esc(t)}" style="width:80px" />
        </div>
      `).join("")}
    </div>
    <div class="drawer-foot">
      <button class="btn primary" data-action="close-modal">Done</button>
    </div>
  `);
}

/* ============================================================
   WORKOUTS
   ============================================================ */
export function openWorkoutSession(templateId) {
  const s = getState();
  let template = null;
  if (templateId) {
    template = [...DEFAULT_TEMPLATES, ...s.workouts.customTemplates].find((x) => x.id === templateId);
  }
  const exercises = template ? template.exercises.map((e) => ({ ...e, done: false })) : [];
  const sessionName = template ? template.name : "Freeform session";

  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">Workout</div><h2>${esc(sessionName)}</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <input type="hidden" id="wsTemplateId" value="${templateId || ""}" />
      <div class="field"><label class="fl">Session name</label><input id="wsName" value="${esc(sessionName)}" /></div>
      <div class="field"><label class="fl">Date</label><input type="date" id="wsDate" value="${todayISO()}" /></div>
      <label class="fl">Exercises</label>
      <div id="wsExercises">
        ${exercises.map((e, i) => wsExerciseRow(e, i)).join("")}
      </div>
      <button class="add-tl" data-action="ws-add-exercise" style="margin-top:6px">+ Add exercise</button>
    </div>
    <div class="drawer-foot">
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn primary" data-action="ws-save">Save session</button>
    </div>
  `);
}

export function wsExerciseRow(e, i) {
  return `<div class="subtask" style="flex-wrap:wrap; padding:10px" data-ws-row="${i}">
    <input type="text" value="${esc(e.name)}" placeholder="Exercise" data-ws-name style="flex:1; min-width:120px" />
    <input type="number" value="${e.sets || 3}" min="1" data-ws-sets style="width:56px" placeholder="Sets" />
    <span class="muted tiny">×</span>
    <input type="number" value="${e.reps || 8}" min="1" data-ws-reps style="width:56px" placeholder="Reps" />
    <input type="number" value="${e.weight || 0}" min="0" step="0.5" data-ws-weight style="width:70px" placeholder="kg" />
    <button class="del" data-action="ws-rm-exercise" data-i="${i}" aria-label="Remove">×</button>
  </div>`;
}

export function openWorkoutTemplateEditor(templateId) {
  const s = getState();
  let template = null;
  if (templateId) {
    template = [...DEFAULT_TEMPLATES, ...s.workouts.customTemplates].find((x) => x.id === templateId);
  }
  const isDefault = template && DEFAULT_TEMPLATES.some((d) => d.id === template.id);
  const exercises = template ? template.exercises : [{ name: "", sets: 3, reps: 8, weight: 0 }];

  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">Workout</div><h2>${template ? "Edit" : "New"} template</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      ${isDefault ? `<div class="note-box">This is a built-in template. Editing will create a custom copy.</div>` : ""}
      <input type="hidden" id="wtId" value="${template ? template.id : ""}" />
      <div class="field"><label class="fl">Template name</label><input id="wtName" value="${esc(template ? template.name : "")}" placeholder="e.g. Upper Body" /></div>
      <label class="fl">Exercises</label>
      <div id="wtExercises">
        ${exercises.map((e, i) => wsExerciseRow(e, i)).join("")}
      </div>
      <button class="add-tl" data-action="wt-add-exercise" style="margin-top:6px">+ Add exercise</button>
    </div>
    <div class="drawer-foot">
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn primary" data-action="wkt-save">Save</button>
    </div>
  `);
}

/* ============================================================
   WEIGHT
   ============================================================ */
export function openWeightLog() {
  const s = getState();
  const stats = (function () {
    const entries = [...s.weight.entries].sort((a, b) => a.date.localeCompare(b.date));
    const latest = entries[entries.length - 1];
    return { current: latest ? latest.weight : null };
  })();
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">Weight</div><h2>Log weight</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <div class="grid2 field">
        <div><label class="fl">Weight (${s.weight.unit})</label>
          <input type="number" id="wWeight" step="0.1" value="${stats.current || ""}" /></div>
        <div><label class="fl">Date</label>
          <input type="date" id="wDate" value="${todayISO()}" /></div>
      </div>
      <div class="field"><label class="fl">Note (optional)</label><input id="wNote" placeholder="e.g. morning, after workout" /></div>
    </div>
    <div class="drawer-foot">
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn primary" data-action="wt-save">Save</button>
    </div>
  `);
}

/* ============================================================
   THEME PICKER — 4 themes now
   ============================================================ */
export function openThemePicker() {
  const s = getState();
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">You</div><h2>Theme</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <p class="tiny muted">Choose a look. One light, three dark.</p>
      <div class="theme-grid">
        ${THEMES.map((t) => `
          <button class="theme-card ${s.settings.theme === t.id ? "active" : ""}" data-action="set-theme" data-id="${t.id}" data-theme-id="${t.id}">
            <div class="swatch"></div>
            <div class="label">${t.name}</div>
          </button>
        `).join("")}
      </div>
      <p class="tiny muted" style="margin-top:20px">${THEMES.find((t) => t.id === s.settings.theme)?.desc || ""}</p>
    </div>
  `);
}

/* ============================================================
   ACCESSIBILITY PICKER — new
   ============================================================ */
export function openA11yPicker() {
  const s = getState();
  const current = (s.settings && s.settings.a11y) || "default";
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">You</div><h2>Accessibility</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <p class="tiny muted">Adjust contrast and color intensity across every theme.</p>
      <div class="a11y-grid">
        ${A11Y_MODES.map((m) => `
          <button class="a11y-card ${current === m.id ? "active" : ""}" data-action="set-a11y" data-id="${m.id}">
            <div class="a11y-name">${esc(m.name)}</div>
            <div class="a11y-desc">${esc(m.desc)}</div>
          </button>
        `).join("")}
      </div>
    </div>
  `);
}

/* ============================================================
   TODAY LAYOUT PICKER — new
   ============================================================ */
export function openLayoutPicker() {
  const s = getState();
  const current = (s.settings && s.settings.todayLayout) || "momentum";
  const cards = [
    { id: "momentum", name: "Momentum", desc: "A ring, a streak, one clear next step." },
    { id: "precision", name: "Precision", desc: "Dense, informational, no decoration." },
    { id: "calm",      name: "Calm",      desc: "One thing at a time. Spacious." }
  ];
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">You</div><h2>Today layout</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <p class="tiny muted">Pick how your Today tab looks. Change any time.</p>
      <div class="layout-grid">
        ${cards.map((c) => `
          <button class="layout-card ${current === c.id ? "active" : ""}" data-action="set-layout" data-id="${c.id}">
            <div class="layout-preview layout-preview-${c.id}" aria-hidden="true">
              <div class="lp-row"><span></span><span></span></div>
              <div class="lp-row"><span></span><span></span><span></span></div>
              <div class="lp-row"><span></span></div>
            </div>
            <div class="layout-name">${esc(c.name)}</div>
            <div class="layout-desc">${esc(c.desc)}</div>
          </button>
        `).join("")}
      </div>
    </div>
  `);
}

/* ============================================================
   RECORDS — full trophy case
   ============================================================ */
export function openRecords() {
  const s = getState();
  const earned = (s.milestones && s.milestones.earned) || {};
  const recs = personalRecords();
  const stored = Object.fromEntries(recs.map((r) => [r.key, r]));

  const earnedCount = MILESTONE_DEFS.filter((m) => earned[m.id]).length;
  const totalCount = MILESTONE_DEFS.length;

  const recordTiles = [
    {
      key: "fastestSolve",
      icon: "zap",
      label: "Fastest solve",
      unit: "min",
      empty: "Log a solved DSA problem to set this."
    },
    {
      key: "longestStreak",
      icon: "flame",
      label: "Longest streak",
      unit: "days",
      empty: "Build a streak to set this."
    },
    {
      key: "mostActionsDay",
      icon: "trendingUp",
      label: "Best day",
      unit: "actions",
      empty: "Complete a subtask to set this."
    },
    {
      key: "bestWeek",
      icon: "trophy",
      label: "Best week",
      unit: "% delta",
      empty: "Finish a week of work to set this."
    }
  ].map((r) => {
    const v = stored[r.key];
    return `
      <div class="record-tile ${v ? "has-value" : "empty"}">
        <div class="record-icon">${icons[r.icon] || icons.trophy}</div>
        ${v ? `
          <div class="record-value">${v.value}<span class="record-unit">${esc(r.unit)}</span></div>
        ` : `<div class="record-value muted">—</div>`}
        <div class="record-label">${esc(r.label)}</div>
        ${!v ? `<div class="record-empty tiny muted">${esc(r.empty)}</div>` : ""}
      </div>
    `;
  }).join("");

  const milestonesByEarned = [...MILESTONE_DEFS]
    .sort((a, b) => {
      const ae = earned[a.id] ? 1 : 0;
      const be = earned[b.id] ? 1 : 0;
      if (ae !== be) return be - ae;
      return 0;
    });

  const milestoneRows = milestonesByEarned.map((m) => {
    const isEarned = Boolean(earned[m.id]);
    const at = earned[m.id]?.at || "";
    return `
      <div class="milestone-tile ${isEarned ? "earned" : "locked"}">
        <div class="milestone-tile-icon">
          ${isEarned ? icons.medal : icons.shield}
        </div>
        <div class="milestone-tile-copy">
          <div class="milestone-tile-title">${esc(m.title)}</div>
          <div class="milestone-tile-sub">${esc(m.subtitle || "")}</div>
          ${isEarned && at ? `<div class="milestone-tile-date tiny muted">${esc(fmtDate(at.slice(0, 10)))}</div>` : ""}
        </div>
      </div>
    `;
  }).join("");

  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">You</div><h2>Records</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <div class="records-hero">
        <div class="records-count-num">${earnedCount}</div>
        <div class="records-count-lbl">of ${totalCount} milestones earned</div>
      </div>

      <h3 class="label" style="margin:16px 0 8px">Personal bests</h3>
      <div class="records-grid">${recordTiles}</div>

      <h3 class="label" style="margin:24px 0 8px">Milestones</h3>
      <div class="milestone-tiles">${milestoneRows}</div>
    </div>
    <div class="drawer-foot">
      <button class="btn primary" data-action="close-modal">Done</button>
    </div>
  `);
}

/* ============================================================
   RECAP — full weekly recap
   ============================================================ */
export function openRecap() {
  const s = getState();
  const stats = lastWeekStats();
  const delta = stats.deltaReadiness;
  const deltaSign = delta > 0 ? "+" : "";
  const deltaClass = delta > 0 ? "up" : delta < 0 ? "down" : "";

  // Top pillars by progress
  const pillars = [...(s.pillars || [])]
    .map((p) => ({ p, prog: pillarProgress(p) }))
    .sort((a, b) => b.prog - a.prog)
    .slice(0, 3);

  const pillarRows = pillars.map(({ p, prog }) => `
    <div class="recap-pillar">
      <div class="recap-pillar-name" style="color:${p.color}">${esc(p.title)}</div>
      <div class="recap-pillar-bar"><i style="width:${prog}%; background:${p.color}"></i></div>
      <div class="recap-pillar-val">${prog}%</div>
    </div>
  `).join("");

  // Actions sparkline (7 days)
  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    days.push({ date: d, count: s.activity[k] || 0 });
  }
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const dayBars = days.map(({ date, count }) => {
    const h = Math.max(4, Math.round((count / maxCount) * 44));
    const isToday = date.toISOString().slice(0, 10) === todayISO();
    return `<div class="recap-bar-wrap">
      <div class="recap-bar ${isToday ? "today" : ""}" style="height:${h}px"></div>
      <div class="recap-bar-day">${date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1)}</div>
    </div>`;
  }).join("");

  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">Weekly recap</div><h2>This week</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <div class="recap-hero-large">
        <div class="recap-delta ${deltaClass}" style="flex-direction:column;align-items:flex-start;gap:6px">
          <span class="recap-num" style="font-size:44px">${deltaSign}${delta}%</span>
          <span class="recap-sub">readiness vs last week</span>
        </div>
      </div>

      <div class="recap-stats-large">
        <div class="recap-stat-large">
          <div class="v">${stats.actions}</div>
          <div class="k">actions</div>
        </div>
        <div class="recap-stat-large">
          <div class="v">${stats.hours.toFixed(1)}</div>
          <div class="k">hours logged</div>
        </div>
      </div>

      <h3 class="label" style="margin:20px 0 8px">Actions this week</h3>
      <div class="recap-bars">${dayBars}</div>

      ${pillarRows ? `<h3 class="label" style="margin:24px 0 8px">Top pillars</h3>` : ""}
      ${pillarRows}
    </div>
    <div class="drawer-foot">
      <button class="btn" data-action="close-modal">Close</button>
      <button class="btn primary" data-action="recap-share">Share</button>
    </div>
  `);

  // Mark as seen so the recap card stops appearing
  markRecapSeen();
  saveState();
}

/* ============================================================
   FOCUS MODE opener — new
   ============================================================ */
export function openFocusMode(goalId) {
  const s = getState();
  const { pillar, goal } = findGoal(goalId);
  if (!goal) {
    toast("No goal found");
    return;
  }
  const nextSub = nextSubtaskFor(goalId);
  openFocus({
    goalTitle: goal.t,
    pillarTitle: pillar ? pillar.title : "",
    pillarColor: pillar ? pillar.color : "var(--accent)",
    subtaskTitle: nextSub ? nextSub.title : ""
  });
}

/* ============================================================
   CUSTOMIZE
   ============================================================ */
export function openCustomize() {
  const s = getState();
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">You</div><h2>Customize</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <div class="card" style="margin-bottom:12px">
        <h3>Main goal</h3>
        <div class="field"><label class="fl">Logo</label><input id="metaLogo" value="${esc(s.meta.logo)}" /></div>
        <div class="field"><label class="fl">Title</label><input id="metaTitle" value="${esc(s.meta.title)}" /></div>
        <div class="field"><label class="fl">Main goal</label><input id="metaMain" value="${esc(s.meta.mainGoal)}" /></div>
        <div class="field"><label class="fl">Note</label><input id="metaMainNote" value="${esc(s.meta.mainGoalNote || "")}" /></div>
        <button class="btn primary block" data-action="save-meta">Save</button>
      </div>
      <div class="card" style="margin-bottom:12px">
        <h3>Daily budget</h3>
        <div class="field">
          <label class="fl">Hours per day</label>
          <input type="number" id="dailyBudget" min="0" step="0.5" value="${s.settings.dailyBudget || 3}" />
        </div>
        <button class="btn primary block" data-action="save-daily-budget">Save</button>
      </div>
      <div class="card">
        <h3>Pillars</h3>
        ${s.pillars.map((p, i) => `
          <div class="edit-row" style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
              <input value="${esc(p.title)}" data-pillar="${i}" data-f="title" />
              <input type="color" value="${p.color}" data-pillar="${i}" data-f="color" style="width:52px;min-width:52px" />
            </div>
            <input value="${esc(p.tagline || "")}" data-pillar="${i}" data-f="tagline" placeholder="Tagline" />
          </div>
        `).join("")}
      </div>
    </div>
  `);
}

/* ============================================================
   AI PROMPT
   ============================================================ */
export function openAI() {
  const html = `
    <div class="drawer-head">
      <div><div class="crumb">Setup</div><h2>Build with AI</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <div class="note-box" style="margin-bottom:16px; line-height:1.6;">
        <b>How it works:</b><br>
        1. Copy the prompt below.<br>
        2. Paste it into ChatGPT, Claude, or Gemini.<br>
        3. Fill in the bracketed <code>[FIELDS]</code>.<br>
        4. The AI replies with a JSON block.<br>
        5. Paste that JSON into the box at the bottom.
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px; flex-wrap:wrap">
        <label class="fl" style="margin:0;">Your prompt</label>
        <div style="display:flex; gap:6px;">
          <button class="btn sm" onclick="window.open('https://chatgpt.com', '_blank')">ChatGPT</button>
          <button class="btn sm" onclick="window.open('https://claude.ai', '_blank')">Claude</button>
          <button class="btn sm" data-action="copy-prompt">Copy</button>
        </div>
      </div>
      <pre id="promptPre" style="background:var(--surface-2); border:1px solid var(--border); border-radius:var(--r-sm); padding:12px; font-size:12px; font-family:var(--font-mono); white-space:pre-wrap; max-height:240px; overflow-y:auto; margin-bottom:16px; color:var(--text-2);">${esc(buildPrompt())}</pre>
      <label class="fl" for="aiJsonIn">Paste JSON reply</label>
      <textarea id="aiJsonIn" class="inp" rows="6" placeholder='{ "meta": { ... }, "pillars": [ ... ] }'></textarea>
    </div>
    <div class="drawer-foot">
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn primary" data-action="import-ai-json">Build my grid</button>
    </div>
  `;
  openModal(html);
}

export function buildPrompt() {
  return `You are a strategic planning assistant. Build me a 9×9 Success Grid.

CONTEXT:
- 1 main goal at the center.
- 8 pillars around it.
- Each pillar has exactly 8 goals.
- Each goal has 4–6 specific subtasks.
- 8 stages ring the center; Stage N maps to Pillar N.
- Monthly roadmap with concrete actions.

MY MAIN GOAL:
[INSERT YOUR MAIN GOAL HERE]

MY CONTEXT:
[INSERT YOUR CONTEXT HERE]

FIRST: ask up to 6 clarifying questions. Wait for my reply.

THEN: output ONE JSON object (no fences) in this shape:
{
  "meta": { "logo":"🎯","title":"...","subtitle":"...","mainGoal":"...","mainGoalNote":"...","flow":"..." },
  "pillars": [
    { "id":"pillar1","title":"...","short":"P1","color":"#5B8DEF","w":1.1,"tagline":"...",
      "goals":[{"id":"g1_1","t":"...","d":"...","p":"High","td":"YYYY-MM-DD","st":["...","..."],"seed":0}] }
  ],
  "stages": [{"name":"STAGE 1","src":["pillar1"],"desc":"..."}],
  "roadmap": [{"m":"Month 1","focus":"...","items":["...","..."]}]
}

RULES: exactly 8 pillars, 8 goals each, 4–6 subtasks per goal, 8 stages (Stage N → pillarN), colors from #5B8DEF #8E4EC6 #06B6D4 #14B8A6 #F59E0B #EC4899 #30A46C #6366F1, priorities High/Medium/Low, td YYYY-MM-DD. No markdown. Just JSON.`;
}

/* ============================================================
   COMING SOON
   ============================================================ */
export function openComingSoon(title, blurb) {
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">You</div><h2>${esc(title)}</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <div class="empty" style="padding:40px 20px">${esc(title)} coming soon.<br><br><span class="tiny">${esc(blurb || "")}</span></div>
    </div>
  `);
}

/* ============================================================
   GENERIC INPUT MODAL
   ============================================================ */
let _inputModalCallback = null;

export function openInputModal(title, opts = {}, onSave) {
  const value = opts.value ?? "";
  const html = `
    <div class="drawer-head">
      <div><div class="crumb">${esc(opts.crumb || "Input")}</div><h2>${esc(title)}</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <div class="field">
        ${opts.label ? `<label class="fl" for="inputModalField">${esc(opts.label)}</label>` : ""}
        <input
          id="inputModalField"
          class="inp"
          type="${opts.type || "text"}"
          inputmode="${opts.inputMode || "text"}"
          placeholder="${esc(opts.placeholder || "")}"
          value="${esc(value)}"
        />
      </div>
    </div>
    ${modalFoot(opts.saveLabel || "Save", "input-modal-save")}
  `;
  _inputModalCallback = typeof onSave === "function" ? onSave : null;
  openModal(html, { onClose: () => { _inputModalCallback = null; } });
  setTimeout(() => {
    /** @type {HTMLInputElement | null} */
    const inp = /** @type {any} */ (document.getElementById("inputModalField"));
    if (inp) { inp.focus(); inp.select(); }
  }, 120);
}

export function readInputModalValue() {
  /** @type {HTMLInputElement | null} */
  const inp = /** @type {any} */ (document.getElementById("inputModalField"));
  return inp ? inp.value.trim() : "";
}

export function getInputModalCallback() {
  return _inputModalCallback;
}

/* ============================================================
   GLOBAL SEARCH
   ============================================================ */
function searchAll(query) {
  const s = getState();
  const q = query.trim().toLowerCase();
  if (!q) return { goals: [], projects: [], apps: [], dsa: [] };

  const goals = [];
  s.pillars.forEach((p) => {
    (p.goals || []).forEach((g) => {
      const haystack = `${g.t} ${g.d || ""} ${p.title}`.toLowerCase();
      if (haystack.includes(q)) goals.push({ goal: g, pillar: p });
    });
  });

  const projects = (s.projects || []).filter((p) =>
    `${p.name} ${p.desc || ""} ${p.stack || ""}`.toLowerCase().includes(q)
  );

  const apps = (s.applications || []).filter((a) =>
    `${a.company || ""} ${a.role || ""} ${a.status || ""}`.toLowerCase().includes(q)
  );

  const dsa = (s.dsa?.problems || []).filter((p) =>
    `${p.name} ${p.topic || ""}`.toLowerCase().includes(q)
  );

  return { goals, projects, apps, dsa };
}

export function renderSearchResults(query) {
  const q = query.trim();
  if (!q) {
    return `<p class="tiny muted" style="text-align:center; padding:24px 12px; line-height:1.5">Search across goals, projects, applications, and DSA problems.</p>`;
  }

  const r = searchAll(query);
  const total = r.goals.length + r.projects.length + r.apps.length + r.dsa.length;

  if (total === 0) {
    return `<p class="tiny muted" style="text-align:center; padding:24px 12px">No results for "<b>${esc(q)}</b>"</p>`;
  }

  const sections = [];

  if (r.goals.length) {
    sections.push(`
      <div class="more-group-label" style="padding-top:12px">Goals · ${r.goals.length}</div>
      <div class="more-list" style="margin-bottom:12px">
        ${r.goals.slice(0, 12).map(({ goal, pillar }) => `
          <button class="search-result" data-action="search-open-goal" data-id="${goal.id}">
            <div class="search-result-icon" style="color:${pillar.color}">${icons.target}</div>
            <div class="search-result-info">
              <div class="search-result-title">${esc(goal.t)}</div>
              <div class="search-result-sub">${esc(pillar.title)}</div>
            </div>
          </button>
        `).join("")}
      </div>
    `);
  }

  if (r.projects.length) {
    sections.push(`
      <div class="more-group-label">Projects · ${r.projects.length}</div>
      <div class="more-list" style="margin-bottom:12px">
        ${r.projects.slice(0, 6).map((p) => `
          <button class="search-result" data-action="search-open-project" data-id="${p.id}">
            <div class="search-result-icon">${icons.folder}</div>
            <div class="search-result-info">
              <div class="search-result-title">${esc(p.name)}</div>
              <div class="search-result-sub">${esc(p.status || "Project")}</div>
            </div>
          </button>
        `).join("")}
      </div>
    `);
  }

  if (r.apps.length) {
    sections.push(`
      <div class="more-group-label">Applications · ${r.apps.length}</div>
      <div class="more-list" style="margin-bottom:12px">
        ${r.apps.slice(0, 6).map((a) => `
          <button class="search-result" data-action="search-open-app" data-id="${a.id}">
            <div class="search-result-icon">${icons.send}</div>
            <div class="search-result-info">
              <div class="search-result-title">${esc(a.company || "Untitled")}</div>
              <div class="search-result-sub">${esc(a.role || "")}${a.status ? ` · ${esc(a.status)}` : ""}</div>
            </div>
          </button>
        `).join("")}
      </div>
    `);
  }

  if (r.dsa.length) {
    sections.push(`
      <div class="more-group-label">DSA problems · ${r.dsa.length}</div>
      <div class="more-list" style="margin-bottom:12px">
        ${r.dsa.slice(0, 6).map((p) => `
          <button class="search-result" data-action="search-open-dsa" data-id="${p.id}">
            <div class="search-result-icon">${icons.code}</div>
            <div class="search-result-info">
              <div class="search-result-title">${esc(p.name)}</div>
              <div class="search-result-sub">${esc(p.topic || "")}${p.difficulty ? ` · ${esc(p.difficulty)}` : ""}</div>
            </div>
          </button>
        `).join("")}
      </div>
    `);
  }

  return sections.join("");
}

export function openSearch() {
  const html = `
    <div class="drawer-head">
      <div><div class="crumb">Search</div><h2>Find anything</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body" style="padding-top:12px">
      <input
        id="searchInput"
        class="inp"
        type="search"
        placeholder="Search goals, projects, applications, DSA…"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
      />
      <div id="searchResults" style="margin-top:8px">
        ${renderSearchResults("")}
      </div>
    </div>
  `;
  openModal(html);
  setTimeout(() => {
    /** @type {HTMLInputElement | null} */
    const inp = /** @type {any} */ (document.getElementById("searchInput"));
    if (inp) inp.focus();
  }, 150);
}

/* ============================================================
   COMMAND PALETTE — Cmd/Ctrl+K
   ============================================================ */
export function openCommandPalette() {
  const commands = [
    {
      icon: icons.home,
      label: "Go to Today",
      hint: "T",
      action: () => document.dispatchEvent(new CustomEvent("cmd:goto-tab", { detail: "today" }))
    },
    {
      icon: icons.grid,
      label: "Go to Grid",
      hint: "G",
      action: () => document.dispatchEvent(new CustomEvent("cmd:goto-tab", { detail: "grid" }))
    },
    {
      icon: icons.calendar,
      label: "Go to Plan",
      hint: "P",
      action: () => document.dispatchEvent(new CustomEvent("cmd:goto-tab", { detail: "plan" }))
    },
    {
      icon: icons.user,
      label: "Go to You",
      hint: "Y",
      action: () => document.dispatchEvent(new CustomEvent("cmd:goto-tab", { detail: "more" }))
    },
    {
      icon: icons.search,
      label: "Search everything",
      hint: "/",
      action: () => openSearch()
    },
    {
      icon: icons.target,
      label: "Quick add",
      hint: "N",
      action: () => openQuickAdd()
    },
    {
      icon: icons.palette,
      label: "Change theme",
      action: () => openThemePicker()
    },
    {
      icon: icons.sliders,
      label: "Change Today layout",
      action: () => openLayoutPicker()
    },
    {
      icon: icons.eye,
      label: "Accessibility options",
      action: () => openA11yPicker()
    },
    {
      icon: icons.trophy,
      label: "View records & milestones",
      action: () => openRecords()
    },
    {
      icon: icons.wand,
      label: "Build with AI",
      action: () => openAI()
    },
    {
      icon: icons.folder,
      label: "Open projects",
      action: () => openProjects()
    },
    {
      icon: icons.send,
      label: "Open applications",
      action: () => openApps()
    },
    {
      icon: icons.code,
      label: "Open DSA tracker",
      action: () => document.dispatchEvent(new CustomEvent("cmd:goto-tab", { detail: "dsa" }))
    },
    {
      icon: icons.dumbbell,
      label: "Open workout log",
      action: () => document.dispatchEvent(new CustomEvent("cmd:goto-tab", { detail: "workouts" }))
    },
    {
      icon: icons.download,
      label: "Export data as JSON",
      action: () => document.dispatchEvent(new CustomEvent("cmd:export"))
    },
    {
      icon: icons.upload,
      label: "Import data from JSON",
      action: () => document.dispatchEvent(new CustomEvent("cmd:import"))
    }
  ];

  openCommand({ commands, placeholder: "Type a command…" });
}

/* ============================================================
   QUICK ADD FAB — context-aware
   ============================================================ */
export function openQuickAdd() {
  const s = getState();
  const goalType = s.user?.goalType || "career";

  const actions = [];

  actions.push({
    action: "fab-log-time",
    icon: "clock",
    label: "Log time",
    sub: "Add 0.5h to today"
  });

  if (goalType === "career" || goalType === "other") {
    actions.push({ action: "fab-log-dsa",     icon: "code",     label: "Log problem",     sub: "DSA tracker" });
    actions.push({ action: "fab-add-project", icon: "folder",   label: "Add project",     sub: "Portfolio" });
    actions.push({ action: "fab-add-app",     icon: "send",     label: "Add application", sub: "Job search" });
  }

  if (goalType === "fitness" || goalType === "other") {
    actions.push({ action: "fab-log-workout", icon: "dumbbell", label: "Start workout",   sub: "Log a session" });
    actions.push({ action: "fab-log-weight",  icon: "scale",    label: "Log weight",      sub: "Track progress" });
  }

  const html = `
    <div class="drawer-head">
      <div><div class="crumb">Quick add</div><h2>What are you logging?</h2></div>
      <button class="x-btn" data-action="close-modal" aria-label="Close">×</button>
    </div>
    <div class="drawer-body">
      <div class="fab-sheet">
        ${actions.map((a) => `
          <button class="fab-action" data-action="${a.action}">
            <div class="fab-action-icon">${icons[a.icon] || icons.plus}</div>
            <div>
              <div class="fab-action-label">${esc(a.label)}</div>
              <div class="fab-action-sub">${esc(a.sub)}</div>
            </div>
          </button>
        `).join("")}
      </div>
    </div>
  `;
  openModal(html);
}

/* ============================================================
   MILESTONE & RECORD HELPERS — called from app.js
   ============================================================ */
export function showNewMilestones(milestones) {
  if (!milestones || !milestones.length) return;
  // Show one at a time; queue handled by app.js (cooldown)
  const m = milestones[0];
  import("./ui.js").then(({ openMilestone }) => {
    openMilestone({
      icon: icons.medal,
      kicker: m.kicker,
      title: m.title,
      subtitle: m.subtitle,
      cta: "Nice"
    });
  });
}

export function showNewRecords(records) {
  if (!records || !records.length) return;
  const r = records.find((x) => !x.silent);
  if (!r) return;
  import("./ui.js").then(({ openMilestone }) => {
    openMilestone({
      icon: icons.trophy,
      kicker: "NEW PERSONAL BEST",
      title: `${r.label}: ${r.next} ${r.unit}`,
      subtitle: r.prev != null ? `Previous: ${r.prev} ${r.unit}` : "",
      cta: "Nice"
    });
  });
}

/* ============================================================
   INTERNAL RE-EXPORTS for app.js convenience
   ============================================================ */
export { renderStatsPanel };