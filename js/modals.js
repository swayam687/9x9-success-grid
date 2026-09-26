import { $, esc, clamp, todayISO, uid, fmtDate, toast } from "./utils.js";
import {
  getState, saveState, findGoal, effectiveProgress, pillarProgress, stageProgress,
  DEFAULT_TEMPLATES, DSA_TOPICS, DSA_DIFFICULTIES, DSA_STATUSES,
  PILLAR_COLORS, STAGE_NAMES
} from "./state.js";
import { openModal, closeModal, THEMES, applyTheme } from "./ui.js";
import { renderDsa, renderWorkouts, renderWeight } from "./views.js";

function priLetter(p){ return p === "High" ? "H" : p === "Medium" ? "M" : "L"; }
function priColor(p){ return p === "High" ? "var(--red)" : p === "Medium" ? "var(--amber)" : "var(--text-3)"; }

/* ============================================================
   GOAL
   ============================================================ */
export function openGoal(id, opts = {}){
  const s = getState();
  const { pillar, goal } = findGoal(id);
  if (!goal) return;
  const st = s.goals[id] || { progress:0, status:"Not Started", priority:"Medium", targetDate:"", notes:"", autoSync:false, subtasks:[] };
  const prog = effectiveProgress(id);
  const statusCls = st.status === "Completed" ? "cp" : st.status === "In Progress" ? "ip" : st.status === "Needs Review" ? "nr" : "ns";
  const days = (function(dstr){
    if (!dstr) return null;
    const dd = new Date(dstr);
    if (isNaN(dd.getTime())) return null;
    const a = dd.setHours(0,0,0,0);
    const b = new Date().setHours(0,0,0,0);
    return Math.round((a - b) / 86400000);
  })(st.targetDate);
  const dueTxt = days == null ? "" : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days} days left`;

  openModal(`
    <div class="drawer-head">
      <div style="min-width:0">
        <div class="crumb" style="color:${pillar.color}">${esc(pillar.title)}</div>
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

      <div class="note-box">
        Priority: <span class="pri ${priLetter(st.priority)}">${priLetter(st.priority)}</span>
        <b style="color:${priColor(st.priority)}">${esc(st.priority)}</b>
        ${st.autoSync ? ' · <b>Auto-synced from subtasks</b>' : ""}
      </div>

      <div class="field">
        <label class="fl">PROGRESS</label>
        <div class="slider-row">
          <input type="range" min="0" max="100" value="${prog}" data-goal-progress ${st.autoSync ? "disabled" : ""} />
          <span style="font-size:20px;font-weight:800;color:var(--accent);min-width:60px;text-align:right" id="goalPct">${prog}%</span>
        </div>
      </div>

      <div class="grid2 field">
        <div><label class="fl">STATUS</label>
          <select data-goal-status>
            ${["Not Started","In Progress","Completed","Needs Review"].map(v => `<option${st.status === v ? " selected" : ""}>${v}</option>`).join("")}
          </select></div>
        <div><label class="fl">PRIORITY</label>
          <select data-goal-priority>
            ${["High","Medium","Low"].map(v => `<option${st.priority === v ? " selected" : ""}>${v}</option>`).join("")}
          </select></div>
      </div>

      <div class="field">
        <label class="fl">TARGET DATE</label>
        <input type="date" value="${esc(st.targetDate || "")}" data-goal-date />
      </div>

      <div class="field">
        <label class="fl">SUBTASKS ${st.subtasks.filter(x => x.done).length}/${st.subtasks.length}</label>
        <div class="subtasks">
          ${st.subtasks.length ? st.subtasks.map(x => `
            <div class="subtask">
              <input type="checkbox" ${x.done ? "checked" : ""} data-action="toggle-subtask" data-id="${x.id}" />
              <span class="${x.done ? "done" : ""}">${esc(x.title)}</span>
              <button class="del" data-action="del-subtask" data-id="${x.id}">×</button>
            </div>
          `).join("") : `<p class="tiny muted" style="margin:0">No subtasks yet.</p>`}
        </div>
        <label class="tl-item tiny" style="padding:10px 12px;background:var(--surface-2);border-radius:10px">
          <input type="checkbox" ${st.autoSync ? "checked" : ""} data-goal-sync />
          <span>Auto-sync progress from subtasks</span>
        </label>
      </div>

      <div class="field">
        <label class="fl">NOTES</label>
        <textarea data-goal-notes placeholder="What did you learn? What is blocking you?">${esc(st.notes)}</textarea>
      </div>
    </div>
    <div class="drawer-foot" style="justify-content:stretch">
      <input type="text" placeholder="Add a subtask…" id="newSubtask" style="flex:1" />
      <button class="btn primary" data-action="add-subtask" data-id="${id}">Add</button>
    </div>
  `, { onClose: opts.onClose });

  // ← NEW: store goal id on the drawer so input handlers can find it
  const drawer = document.querySelector(".drawer");
  if (drawer) drawer.dataset.goalId = id;

  if (opts.focus) setTimeout(() => $("#newSubtask")?.focus({ preventScroll:true }), 250);
}

/* ============================================================
   PILLAR
   ============================================================ */
export function openPillar(id){
  const s = getState();
  const p = s.pillars.find(x => x.id === id);
  if (!p) return;
  const avg = pillarProgress(p);
  const LOCAL_ORDER = [[0,0],[0,1],[0,2],[1,0],[1,2],[2,0],[2,1],[2,2]];
  const cells = [];
  for (let r=0; r<3; r++){
    for (let c=0; c<3; c++){
      if (r === 1 && c === 1){
        cells.push(`<div class="goal center" style="--pc:${p.color}">
          <div class="gtitle">${esc(p.title)}</div>
          <div class="gfoot">${avg}%</div>
        </div>`);
      } else {
        const li = LOCAL_ORDER.findIndex(([a,b]) => a === r && b === c);
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
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb" style="color:${p.color}">Pillar</div><h2>${esc(p.title)}</h2></div>
      <button class="x-btn" data-action="close-modal">×</button>
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
export function openStages(){
  const s = getState();
  const stageRows = s.stages.map((st, i) => {
    const p = s.pillars.find(x => x.id === st.src[0]);
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
      <button class="x-btn" data-action="close-modal">×</button>
    </div>
    <div class="drawer-body">${stageRows}</div>
    <div class="drawer-foot"><button class="btn primary" data-action="close-modal">Close</button></div>
  `);
}

/* ============================================================
   PROJECTS
   ============================================================ */
export function openProjects(){
  const s = getState();
  const rows = s.projects.length ? s.projects.map(p => `
    <div class="proj">
      <div class="spread">
        <h4>${esc(p.name)}</h4>
        <div class="row">
          <button class="btn sm" data-action="edit-project" data-id="${p.id}">Edit</button>
          <button class="btn sm danger" data-action="del-project" data-id="${p.id}">×</button>
        </div>
      </div>
      <p class="tiny muted">${esc(p.desc || "")}</p>
      <div>${(p.stack || "").split(",").map(x => x.trim()).filter(Boolean).map(x => `<span class="tag">${esc(x)}</span>`).join("")}</div>
      <div class="kv"><span>Status <b>${esc(p.status || "")}</b></span><span>Progress <b>${p.progress || 0}%</b></span></div>
    </div>
  `).join("") : `<div class="empty">No projects yet.</div>`;
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">More</div><h2>Projects</h2></div>
      <button class="x-btn" data-action="close-modal">×</button>
    </div>
    <div class="drawer-body">
      ${rows}
      <button class="btn primary block" data-action="add-project" style="margin-top:14px">+ Add project</button>
    </div>
  `);
}

export function openProjectModal(id){
  const s = getState();
  const p = id ? s.projects.find(x => x.id === id) : null;
  const v = p || { name:"", desc:"", stack:"", github:"", live:"", status:"Not Started", progress:0, notes:"" };
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">Projects</div><h2>${p ? "Edit" : "Add"} project</h2></div>
      <button class="x-btn" data-action="close-modal">×</button>
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
          <select id="pStatus">${["Not Started","In Progress","Completed","Paused"].map(x => `<option${v.status === x ? " selected" : ""}>${x}</option>`).join("")}</select>
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
export function openApps(){
  const s = getState();
  const rows = s.applications.length ? s.applications.map(a => `
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
  `).join("") : `<div class="empty">No applications yet.</div>`;
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">More</div><h2>Applications</h2></div>
      <button class="x-btn" data-action="close-modal">×</button>
    </div>
    <div class="drawer-body">
      ${rows}
      <button class="btn primary block" data-action="add-app" style="margin-top:14px">+ Add application</button>
    </div>
  `);
}

export function openAppModal(){
  const statuses = ["Saved","Preparing","Applied","Assessment","Interview","Rejected","Offer","Withdrawn"];
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">Applications</div><h2>Add application</h2></div>
      <button class="x-btn" data-action="close-modal">×</button>
    </div>
    <div class="drawer-body">
      <div class="field"><label class="fl">Company</label><input id="aCompany" /></div>
      <div class="field"><label class="fl">Role</label><input id="aRole" /></div>
      <div class="grid2 field">
        <div><label class="fl">Status</label>
          <select id="aStatus">${statuses.map(x => `<option>${x}</option>`).join("")}</select>
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
export function openDsaLog(){
  const s = getState();
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">DSA Tracker</div><h2>Log a problem</h2></div>
      <button class="x-btn" data-action="close-modal">×</button>
    </div>
    <div class="drawer-body">
      <div class="field"><label class="fl">Problem name</label><input id="dName" placeholder="e.g. Two Sum" /></div>
      <div class="grid2 field">
        <div><label class="fl">Topic</label>
          <select id="dTopic">${DSA_TOPICS.map(x => `<option>${x}</option>`).join("")}</select>
        </div>
        <div><label class="fl">Difficulty</label>
          <select id="dDifficulty">${DSA_DIFFICULTIES.map(x => `<option>${x}</option>`).join("")}</select>
        </div>
      </div>
      <div class="grid2 field">
        <div><label class="fl">Time (min)</label><input type="number" id="dTime" value="30" min="1" /></div>
        <div><label class="fl">Status</label>
          <select id="dStatus">${DSA_STATUSES.map(x => `<option>${x}</option>`).join("")}</select>
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

export function openDsaTargets(){
  const s = getState();
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">DSA Tracker</div><h2>Edit targets</h2></div>
      <button class="x-btn" data-action="close-modal">×</button>
    </div>
    <div class="drawer-body">
      ${DSA_TOPICS.map(t => `
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
export function openWorkoutSession(templateId){
  const s = getState();
  let template = null;
  if (templateId){
    template = [...DEFAULT_TEMPLATES, ...s.workouts.customTemplates].find(x => x.id === templateId);
  }
  const exercises = template ? template.exercises.map(e => ({ ...e, done:false })) : [];
  const sessionName = template ? template.name : "Freeform session";

  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">Workout</div><h2>${esc(sessionName)}</h2></div>
      <button class="x-btn" data-action="close-modal">×</button>
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

export function wsExerciseRow(e, i){
  return `<div class="subtask" style="flex-wrap:wrap; padding:10px" data-ws-row="${i}">
    <input type="text" value="${esc(e.name)}" placeholder="Exercise" data-ws-name style="flex:1; min-width:120px" />
    <input type="number" value="${e.sets || 3}" min="1" data-ws-sets style="width:56px" placeholder="Sets" />
    <span class="muted tiny">×</span>
    <input type="number" value="${e.reps || 8}" min="1" data-ws-reps style="width:56px" placeholder="Reps" />
    <input type="number" value="${e.weight || 0}" min="0" step="0.5" data-ws-weight style="width:70px" placeholder="kg" />
    <button class="del" data-action="ws-rm-exercise" data-i="${i}">×</button>
  </div>`;
}

export function openWorkoutTemplateEditor(templateId){
  const s = getState();
  let template = null;
  if (templateId){
    template = [...DEFAULT_TEMPLATES, ...s.workouts.customTemplates].find(x => x.id === templateId);
  }
  const isDefault = template && DEFAULT_TEMPLATES.some(d => d.id === template.id);
  const exercises = template ? template.exercises : [{ name:"", sets:3, reps:8, weight:0 }];

  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">Workout</div><h2>${template ? "Edit" : "New"} template</h2></div>
      <button class="x-btn" data-action="close-modal">×</button>
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
      <button class="btn primary" data-action="wt-save">Save</button>
    </div>
  `);
}

/* ============================================================
   WEIGHT
   ============================================================ */
export function openWeightLog(){
  const s = getState();
  const stats = (function(){
    const entries = [...s.weight.entries].sort((a,b) => a.date.localeCompare(b.date));
    const latest = entries[entries.length - 1];
    return { current: latest ? latest.weight : null };
  })();
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">Weight</div><h2>Log weight</h2></div>
      <button class="x-btn" data-action="close-modal">×</button>
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
   THEME PICKER
   ============================================================ */
export function openThemePicker(){
  const s = getState();
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">More</div><h2>Theme</h2></div>
      <button class="x-btn" data-action="close-modal">×</button>
    </div>
    <div class="drawer-body">
      <p class="tiny muted">Choose a look. All three are dark-mode optimized.</p>
      <div class="theme-grid">
        ${THEMES.map(t => `
          <button class="theme-card ${s.settings.theme === t.id ? "active" : ""}" data-action="set-theme" data-id="${t.id}">
            <div class="swatch"></div>
            <div class="label">${t.name}</div>
          </button>
        `).join("")}
      </div>
      <p class="tiny muted" style="margin-top:20px">${THEMES.find(t => t.id === s.settings.theme)?.desc || ""}</p>
    </div>
  `);
}

/* ============================================================
   CUSTOMIZE
   ============================================================ */
export function openCustomize(){
  const s = getState();
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">More</div><h2>Customize</h2></div>
      <button class="x-btn" data-action="close-modal">×</button>
    </div>
    <div class="drawer-body">
      <div class="card" style="margin-bottom:12px">
        <h3>MAIN GOAL</h3>
        <div class="field"><label class="fl">Logo</label><input id="metaLogo" value="${esc(s.meta.logo)}" /></div>
        <div class="field"><label class="fl">Title</label><input id="metaTitle" value="${esc(s.meta.title)}" /></div>
        <div class="field"><label class="fl">Main goal</label><input id="metaMain" value="${esc(s.meta.mainGoal)}" /></div>
        <div class="field"><label class="fl">Note</label><input id="metaMainNote" value="${esc(s.meta.mainGoalNote || "")}" /></div>
        <button class="btn primary block" data-action="save-meta">Save</button>
      </div>
      <div class="card" style="margin-bottom:12px">
        <h3>DAILY BUDGET</h3>
        <div class="field">
          <label class="fl">Hours per day</label>
          <input type="number" id="dailyBudget" min="0" step="0.5" value="${s.settings.dailyBudget || 3}" />
        </div>
        <button class="btn primary block" data-action="save-daily-budget">Save</button>
      </div>
      <div class="card">
        <h3>PILLARS</h3>
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
export function openAI(){
  const s = getState();
  const p = s.aiPrompt;
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">Setup</div><h2>Build with AI</h2></div>
      <button class="x-btn" data-action="close-modal">×</button>
    </div>
    <div class="drawer-body">
      <p class="tiny muted">Fill in details, copy prompt, paste into ChatGPT/Claude/Gemini, then paste the JSON back here.</p>

      <div class="field"><label class="fl">Main goal</label><input id="aiMainGoal" value="${esc(p.mainGoal || "")}" /></div>
      <div class="grid2 field">
        <div><label class="fl">Skill level</label><input id="aiSkill" value="${esc(p.skillLevel || "")}" /></div>
        <div><label class="fl">Time/day</label><input id="aiTime" value="${esc(p.timeAvailable || "")}" /></div>
      </div>
      <div class="grid2 field">
        <div><label class="fl">Deadline</label><input id="aiDeadline" value="${esc(p.deadline || "")}" /></div>
        <div><label class="fl">Constraints</label><input id="aiConstraints" value="${esc(p.constraints || "")}" /></div>
      </div>

      <div style="background:#0a0e14;border:1px solid var(--border-2);border-radius:12px;overflow:hidden;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--surface-2);border-bottom:1px solid var(--border)">
          <span style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:.04em">YOUR PROMPT</span>
          <button class="btn sm primary" data-action="copy-prompt">Copy</button>
        </div>
        <pre id="promptPre" style="margin:0;padding:14px;color:#e6edf3;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;max-height:240px;overflow-y:auto">${esc(buildPrompt(p))}</pre>
      </div>

      <div class="field">
        <label class="fl">Paste JSON reply</label>
        <textarea id="aiJsonIn" rows="6" placeholder='{ "meta": { ... }, "pillars": [...] }'></textarea>
      </div>
      <button class="btn primary block" data-action="import-ai-json">Build my grid</button>
    </div>
  `);
}

export function buildPrompt(p){
  const mg = (p.mainGoal || "").trim() || "[your main goal]";
  const ctx = [
    p.skillLevel && `- Skill level: ${p.skillLevel}`,
    p.timeAvailable && `- Time/day: ${p.timeAvailable}`,
    p.deadline && `- Deadline: ${p.deadline}`,
    p.constraints && `- Constraints: ${p.constraints}`
  ].filter(Boolean).join("\n") || "- (fill in your context)";
  return `You are a strategic planning assistant. Build me a 9×9 Success Grid.

CONTEXT:
- 1 main goal at the center.
- 8 pillars around it.
- Each pillar has exactly 8 goals.
- Each goal has 4–6 specific subtasks.
- 8 stages ring the center; Stage N maps to Pillar N.
- Monthly roadmap with concrete actions.

MY MAIN GOAL:
${mg}

MY CONTEXT:
${ctx}

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
export function openComingSoon(title, blurb){
  openModal(`
    <div class="drawer-head">
      <div><div class="crumb">More</div><h2>${esc(title)}</h2></div>
      <button class="x-btn" data-action="close-modal">×</button>
    </div>
    <div class="drawer-body">
      <div class="empty" style="padding:40px 20px">${esc(title)} coming soon.<br><br><span class="tiny">${esc(blurb || "")}</span></div>
    </div>
  `);
}