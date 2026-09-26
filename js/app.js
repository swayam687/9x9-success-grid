import { $, $$, esc, clamp, todayISO, uid, toast, vibrate } from "./utils.js";
import {
  getState, setState, loadState, saveState, saveStateNow, defaultState, normalize,
  findGoal, effectiveProgress, pillarProgress, nextSubtaskFor, logActivity,
  DEFAULT_MAIN_GOAL, DEFAULT_TEMPLATES, DSA_TOPICS
} from "./state.js";
import { applyTheme, celebrate, openModal, closeModal, isModalOpen, THEMES } from "./ui.js";
import {
  renderToday, renderGrid, renderPlan, renderTrack, renderMore,
  renderDsa, renderWorkouts, renderWeight
} from "./views.js";
import {
  openGoal, openPillar, openStages, openProjects, openProjectModal,
  openApps, openAppModal, openDsaLog, openDsaTargets,
  openWorkoutSession, openWorkoutTemplateEditor, openWeightLog,
  openThemePicker, openCustomize, openAI, buildPrompt, openComingSoon,
  wsExerciseRow
} from "./modals.js";

/* ============================================================
   APP STATE (view-local)
   ============================================================ */
let activeTab = "today";
let goalViewMode = "map";
let onboardingIndex = 0;
let lastRenderDate = todayISO();

/* ============================================================
   RENDER
   ============================================================ */
function renderTabs(){
  $$("#tabbar .tab").forEach(btn => {
    const id = btn.dataset.tab;
    const isActive = id === activeTab ||
      (["dsa","workouts","weight"].includes(activeTab) && id === "more");
    btn.classList.toggle("active", isActive);
  });
}

function renderView(){
  const s = getState();
  const v = $("#view");
  if (activeTab === "today") v.innerHTML = renderToday(s);
  else if (activeTab === "grid") v.innerHTML = renderGrid(s, goalViewMode);
  else if (activeTab === "plan") v.innerHTML = renderPlan(s);
  else if (activeTab === "track") v.innerHTML = renderTrack(s);
  else if (activeTab === "more") v.innerHTML = renderMore(s);
  else if (activeTab === "dsa") v.innerHTML = renderDsa(s);
  else if (activeTab === "workouts") v.innerHTML = renderWorkouts(s);
  else if (activeTab === "weight") v.innerHTML = renderWeight(s);
}

function render(){
  const s = getState();
  applyTheme(s.settings.theme);
  const le = $("#logoEmoji"); if (le) le.textContent = s.meta.logo || "🎯";
  const at = $("#appTitle"); if (at) at.textContent = s.meta.title || "Success Grid";
  document.title = s.meta.title || "Success Grid";
  renderTabs();
  renderView();
  lastRenderDate = todayISO();
}

function refresh(){
  saveState();
  renderTabs();
  if (!isModalOpen()) renderView();
}

/* ============================================================
   ONBOARDING
   ============================================================ */
const CAPTIONS = [
  "One goal at the center.",
  "Eight pillars around it.",
  "Sixty-four small steps.",
  "Progress fills up like a water bottle.",
  "Every pillar you finish moves the goal."
];

let captionTimer = null;
function startCaptionRotation(){
  const el = document.getElementById("onbCaption");
  if (!el) return;
  let i = 0;
  clearInterval(captionTimer);
  captionTimer = setInterval(() => {
    i = (i + 1) % CAPTIONS.length;
    el.style.opacity = "0";
    setTimeout(() => {
      el.textContent = CAPTIONS[i];
      el.style.opacity = "1";
    }, 300);
  }, 3000);
}

function showOnboarding(){
  $("#onboarding").hidden = false;
  $("#app").hidden = true;
  onboardingIndex = 0;
  updateOnb();
  startCaptionRotation();
}
function updateOnb(){
  $$(".onb-slide").forEach((el, i) => el.hidden = i !== onboardingIndex);
}
function finishOnboarding(mode){
  const name = $("#onbName").value.trim() || "friend";
  const goal = $("#onbGoal").value.trim();
  const goalType = $("#onbType .on")?.dataset.type || "career";

  const existing = getState();
  const hadData = existing && existing.meta && existing.meta.mainGoal &&
    existing.meta.mainGoal !== DEFAULT_MAIN_GOAL &&
    existing.meta.mainGoal !== "🎯 Achieve Your Main Goal";

  if (hadData){
    existing.user = { name, goalType, onboarded: true };
    if (goal) existing.meta.mainGoal = goal;
    setState(existing);
  } else {
    setState(defaultState(name, goal, goalType));
  }
  saveState();
  clearInterval(captionTimer);
  $("#onboarding").hidden = true;
  $("#app").hidden = false;
  activeTab = "today";
  render();
  if (mode === "ai") setTimeout(() => openAI(), 350);
}

/* ============================================================
   QUICK HELPERS
   ============================================================ */
function checkGoalCompletion(id){
  const s = getState();
  const g = s.goals[id];
  if (!g) return false;
  const was = g.status === "Completed" || g.progress >= 100;
  const isNow = g.progress >= 100 || g.status === "Completed";
  return !was && isNow;
}
function checkPillarCompletion(pillarId){
  const s = getState();
  const p = s.pillars.find(x => x.id === pillarId);
  if (!p) return false;
  return p.goals.every(g => {
    const st = s.goals[g.id];
    return st && (st.status === "Completed" || effectiveProgress(g.id) >= 100);
  });
}

/* ============================================================
   CLICK HANDLING
   ============================================================ */
document.addEventListener("click", e => {
  // Onboarding
  const onbBtn = e.target.closest("[data-onb]");
  if (onbBtn){
    const act = onbBtn.dataset.onb;
    if (act === "next"){
      if (onboardingIndex === 1 && !$("#onbName").value.trim()){
        toast("Please enter a name"); return;
      }
      onboardingIndex = Math.min(2, onboardingIndex + 1);
      updateOnb();
      return;
    }
    if (act === "build-ai"){ finishOnboarding("ai"); return; }
    if (act === "build-blank"){ finishOnboarding("blank"); return; }
  }

  const typ = e.target.closest("#onbType button");
  if (typ){
    $$("#onbType button").forEach(b => b.classList.remove("on"));
    typ.classList.add("on");
    return;
  }

  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;
  const s = getState();

  switch (action){
    case "goto-tab": activeTab = id; render(); break;

    case "close-modal": closeModal(); break;

    case "open-goal": e.stopPropagation(); openGoal(id, { focus:true }); break;
    case "open-pillar": e.stopPropagation(); openPillar(id); break;
    case "open-stages": openStages(); break;
    case "open-stage": {
      const st = s.stages[+id];
      if (!st) break;
      const p = s.pillars.find(x => x.id === st.src[0]);
      if (p) openPillar(p.id);
      break;
    }
    case "grid-mode": goalViewMode = id; renderView(); break;

    case "quick-check": {
      e.stopPropagation();
      const sub = nextSubtaskFor(id);
      if (!sub){ toast("Already complete"); return; }
      sub.done = true;
      const g = s.goals[id];
      g.progress = Math.round(g.subtasks.filter(x => x.done).length / g.subtasks.length * 100);
      if (g.progress >= 100) g.status = "Completed";
      else if (g.status === "Not Started") g.status = "In Progress";
      logActivity();

      // which pillar owns this goal?
      const { pillar } = findGoal(id);
      const pillarDone = pillar && checkPillarCompletion(pillar.id);

      refresh();
      if (pillarDone){ celebrate("huge"); toast("Pillar complete"); }
      else if (g.progress >= 100){ celebrate("small"); toast("Goal complete!"); }
      else { vibrate(10); toast(sub.title.slice(0, 40)); }
      break;
    }

    case "log-time": {
      const k = todayISO();
      s.settings.dailyLogged[k] = (+s.settings.dailyLogged[k] || 0) + (+id);
      logActivity(); refresh();
      toast(`+${id}h logged`);
      break;
    }
    case "log-time-minus": {
      const k = todayISO();
      s.settings.dailyLogged[k] = Math.max(0, (+s.settings.dailyLogged[k] || 0) - (+id));
      logActivity(); refresh();
      toast(`−${id}h`);
      break;
    }
    case "log-time-edit": {
      const k = todayISO();
      const cur = +s.settings.dailyLogged[k] || 0;
      const v = prompt("Total hours logged today:", cur);
      if (v == null) break;
      s.settings.dailyLogged[k] = Math.max(0, +v || 0);
      saveState(); refresh();
      break;
    }

    case "jump-pillar":
      activeTab = "grid"; goalViewMode = "map"; render();
      setTimeout(() => openPillar(id), 60);
      break;

    /* ---------- Plan ---------- */
    case "add-month": {
      const name = prompt("Month name (e.g. Nov 2026)");
      if (!name) break;
      if (s.roadmap.some(r => r.m === name)){ toast("Already exists"); break; }
      s.roadmap.push({ m:name, focus:"Focus area", items:[] });
      s.timeline[name] = { items:[] };
      saveState(); renderView();
      break;
    }
    case "add-tl-item": {
      const m = el.dataset.month;
      const r = s.roadmap.find(x => x.m === m);
      if (!r) break;
      const val = prompt("New item:");
      if (!val) break;
      r.items.push(val);
      if (!s.timeline[m]) s.timeline[m] = { items:[] };
      s.timeline[m].items.push(false);
      saveState(); renderView();
      break;
    }
    case "rm-tl-item": {
      const m = el.dataset.month;
      const i = +el.dataset.i;
      const r = s.roadmap.find(x => x.m === m);
      if (!r) break;
      r.items.splice(i, 1);
      if (s.timeline[m]) s.timeline[m].items.splice(i, 1);
      saveState(); renderView();
      break;
    }

    /* ---------- Track ---------- */
    case "add-wk-cat": {
      const name = prompt("Category name");
      if (!name) break;
      if (s.weekly.targets[name] != null){ toast("Already exists"); break; }
      const target = +prompt("Weekly target (hours)", "3") || 3;
      s.weekly.targets[name] = target;
      s.weekly.logged[name] = 0;
      saveState(); renderView();
      break;
    }
    case "wk-log": {
      const cat = id; const v = +el.dataset.v;
      s.weekly.logged[cat] = (+s.weekly.logged[cat] || 0) + v;
      logActivity(); saveState(); renderView();
      toast(`+${v}h ${cat}`);
      break;
    }
    case "wk-log-minus": {
      const cat = id; const v = +el.dataset.v;
      s.weekly.logged[cat] = Math.max(0, (+s.weekly.logged[cat] || 0) - v);
      logActivity(); saveState(); renderView();
      toast(`−${v}h ${cat}`);
      break;
    }
    case "wk-remove": {
      if (!confirm(`Remove "${id}"?`)) break;
      delete s.weekly.targets[id];
      delete s.weekly.logged[id];
      saveState(); renderView();
      break;
    }

    /* ---------- Projects ---------- */
    case "open-projects": openProjects(); break;
    case "add-project": openProjectModal(null); break;
    case "edit-project": openProjectModal(id); break;
    case "save-project": {
      const pid = $("#projId").value;
      const data = {
        name: $("#pName").value.trim() || "Untitled",
        desc: $("#pDesc").value.trim(),
        stack: $("#pStack").value.trim(),
        github: $("#pGithub").value.trim(),
        live: $("#pLive").value.trim(),
        status: $("#pStatus").value,
        progress: clamp(+$("#pProg").value || 0, 0, 100),
        notes: $("#pNotes").value.trim()
      };
      if (pid){
        const i = s.projects.findIndex(x => x.id === pid);
        s.projects[i] = { ...s.projects[i], ...data };
      } else {
        s.projects.push({ id: uid(), ...data });
      }
      logActivity(); saveState();
      closeModal(); refresh();
      setTimeout(() => openProjects(), 100);
      toast("Saved");
      break;
    }
    case "del-project": {
      if (!confirm("Delete this project?")) break;
      s.projects = s.projects.filter(x => x.id !== id);
      saveState(); closeModal();
      setTimeout(() => openProjects(), 100);
      refresh();
      break;
    }

    /* ---------- Applications ---------- */
    case "open-apps": openApps(); break;
    case "add-app": openAppModal(); break;
    case "save-app": {
      s.applications.push({
        id: uid(),
        company: $("#aCompany").value.trim(),
        role: $("#aRole").value.trim(),
        status: $("#aStatus").value,
        date: $("#aDate").value,
        notes: $("#aNotes").value.trim()
      });
      logActivity(); saveState();
      closeModal(); refresh();
      setTimeout(() => openApps(), 100);
      toast("Saved");
      break;
    }
    case "del-app": {
      s.applications = s.applications.filter(x => x.id !== id);
      saveState(); closeModal();
      setTimeout(() => openApps(), 100);
      refresh();
      break;
    }

    /* ---------- DSA ---------- */
    case "open-dsa": activeTab = "dsa"; render(); break;
    case "dsa-log": openDsaLog(); break;
    case "dsa-save": {
      s.dsa.problems.push({
        id: uid(),
        name: $("#dName").value.trim() || "Untitled",
        topic: $("#dTopic").value,
        difficulty: $("#dDifficulty").value,
        timeMin: +$("#dTime").value || 0,
        status: $("#dStatus").value,
        date: $("#dDate").value,
        notes: $("#dNotes").value.trim()
      });
      logActivity(); saveState();
      closeModal(); refresh();
      toast("Problem logged");
      break;
    }
    case "dsa-rm": {
      s.dsa.problems = s.dsa.problems.filter(x => x.id !== id);
      saveState(); refresh();
      break;
    }
    case "dsa-targets": openDsaTargets(); break;

    /* ---------- Workouts ---------- */
    case "open-workouts": activeTab = "workouts"; render(); break;
    case "wk-start": openWorkoutSession(id); break;
    case "wk-freeform": openWorkoutSession(null); break;
    case "wk-new-template": openWorkoutTemplateEditor(null); break;
    case "ws-add-exercise": {
      const container = $("#wsExercises");
      if (!container) break;
      const i = container.children.length;
      container.insertAdjacentHTML("beforeend", wsExerciseRow({ name:"", sets:3, reps:8, weight:0 }, i));
      break;
    }
    case "wt-add-exercise": {
      const container = $("#wtExercises");
      if (!container) break;
      const i = container.children.length;
      container.insertAdjacentHTML("beforeend", wsExerciseRow({ name:"", sets:3, reps:8, weight:0 }, i));
      break;
    }
    case "ws-rm-exercise":
    case "wt-rm-exercise": {
      const i = +el.dataset.i;
      const row = document.querySelector(`[data-ws-row="${i}"]`);
      if (row) row.remove();
      break;
    }
    case "ws-save": {
      const session = readExerciseRows("#wsExercises");
      s.workouts.sessions.push({
        id: uid(),
        name: $("#wsName").value.trim() || "Session",
        date: $("#wsDate").value,
        templateId: $("#wsTemplateId").value || null,
        exercises: session
      });
      logActivity(); saveState();
      closeModal(); refresh();
      toast("Session saved");
      break;
    }
    case "wkt-save": {
      const exercises = readExerciseRows("#wtExercises");
      const id = $("#wtId").value;
      const name = $("#wtName").value.trim() || "Untitled";
      if (id){
        const i = s.workouts.customTemplates.findIndex(x => x.id === id);
        if (i >= 0){
          s.workouts.customTemplates[i] = { id, name, exercises };
        } else {
          s.workouts.customTemplates.push({ id: uid(), name, exercises });
        }
      } else {
        s.workouts.customTemplates.push({ id: uid(), name, exercises });
      }
      saveState(); closeModal(); refresh();
      toast("Template saved");
      break;
    }
    case "wk-save-target": {
      const v = +$("#wkTarget").value || 4;
      s.workouts.weeklyTarget = v;
      saveState(); renderView();
      toast("Saved");
      break;
    }

    /* ---------- Weight ---------- */
    case "open-weight": activeTab = "weight"; render(); break;
    case "wt-log": openWeightLog(); break;
    case "wt-save": {
      const w = +$("#wWeight").value;
      if (!w){ toast("Enter a weight"); break; }
      s.weight.entries.push({
        id: uid(),
        weight: w,
        date: $("#wDate").value,
        note: $("#wNote") ? $("#wNote").value.trim() : ""
      });
      logActivity(); saveState();
      closeModal(); refresh();
      toast("Logged");
      break;
    }
    case "wt-unit": {
      s.weight.unit = id;
      saveState(); renderView();
      break;
    }
    case "wt-save-goal": {
      s.weight.goal = +$("#wtGoal").value || null;
      saveState(); renderView();
      toast("Saved");
      break;
    }

    /* ---------- More / Settings ---------- */
    case "open-theme": openThemePicker(); break;
    case "set-theme": {
      s.settings.theme = id;
      saveState(); applyTheme(id); closeModal(); renderView();
      toast("Theme: " + (THEMES.find(t => t.id === id)?.name || id));
      break;
    }
    case "open-customize": openCustomize(); break;
    case "open-ai": openAI(); break;
    case "save-meta":
      s.meta.logo = $("#metaLogo").value.trim() || "🎯";
      s.meta.title = $("#metaTitle").value.trim() || "Success Grid";
      s.meta.mainGoal = $("#metaMain").value.trim() || DEFAULT_MAIN_GOAL;
      s.meta.mainGoalNote = $("#metaMainNote").value.trim();
      saveState(); render(); toast("Saved");
      break;
    case "save-daily-budget":
      s.settings.dailyBudget = Math.max(0, +$("#dailyBudget").value || 0);
      saveState(); renderView(); toast("Saved");
      break;

    case "add-subtask": {
      const inp = $("#newSubtask");
      const title = (inp?.value || "").trim();
      if (!title) break;
      const g = s.goals[id];
      if (!g) break;
      g.subtasks.push({ id: uid(), title, done:false });
      if (g.autoSync){
        g.progress = Math.round(g.subtasks.filter(x => x.done).length / g.subtasks.length * 100);
      }
      logActivity(); saveState(); refresh();
      openGoal(id, { focus:true });
      break;
    }

    case "del-subtask": {
      const gid = Object.keys(s.goals).find(k => s.goals[k].subtasks?.some(x => x.id === id));
      if (!gid) break;
      const g = s.goals[gid];
      g.subtasks = g.subtasks.filter(x => x.id !== id);
      if (g.autoSync && g.subtasks.length){
        g.progress = Math.round(g.subtasks.filter(x => x.done).length / g.subtasks.length * 100);
      }
      logActivity(); saveState(); refresh();
      openGoal(gid);
      break;
    }

    case "copy-prompt": {
      const pre = $("#promptPre");
      if (!pre) break;
      const text = pre.textContent;
      if (navigator.clipboard?.writeText){
        navigator.clipboard.writeText(text)
          .then(() => toast("Prompt copied"))
          .catch(() => { fallbackCopy(text); toast("Prompt copied"); });
      } else { fallbackCopy(text); toast("Prompt copied"); }
      break;
    }

    case "import-ai-json": {
      const raw = $("#aiJsonIn").value.trim();
      if (!raw){ toast("Paste JSON first"); break; }
      try {
        const clean = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
        const parsed = JSON.parse(clean);
        const next = normalize(Object.assign(defaultState(s.user.name), parsed, { user: s.user }));
        setState(next);
        saveState(); closeModal(); render();
        toast("Grid built!");
      } catch(err){ toast("Couldn't read that JSON"); }
      break;
    }

    case "export": {
      const blob = new Blob([JSON.stringify(s, null, 2)], { type:"application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `success-grid-${todayISO()}.json`; a.click();
      URL.revokeObjectURL(url); toast("Exported");
      break;
    }
    case "import": {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = "application/json";
      inp.onchange = ev => {
        const f = ev.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          try {
            setState(normalize(JSON.parse(r.result)));
            saveState(); render(); toast("Imported");
          } catch(e){ toast("Invalid file"); }
        };
        r.readAsText(f);
      };
      inp.click();
      break;
    }
    case "reset":
      if (!confirm("Reset ALL data? This cannot be undone.")) break;
      setState(defaultState(s.user.name, "", s.user.goalType));
      saveState(); render(); toast("Reset");
      break;
  }
});

function readExerciseRows(containerSel){
  const rows = document.querySelectorAll(`${containerSel} [data-ws-row]`);
  const out = [];
  rows.forEach(row => {
    const name = row.querySelector("[data-ws-name]").value.trim();
    if (!name) return;
    out.push({
      name,
      sets: +row.querySelector("[data-ws-sets]").value || 0,
      reps: +row.querySelector("[data-ws-reps]").value || 0,
      weight: +row.querySelector("[data-ws-weight]").value || 0
    });
  });
  return out;
}
function fallbackCopy(text){
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.left = "-9999px";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch(e){}
  document.body.removeChild(ta);
}

/* ============================================================
   INPUT HANDLING
   ============================================================ */
document.addEventListener("input", e => {
  const t = e.target;
  const s = getState();

  // AI prompt fields
  const aiMap = { aiMainGoal:"mainGoal", aiSkill:"skillLevel", aiTime:"timeAvailable", aiDeadline:"deadline", aiConstraints:"constraints" };
  if (t.id in aiMap){
    s.aiPrompt[aiMap[t.id]] = t.value;
    saveState();
    const pre = $("#promptPre");
    if (pre) pre.textContent = buildPrompt(s.aiPrompt);
    return;
  }

   // ---------- goal sheet inputs ----------
  const drawer = t.closest(".drawer");
  const gid = drawer?.dataset.goalId;

  if (t.matches("[data-goal-progress]")){
    if (!gid) return;
    const g = s.goals[gid];
    if (!g) return;
    g.progress = clamp(+t.value, 0, 100);
    if (g.progress >= 100) g.status = "Completed";
    else if (g.progress === 0) g.status = "Not Started";
    else if (g.status !== "Needs Review") g.status = "In Progress";
    const pct = $("#goalPct");
    if (pct) pct.textContent = g.progress + "%";
    saveState();
    return;
  }

  if (t.matches("[data-goal-status]")){
    if (!gid) return;
    const g = s.goals[gid];
    if (!g) return;
    g.status = t.value;
    if (t.value === "Completed") g.progress = 100;
    if (t.value === "Not Started") g.progress = 0;
    logActivity(); saveState(); refresh();
    openGoal(gid);
    return;
  }

  if (t.matches("[data-goal-priority]")){
    if (!gid) return;
    const g = s.goals[gid];
    if (!g) return;
    g.priority = t.value;
    saveState(); refresh();
    openGoal(gid);
    return;
  }

  if (t.matches("[data-goal-date]")){
    if (!gid) return;
    const g = s.goals[gid];
    if (!g) return;
    g.targetDate = t.value;
    saveState();
    return;
  }

  if (t.matches("[data-goal-notes]")){
    if (!gid) return;
    const g = s.goals[gid];
    if (!g) return;
    g.notes = t.value;
    saveState();
    return;
  }

  if (t.matches("[data-goal-sync]")){
    if (!gid) return;
    const g = s.goals[gid];
    if (!g) return;
    g.autoSync = t.checked;
    if (t.checked){
      g.progress = g.subtasks.length
        ? Math.round(g.subtasks.filter(x => x.done).length / g.subtasks.length * 100)
        : 0;
    }
    logActivity(); saveState(); refresh();
    openGoal(gid);
    return;
  }

  if (t.matches("[data-action='toggle-subtask']")){
    if (!gid) return;
    const g = s.goals[gid];
    if (!g) return;
    const x = g.subtasks.find(y => y.id === t.dataset.id);
    if (!x) return;
    x.done = t.checked;

    // Always sync progress from subtasks (auto-sync or not)
    if (g.subtasks.length){
      g.progress = Math.round(g.subtasks.filter(y => y.done).length / g.subtasks.length * 100);
    }
    if (g.progress >= 100) g.status = "Completed";
    else if (g.progress === 0) g.status = "Not Started";
    else if (g.status !== "Needs Review") g.status = "In Progress";

    logActivity(); saveState();

    // Check pillar completion BEFORE re-render
    const { pillar } = findGoal(gid);
    const pillarDone = pillar && checkPillarCompletion(pillar.id);

    refresh();
    openGoal(gid);

    if (pillarDone){ celebrate("huge"); toast("Pillar complete"); }
    else if (g.progress >= 100){ celebrate("small"); toast("Goal complete!"); }
    else vibrate(10);
    return;
  }

  // timeline checkboxes
  if (t.matches("[data-tl]")){
    const m = t.dataset.tl, i = +t.dataset.i;
    if (!s.timeline[m]) s.timeline[m] = { items:[] };
    s.timeline[m].items[i] = t.checked;
    logActivity(); saveState();
    renderView();

    // check if whole month completed
    const tl = s.timeline[m];
    if (tl.items.length && tl.items.every(Boolean)){
      celebrate("big");
       toast("Month complete");
    }
    return;
  }

  // Track inline fields
  if (t.matches("[data-wk-log]")){
    const cat = t.dataset.wkLog;
    s.weekly.logged[cat] = Math.max(0, +t.value || 0);
    logActivity(); saveState();
    return;
  }
  if (t.matches("[data-wk-target]")){
    const cat = t.dataset.wkTarget;
    s.weekly.targets[cat] = Math.max(0, +t.value || 0);
    saveState();
    return;
  }
  if (t.matches("[data-dsa-target]")){
    const topic = t.dataset.dsaTarget;
    s.dsa.targets[topic] = Math.max(0, +t.value || 0);
    saveState();
    return;
  }

  // customize pillar fields
  if (t.matches("[data-pillar]")){
    const pi = +t.dataset.pillar;
    const p = s.pillars[pi];
    if (!p) return;
    p[t.dataset.f] = t.value;
    saveState();
    return;
  }
});

/* ============================================================
   INLINE EDIT (contenteditable)
   ============================================================ */
document.addEventListener("focusout", e => {
  const t = e.target;
  if (!t.matches("[data-action='inline-edit']")) return;
  const s = getState();
  const scope = t.dataset.scope;
  const text = t.textContent.trim();

  if (scope === "rm-month"){
    const old = t.dataset.id;
    const r = s.roadmap.find(x => x.m === old);
    if (!r) return;
    if (r.m === text) return;
    if (s.roadmap.some(x => x.m === text)){ toast("Name exists"); t.textContent = old; return; }
    // rename in timeline too
    s.timeline[text] = s.timeline[old] || { items:[] };
    delete s.timeline[old];
    r.m = text;
    t.dataset.id = text;
    saveState();
  }
  else if (scope === "rm-focus"){
    const r = s.roadmap.find(x => x.m === t.dataset.id);
    if (r){ r.focus = text; saveState(); }
  }
  else if (scope === "rm-item"){
    const r = s.roadmap.find(x => x.m === t.dataset.id);
    const i = +t.dataset.i;
    if (r && r.items[i] != null){ r.items[i] = text; saveState(); }
  }
});

/* ============================================================
   KEYBOARD / HISTORY
   ============================================================ */
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && isModalOpen()) closeModal();
  if (e.key === "Enter"){
    if (e.target.id === "newSubtask"){
      e.preventDefault();
      document.querySelector("[data-action='add-subtask']")?.click();
    }
    if (e.target.matches("[contenteditable]")){
      e.preventDefault();
      e.target.blur();
    }
  }
});

window.addEventListener("popstate", () => {
  if (isModalOpen()) closeModal(false);
});

/* ============================================================
   FLUSH PENDING SAVES ON EXIT
   ============================================================ */
window.addEventListener("beforeunload", saveStateNow);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    saveStateNow();
    return;
  }
  // App resumed from background — refresh if the calendar day changed
  if (!isModalOpen() && todayISO() !== lastRenderDate) {
    render();
  }
});

// Detect midnight rollover while the app stays open and visible
setInterval(() => {
  if (todayISO() !== lastRenderDate && !isModalOpen()) render();
}, 30000);

/* ============================================================
   BOOT
   ============================================================ */
document.getElementById("menuBtn").addEventListener("click", () => {
  activeTab = "more";
  render();
});
document.getElementById("tabbar").addEventListener("click", e => {
  const b = e.target.closest(".tab");
  if (!b) return;
  activeTab = b.dataset.tab;
  render();
});

loadState();
if (!getState() || !getState().user?.onboarded){
  showOnboarding();
} else {
  $("#app").hidden = false;
  render();
}