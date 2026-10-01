// js/app.js — entry, event delegation, swipe, overlays, boot
import { $, $$, clamp, todayISO, uid, toast, vibrate } from "./utils.js";
import {
  getState, setState, loadState, saveState, saveStateNow, setOnSave,
  defaultState, normalize,
  findGoal, effectiveProgress, nextSubtaskFor, logActivity,
  DEFAULT_MAIN_GOAL, checkWeeklyReset,
  streakWithGrace, checkAndAwardMilestones, checkAndAwardRecords,
  applySeededExample, lastWeekStats, readiness
} from "./state.js";
import {
  applyTheme, applyA11y, celebrate, closeModal, isModalOpen
} from "./ui.js";
import {
  renderToday, renderGrid, renderPlan, renderTrack, renderMore,
  renderDsa, renderWorkouts, renderWeight, renderStatsPanel
} from "./views.js";
import {
  openGoal, openPillar, openStages, openProjects, openProjectModal,
  openApps, openAppModal, openDsaLog, openDsaTargets,
  openWorkoutSession, openWorkoutTemplateEditor, openWeightLog,
  openThemePicker, openCustomize, openAI, buildPrompt, openComingSoon,
  wsExerciseRow,
  openInputModal, readInputModalValue, getInputModalCallback,
  openSearch, renderSearchResults,
  openQuickAdd,
  openLayoutPicker, openA11yPicker, openRecords, openRecap,
  openFocusMode, openCommandPalette,
  showNewMilestones, showNewRecords
} from "./modals.js";
import { isSupabaseConfigured } from "./supabase.js";
import {
  getSession, setCachedUser, signInWithGoogle, signOut, onAuthChange
} from "./auth.js";
import { pullAndReplaceLocal, pushNow, schedulePush, onSyncChange } from "./sync.js";

/* ============================================================
   APP STATE (view-local)
   ============================================================ */
let activeTab = "today";
let goalViewMode = "map";
let onboardingIndex = 0;
let lastRenderDate = todayISO();
let _focusGoalId = null;
let _milestoneCooldown = 0;

/* ============================================================
   TAB SYNC — bottom tabbar + desktop rail
   ============================================================ */
const SUB_VIEWS = ["dsa", "workouts", "weight", "track"];

function isTabActive(btnTab) {
  if (btnTab === activeTab) return true;
  if (btnTab === "more" && SUB_VIEWS.includes(activeTab)) return true;
  return false;
}

function renderTabs() {
  $$("#tabbar .tab").forEach((btn) => {
    btn.classList.toggle("active", isTabActive(btn.dataset.tab));
  });
  $$(".rail-item[data-tab]").forEach((btn) => {
    btn.classList.toggle("active", isTabActive(btn.dataset.tab));
  });
}

/* ============================================================
   RENDER
   ============================================================ */
function renderSkeleton() {
  const v = $("#view");
  if (!v) return;
  v.innerHTML = `
    <div class="greet">
      <div>
        <div class="skeleton" style="width:180px;height:26px;margin-bottom:8px"></div>
        <div class="skeleton" style="width:120px;height:14px"></div>
      </div>
      <div class="skeleton" style="width:70px;height:40px;border-radius:var(--r-full)"></div>
    </div>
    <div class="skeleton" style="width:100%;height:200px;border-radius:var(--r-md);margin-bottom:16px"></div>
    <div class="skeleton" style="width:100%;height:100px;border-radius:var(--r-md);margin-bottom:16px"></div>
    <div class="skeleton" style="width:100%;height:90px;border-radius:var(--r-md);"></div>
  `;
}

function renderView() {
  const s = getState();
  const v = $("#view");
  if (!v) return;
  if (activeTab === "today") v.innerHTML = renderToday(s);
  else if (activeTab === "grid") v.innerHTML = renderGrid(s, goalViewMode);
  else if (activeTab === "plan") v.innerHTML = renderPlan(s);
  else if (activeTab === "track") v.innerHTML = renderTrack(s);
  else if (activeTab === "more") v.innerHTML = renderMore(s);
  else if (activeTab === "dsa") v.innerHTML = renderDsa(s);
  else if (activeTab === "workouts") v.innerHTML = renderWorkouts(s);
  else if (activeTab === "weight") v.innerHTML = renderWeight(s);
}

function renderStatsPanelIfDesktop() {
  const panel = document.getElementById("statsPanel");
  if (!panel) return;
  if (window.innerWidth < 1024) {
    panel.innerHTML = "";
    return;
  }
  panel.innerHTML = renderStatsPanel(getState());
}

function renderRailStreak() {
  const rail = document.getElementById("railStreak");
  if (!rail) return;
  const num = rail.querySelector(".rail-streak-num");
  if (num) num.textContent = String(streakWithGrace());
}

function render() {
  const s = getState();
  if (!s) return;

  checkWeeklyReset();
  applyTheme(s.settings.theme);
  applyA11y(s.settings.a11y || "default");

  const title = s.meta.title || "Success Grid";
  const logo = s.meta.logo || "🎯";

  const railTitle = document.getElementById("appTitle");
  if (railTitle) railTitle.textContent = title;

  const mobileTitle = document.getElementById("appTitleMobile");
  if (mobileTitle) mobileTitle.textContent = title;

  const logoEl = document.getElementById("logoEmoji");
  if (logoEl) logoEl.textContent = logo;

  document.title = title;

  renderTabs();
  renderView();
  renderStatsPanelIfDesktop();
  renderRailStreak();

  lastRenderDate = todayISO();
}

function refresh() {
  saveState();
  renderTabs();
  if (!isModalOpen()) renderView();
  renderStatsPanelIfDesktop();
  renderRailStreak();
}

/* ============================================================
   MILESTONE / PR TRIGGER
   ------------------------------------------------------------
   Called after any mutation that could earn a milestone or
   beat a record. Shows at most one overlay, then cools down.
   ============================================================ */
function maybeAwardMilestones() {
  const s = getState();
  const now = Date.now();
  if (now < _milestoneCooldown) return;

  const newMilestones = checkAndAwardMilestones();
  const allRecords = checkAndAwardRecords();
  const loudRecords = allRecords.filter((r) => !r.silent);
  const silentRecords = allRecords.filter((r) => r.silent);

  // Silent records — write without overlay
  silentRecords.forEach((r) => {
    if (!s.records[r.key]) {
      s.records[r.key] = {
        value: r.next, at: new Date().toISOString(),
        unit: r.unit, silent: true
      };
    }
  });

  if (!newMilestones.length && !loudRecords.length) {
    if (silentRecords.length) saveState();
    return;
  }

  if (newMilestones.length) {
    const m = newMilestones[0];
    s.milestones.earned[m.id] = { at: new Date().toISOString() };
    showNewMilestones([m]);
  } else if (loudRecords.length) {
    const r = loudRecords[0];
    s.records[r.key] = {
      value: r.next, at: new Date().toISOString(), unit: r.unit
    };
    showNewRecords([r]);
  }

  saveState();
  _milestoneCooldown = Date.now() + 6000;
}

/* ============================================================
   AUTH INIT
   ============================================================ */
async function initAuth() {
  if (!isSupabaseConfigured) return;
  setOnSave(schedulePush);

  try {
    const session = await getSession();
    setCachedUser(session?.user ?? null);
    if (session?.user) {
      await pullAndReplaceLocal();
      render();
    }
  } catch (e) {
    console.warn("Auth init failed", e);
  }

  onAuthChange(async (event) => {
    if (activeTab === "more" && !isModalOpen()) renderView();
    if (event === "SIGNED_IN") {
      toast("Signed in");
      await pullAndReplaceLocal();
      render();
    }
    if (event === "SIGNED_OUT") {
      toast("Signed out");
      render();
    }
  });

  onSyncChange(() => {
    if (activeTab === "more" && !isModalOpen()) renderView();
  });
}

/* ============================================================
   ONBOARDING — 4 slides
   ============================================================ */
const CAPTIONS = [
  "One goal at the center.",
  "Eight pillars around it.",
  "Sixty-four small steps.",
  "Progress fills up like a water bottle.",
  "Every pillar you finish moves the goal."
];

let captionTimer = null;

function startCaptionRotation() {
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

function showOnboarding() {
  const onb = $("#onboarding");
  const app = $("#app");
  if (onb) onb.hidden = false;
  if (app) app.hidden = true;
  onboardingIndex = 0;
  updateOnb();
  startCaptionRotation();
}

function updateOnb() {
  $$(".onb-slide").forEach((el, i) => {
    el.hidden = i !== onboardingIndex;
  });
  $$(".onb-dots").forEach((dots, i) => {
    if (i !== onboardingIndex) return;
    [...dots.children].forEach((s, j) => {
      s.classList.toggle("on", j === onboardingIndex);
    });
  });
}

function finishOnboarding(mode) {
  const nameEl = $("#onbName");
  const goalEl = $("#onbGoal");
  const typeEl = $("#onbType .on");

  const name = (nameEl?.value || "").trim() || "friend";
  const goal = (goalEl?.value || "").trim();
  const goalType = typeEl?.dataset.type || "career";

  const existing = getState();
  const hadData = existing && existing.meta && existing.meta.mainGoal &&
    existing.meta.mainGoal !== DEFAULT_MAIN_GOAL &&
    existing.meta.mainGoal !== "🎯 Achieve Your Main Goal";

  if (hadData) {
    existing.user = { name, goalType, onboarded: true };
    if (goal) existing.meta.mainGoal = goal;
    setState(existing);
  } else {
    let next = defaultState(name, goal, goalType);
    if (mode === "example") next = applySeededExample(next, goalType);
    setState(next);
  }

  saveState();
  clearInterval(captionTimer);

  const onb = $("#onboarding");
  const app = $("#app");
  if (onb) onb.hidden = true;
  if (app) app.hidden = false;

  activeTab = "today";
  render();

  if (mode === "ai") setTimeout(() => openAI(), 350);
  if (mode === "example") toast("Example grid loaded — edit anything you like");
}

/* ============================================================
   SHARED HELPERS
   ============================================================ */
function checkPillarCompletion(pillarId) {
  const s = getState();
  const p = s.pillars.find((x) => x.id === pillarId);
  if (!p) return false;
  return p.goals.every((g) => {
    const st = s.goals[g.id];
    return st && (st.status === "Completed" || effectiveProgress(g.id) >= 100);
  });
}

function exportData() {
  const s = getState();
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `success-grid-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Exported");
}

function importData() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "application/json";
  inp.onchange = (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        setState(normalize(JSON.parse(r.result)));
        saveState();
        render();
        toast("Imported");
      } catch (e) {
        toast("Invalid file");
      }
    };
    r.readAsText(f);
  };
  inp.click();
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) {}
  document.body.removeChild(ta);
}

/* ============================================================
   FOCUS MODE EVENTS
   ============================================================ */
document.addEventListener("focus:done", () => {
  if (!_focusGoalId) return;
  const id = _focusGoalId;
  _focusGoalId = null;

  const s = getState();
  const sub = nextSubtaskFor(id);
  if (!sub) { toast("Already complete"); return; }

  sub.done = true;
  const g = s.goals[id];
  if (!g) return;

  if (g.subtasks.length) {
    g.progress = Math.round(
      (g.subtasks.filter((x) => x.done).length / g.subtasks.length) * 100
    );
  }
  if (g.progress >= 100) g.status = "Completed";
  else if (g.progress === 0) g.status = "Not Started";
  else if (g.status !== "Needs Review") g.status = "In Progress";

  logActivity();
  saveState();

  const { pillar } = findGoal(id);
  const pillarDone = pillar && checkPillarCompletion(pillar.id);

  refresh();

  if (pillarDone) {
    celebrate("huge");
    toast("Pillar complete");
  } else if (g.progress >= 100) {
    celebrate("small");
    toast("Goal complete!");
  } else {
    vibrate(10);
    toast(sub.title.slice(0, 40));
  }

  maybeAwardMilestones();
});

document.addEventListener("focus:skip", () => {
  _focusGoalId = null;
});

/* ============================================================
   COMMAND PALETTE EVENTS
   ============================================================ */
document.addEventListener("cmd:goto-tab", (e) => {
  const id = e.detail;
  if (!id) return;
  activeTab = id;
  render();
});

document.addEventListener("cmd:export", () => exportData());
document.addEventListener("cmd:import", () => importData());

/* ============================================================
   CLICK HANDLING
   ============================================================ */
document.addEventListener("click", (e) => {
  // Onboarding controls
  const onbBtn = e.target.closest("[data-onb]");
  if (onbBtn) {
    const act = onbBtn.dataset.onb;
    if (act === "next") {
      const nameEl = $("#onbName");
      if (onboardingIndex === 1 && nameEl && !nameEl.value.trim()) {
        toast("Please enter a name");
        return;
      }
      onboardingIndex = Math.min(3, onboardingIndex + 1);
      updateOnb();
      return;
    }
    if (act === "build-ai") { finishOnboarding("ai"); return; }
    if (act === "build-blank") { finishOnboarding("blank"); return; }
    if (act === "build-example") { finishOnboarding("example"); return; }
  }

  const typ = e.target.closest("#onbType button");
  if (typ) {
    $$("#onbType button").forEach((b) => b.classList.remove("on"));
    typ.classList.add("on");
    return;
  }

  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;
  const s = getState();

  switch (action) {
    /* ---------- Navigation ---------- */
    case "goto-tab":
      activeTab = id;
      render();
      break;
    case "close-modal":
      closeModal();
      break;
    case "open-command":
      openCommandPalette();
      break;
    case "open-search":
      openSearch();
      break;

    /* ---------- Input modal ---------- */
    case "input-modal-save": {
      const cb = getInputModalCallback();
      const val = readInputModalValue();
      closeModal();
      if (cb) setTimeout(() => cb(val), 150);
      break;
    }

    /* ---------- Quick add FAB ---------- */
    case "fab-log-time": {
      closeModal();
      setTimeout(() => {
        const k = todayISO();
        s.settings.dailyLogged[k] = (+s.settings.dailyLogged[k] || 0) + 0.5;
        logActivity();
        refresh();
        toast("+0.5h logged");
        maybeAwardMilestones();
      }, 200);
      break;
    }
    case "fab-log-dsa":
      closeModal();
      setTimeout(() => { activeTab = "dsa"; render(); openDsaLog(); }, 200);
      break;
    case "fab-add-project":
      closeModal();
      setTimeout(() => openProjectModal(null), 200);
      break;
    case "fab-add-app":
      closeModal();
      setTimeout(() => openAppModal(), 200);
      break;
    case "fab-log-workout":
      closeModal();
      setTimeout(() => openWorkoutSession(null), 200);
      break;
    case "fab-log-weight":
      closeModal();
      setTimeout(() => openWeightLog(), 200);
      break;

    /* ---------- Search results ---------- */
    case "search-open-goal":
      closeModal();
      setTimeout(() => openGoal(id, { focus: true }), 160);
      break;
    case "search-open-project":
      closeModal();
      setTimeout(() => openProjectModal(id), 160);
      break;
    case "search-open-app":
      closeModal();
      setTimeout(() => openApps(), 160);
      break;
    case "search-open-dsa":
      closeModal();
      setTimeout(() => { activeTab = "dsa"; render(); }, 160);
      break;

    /* ---------- Auth / sync ---------- */
    case "sign-in":
      signInWithGoogle().catch((err) => {
        console.error(err);
        toast("Sign-in failed");
      });
      break;
    case "sign-out":
      if (!confirm("Sign out of Google?")) break;
      signOut()
        .then(() => renderView())
        .catch((err) => {
          console.error(err);
          toast("Sign-out failed");
        });
      break;
    case "sync-now":
      pushNow().then(() => {
        if (activeTab === "more" && !isModalOpen()) renderView();
        toast("Synced");
      });
      break;

    /* ---------- Goals / pillars ---------- */
    case "open-goal":
      e.stopPropagation();
      openGoal(id, { focus: true });
      break;
    case "open-pillar":
      e.stopPropagation();
      openPillar(id);
      break;
    case "open-stages":
      openStages();
      break;
    case "open-stage": {
      const st = s.stages[+id];
      if (!st) break;
      const p = s.pillars.find((x) => x.id === st.src[0]);
      if (p) openPillar(p.id);
      break;
    }
    case "grid-mode":
      goalViewMode = id;
      renderView();
      break;
    case "jump-pillar":
      activeTab = "grid";
      goalViewMode = "map";
      render();
      setTimeout(() => openPillar(id), 60);
      break;

    /* ---------- Focus ---------- */
    case "focus-start":
      _focusGoalId = id;
      openFocusMode(id);
      break;

    /* ---------- Task completion ---------- */
    case "quick-check": {
      e.stopPropagation();
      const sub = nextSubtaskFor(id);
      if (!sub) { toast("Already complete"); return; }
      sub.done = true;
      const g = s.goals[id];
      g.progress = Math.round(
        (g.subtasks.filter((x) => x.done).length / g.subtasks.length) * 100
      );
      if (g.progress >= 100) g.status = "Completed";
      else if (g.status === "Not Started") g.status = "In Progress";
      logActivity();

      const { pillar } = findGoal(id);
      const pillarDone = pillar && checkPillarCompletion(pillar.id);

      refresh();
      if (pillarDone) {
        celebrate("huge");
        toast("Pillar complete");
      } else if (g.progress >= 100) {
        celebrate("small");
        toast("Goal complete!");
      } else {
        vibrate(10);
        toast(sub.title.slice(0, 40));
      }
      maybeAwardMilestones();
      break;
    }

    /* ---------- Time logging ---------- */
    case "log-time": {
      const k = todayISO();
      s.settings.dailyLogged[k] = (+s.settings.dailyLogged[k] || 0) + (+id);
      logActivity();
      refresh();
      toast(`+${id}h logged`);
      maybeAwardMilestones();
      break;
    }
    case "log-time-minus": {
      const k = todayISO();
      s.settings.dailyLogged[k] = Math.max(
        0,
        (+s.settings.dailyLogged[k] || 0) - (+id)
      );
      logActivity();
      refresh();
      toast(`−${id}h`);
      break;
    }
    case "reset-daily-budget": {
      const k = todayISO();
      s.settings.dailyLogged[k] = 0;
      saveState();
      refresh();
      toast("Today's budget reset");
      break;
    }
    case "log-time-edit": {
      const k = todayISO();
      const cur = +s.settings.dailyLogged[k] || 0;
      openInputModal(
        "Set Hours",
        {
          label: "Total hours logged today",
          value: String(cur),
          type: "number",
          inputMode: "decimal",
          placeholder: "0"
        },
        (val) => {
          s.settings.dailyLogged[k] = Math.max(0, +val || 0);
          saveState();
          refresh();
          toast("Updated");
        }
      );
      break;
    }

    /* ---------- Plan ---------- */
    case "add-month": {
      openInputModal(
        "Add Month",
        { label: "Month name", placeholder: "e.g. Nov 2026" },
        (name) => {
          if (!name) return;
          if (s.roadmap.some((r) => r.m === name)) {
            toast("Already exists");
            return;
          }
          s.roadmap.push({ m: name, focus: "Focus area", items: [] });
          s.timeline[name] = { items: [] };
          saveState();
          renderView();
          toast("Month added");
        }
      );
      break;
    }
    case "add-tl-item": {
      const m = el.dataset.month;
      const r = s.roadmap.find((x) => x.m === m);
      if (!r) break;
      openInputModal(
        "Add Item",
        { label: `New action for ${m}`, placeholder: "e.g. Ship first prototype" },
        (val) => {
          if (!val) return;
          r.items.push(val);
          if (!s.timeline[m]) s.timeline[m] = { items: [] };
          s.timeline[m].items.push(false);
          saveState();
          renderView();
          toast("Item added");
        }
      );
      break;
    }
    case "rm-tl-item": {
      const m = el.dataset.month;
      const i = +el.dataset.i;
      const r = s.roadmap.find((x) => x.m === m);
      if (!r) break;
      r.items.splice(i, 1);
      if (s.timeline[m]) s.timeline[m].items.splice(i, 1);
      saveState();
      renderView();
      break;
    }

    /* ---------- Track categories ---------- */
    case "add-wk-cat": {
      openInputModal(
        "New Category",
        { label: "Category name", placeholder: "e.g. Reading" },
        (name) => {
          if (!name) return;
          if (s.weekly.targets[name] != null) {
            toast("Already exists");
            return;
          }
          openInputModal(
            "Weekly Target",
            {
              label: `Target hours for "${name}"`,
              value: "3",
              type: "number",
              inputMode: "decimal"
            },
            (target) => {
              s.weekly.targets[name] = Math.max(0, +target || 3);
              s.weekly.logged[name] = 0;
              saveState();
              renderView();
              toast("Category added");
            }
          );
        }
      );
      break;
    }
    case "wk-log": {
      const cat = id;
      const v = +el.dataset.v;
      s.weekly.logged[cat] = (+s.weekly.logged[cat] || 0) + v;
      logActivity();
      saveState();
      renderView();
      toast(`+${v}h ${cat}`);
      maybeAwardMilestones();
      break;
    }
    case "wk-log-minus": {
      const cat = id;
      const v = +el.dataset.v;
      s.weekly.logged[cat] = Math.max(0, (+s.weekly.logged[cat] || 0) - v);
      logActivity();
      saveState();
      renderView();
      toast(`−${v}h ${cat}`);
      break;
    }
    case "wk-remove": {
      if (!confirm(`Remove "${id}"?`)) break;
      delete s.weekly.targets[id];
      delete s.weekly.logged[id];
      saveState();
      renderView();
      break;
    }

    /* ---------- Projects ---------- */
    case "open-projects":
      openProjects();
      break;
    case "add-project":
      openProjectModal(null);
      break;
    case "edit-project":
      openProjectModal(id);
      break;
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
      if (pid) {
        const i = s.projects.findIndex((x) => x.id === pid);
        s.projects[i] = { ...s.projects[i], ...data };
      } else {
        s.projects.push({ id: uid(), ...data });
      }
      logActivity();
      saveState();
      closeModal();
      refresh();
      setTimeout(() => openProjects(), 100);
      toast("Saved");
      maybeAwardMilestones();
      break;
    }
    case "del-project": {
      if (!confirm("Delete this project?")) break;
      s.projects = s.projects.filter((x) => x.id !== id);
      saveState();
      closeModal();
      setTimeout(() => openProjects(), 100);
      refresh();
      break;
    }

    /* ---------- Applications ---------- */
    case "open-apps":
      openApps();
      break;
    case "add-app":
      openAppModal();
      break;
    case "save-app": {
      s.applications.push({
        id: uid(),
        company: $("#aCompany").value.trim(),
        role: $("#aRole").value.trim(),
        status: $("#aStatus").value,
        date: $("#aDate").value,
        notes: $("#aNotes").value.trim()
      });
      logActivity();
      saveState();
      closeModal();
      refresh();
      setTimeout(() => openApps(), 100);
      toast("Saved");
      maybeAwardMilestones();
      break;
    }
    case "del-app": {
      s.applications = s.applications.filter((x) => x.id !== id);
      saveState();
      closeModal();
      setTimeout(() => openApps(), 100);
      refresh();
      break;
    }

    /* ---------- DSA ---------- */
    case "open-dsa":
      activeTab = "dsa";
      render();
      break;
    case "dsa-log":
      openDsaLog();
      break;
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
      logActivity();
      saveState();
      closeModal();
      refresh();
      toast("Problem logged");
      maybeAwardMilestones();
      break;
    }
    case "dsa-rm": {
      s.dsa.problems = s.dsa.problems.filter((x) => x.id !== id);
      saveState();
      refresh();
      break;
    }
    case "dsa-targets":
      openDsaTargets();
      break;

    /* ---------- Workouts ---------- */
    case "open-workouts":
      activeTab = "workouts";
      render();
      break;
    case "wk-start":
      openWorkoutSession(id);
      break;
    case "wk-freeform":
      openWorkoutSession(null);
      break;
    case "wk-new-template":
      openWorkoutTemplateEditor(null);
      break;
    case "ws-add-exercise": {
      const container = $("#wsExercises");
      if (!container) break;
      const i = container.children.length;
      container.insertAdjacentHTML(
        "beforeend",
        wsExerciseRow({ name: "", sets: 3, reps: 8, weight: 0 }, i)
      );
      break;
    }
    case "wt-add-exercise": {
      const container = $("#wtExercises");
      if (!container) break;
      const i = container.children.length;
      container.insertAdjacentHTML(
        "beforeend",
        wsExerciseRow({ name: "", sets: 3, reps: 8, weight: 0 }, i)
      );
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
      logActivity();
      saveState();
      closeModal();
      refresh();
      toast("Session saved");
      maybeAwardMilestones();
      break;
    }
    case "wkt-save": {
      const exercises = readExerciseRows("#wtExercises");
      const wid = $("#wtId").value;
      const name = $("#wtName").value.trim() || "Untitled";
      if (wid) {
        const i = s.workouts.customTemplates.findIndex((x) => x.id === wid);
        if (i >= 0) s.workouts.customTemplates[i] = { id: wid, name, exercises };
        else s.workouts.customTemplates.push({ id: uid(), name, exercises });
      } else {
        s.workouts.customTemplates.push({ id: uid(), name, exercises });
      }
      saveState();
      closeModal();
      refresh();
      toast("Template saved");
      break;
    }
    case "wk-save-target": {
      const v = +$("#wkTarget").value || 4;
      s.workouts.weeklyTarget = v;
      saveState();
      renderView();
      toast("Saved");
      break;
    }

    /* ---------- Weight ---------- */
    case "open-weight":
      activeTab = "weight";
      render();
      break;
    case "wt-log":
      openWeightLog();
      break;
    case "wt-save": {
      const w = +$("#wWeight").value;
      if (!w) { toast("Enter a weight"); break; }
      s.weight.entries.push({
        id: uid(),
        weight: w,
        date: $("#wDate").value,
        note: $("#wNote") ? $("#wNote").value.trim() : ""
      });
      logActivity();
      saveState();
      closeModal();
      refresh();
      toast("Logged");
      maybeAwardMilestones();
      break;
    }
    case "wt-unit": {
      s.weight.unit = id;
      saveState();
      renderView();
      break;
    }
    case "wt-save-goal": {
      s.weight.goal = +$("#wtGoal").value || null;
      saveState();
      renderView();
      toast("Saved");
      break;
    }

    /* ---------- Theme / a11y / layout ---------- */
    case "open-theme":
      openThemePicker();
      break;
    case "set-theme": {
      s.settings.theme = id;
      saveState();
      applyTheme(id);
      closeModal();
      render();
      toast("Theme: " + id);
      break;
    }
    case "open-a11y":
      openA11yPicker();
      break;
    case "set-a11y": {
      s.settings.a11y = id;
      saveState();
      applyA11y(id);
      closeModal();
      render();
      toast("Accessibility: " + id);
      break;
    }
    case "open-layout":
      openLayoutPicker();
      break;
    case "set-layout": {
      s.settings.todayLayout = id;
      saveState();
      closeModal();
      render();
      toast("Layout: " + id);
      break;
    }

    /* ---------- Records / recap ---------- */
    case "open-records":
      openRecords();
      break;
    case "view-recap":
      openRecap();
      render();
      break;
    case "dismiss-recap": {
      import("./state.js").then(({ markRecapSeen }) => {
        markRecapSeen();
        saveState();
        render();
      });
      break;
    }
    case "recap-share": {
      const stats = lastWeekStats();
      const text =
        `Success Grid — Weekly Recap\n\n` +
        `Readiness: ${readiness()}% (${stats.deltaReadiness >= 0 ? "+" : ""}${stats.deltaReadiness}%)\n` +
        `Actions: ${stats.actions}\n` +
        `Hours logged: ${stats.hours.toFixed(1)}h\n` +
        `Top pillar: ${stats.topPillar?.title || "—"}`;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => toast("Recap copied"))
          .catch(() => { fallbackCopy(text); toast("Recap copied"); });
      } else {
        fallbackCopy(text);
        toast("Recap copied");
      }
      break;
    }

    /* ---------- Customize ---------- */
    case "open-customize":
      openCustomize();
      break;
    case "open-ai":
      openAI();
      break;
    case "save-meta": {
      const logoEl = $("#metaLogo");
      const titleEl = $("#metaTitle");
      const mainEl = $("#metaMain");
      const noteEl = $("#metaMainNote");
      s.meta.logo = (logoEl?.value || "").trim() || "🎯";
      s.meta.title = (titleEl?.value || "").trim() || "Success Grid";
      s.meta.mainGoal = (mainEl?.value || "").trim() || DEFAULT_MAIN_GOAL;
      s.meta.mainGoalNote = (noteEl?.value || "").trim();
      saveState();
      render();
      toast("Saved");
      break;
    }
    case "save-daily-budget": {
      const el2 = $("#dailyBudget");
      s.settings.dailyBudget = Math.max(0, +(el2?.value || 0));
      saveState();
      renderView();
      toast("Saved");
      break;
    }

    /* ---------- Subtasks ---------- */
    case "add-subtask": {
      const inp = $("#newSubtask");
      const title = (inp?.value || "").trim();
      if (!title) break;
      const g = s.goals[id];
      if (!g) break;
      g.subtasks.push({ id: uid(), title, done: false });
      if (g.autoSync) {
        g.progress = Math.round(
          (g.subtasks.filter((x) => x.done).length / g.subtasks.length) * 100
        );
      }
      logActivity();
      saveState();
      refresh();
      openGoal(id, { focus: true });
      break;
    }
    case "del-subtask": {
      const gid = Object.keys(s.goals).find((k) =>
        s.goals[k].subtasks?.some((x) => x.id === id)
      );
      if (!gid) break;
      const g = s.goals[gid];
      g.subtasks = g.subtasks.filter((x) => x.id !== id);
      if (g.autoSync && g.subtasks.length) {
        g.progress = Math.round(
          (g.subtasks.filter((x) => x.done).length / g.subtasks.length) * 100
        );
      }
      logActivity();
      saveState();
      refresh();
      openGoal(gid);
      break;
    }

    /* ---------- AI prompt ---------- */
    case "copy-prompt": {
      const pre = $("#promptPre");
      if (!pre) break;
      const text = pre.textContent;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => toast("Prompt copied"))
          .catch(() => { fallbackCopy(text); toast("Prompt copied"); });
      } else {
        fallbackCopy(text);
        toast("Prompt copied");
      }
      break;
    }
    case "import-ai-json": {
      const raw = $("#aiJsonIn").value.trim();
      if (!raw) { toast("Paste JSON first"); break; }
      try {
        const clean = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
        const parsed = JSON.parse(clean);
        const next = normalize(
          Object.assign(defaultState(s.user.name), parsed, { user: s.user })
        );
        setState(next);
        saveState();
        closeModal();
        render();
        toast("Grid built!");
      } catch (err) {
        toast("Couldn't read that JSON");
      }
      break;
    }

    /* ---------- Data ---------- */
    case "export":
      exportData();
      break;
    case "import":
      importData();
      break;
    case "reset":
      if (!confirm("Reset ALL data? This cannot be undone.")) break;
      setState(defaultState(s.user.name, "", s.user.goalType));
      saveState();
      render();
      toast("Reset");
      break;
  }
});

/* ============================================================
   READ EXERCISE ROWS (helper used by workout save actions)
   ============================================================ */
function readExerciseRows(containerSel) {
  const rows = document.querySelectorAll(`${containerSel} [data-ws-row]`);
  const out = [];
  rows.forEach((row) => {
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

/* ============================================================
   SWIPE NAVIGATION
   ============================================================ */
const TAB_ORDER = ["today", "grid", "plan", "more"];

function currentMainTab() {
  return SUB_VIEWS.includes(activeTab) ? "more" : activeTab;
}

function animateTabSlide(direction) {
  const v = document.getElementById("view");
  if (!v) return;
  const cls = direction > 0 ? "tab-slide-from-right" : "tab-slide-from-left";
  v.classList.remove("tab-slide-from-right", "tab-slide-from-left");
  void v.offsetWidth;
  v.classList.add(cls);
  const onEnd = () => {
    v.classList.remove(cls);
    v.removeEventListener("animationend", onEnd);
  };
  v.addEventListener("animationend", onEnd);
}

function goToAdjacentTab(direction) {
  const idx = TAB_ORDER.indexOf(currentMainTab());
  if (idx === -1) return;
  const nextIdx = idx + direction;
  if (nextIdx < 0 || nextIdx >= TAB_ORDER.length) return;
  vibrate(5);
  activeTab = TAB_ORDER[nextIdx];
  render();
  animateTabSlide(direction);
}

function elementAllowsSwipe(el) {
  if (!el || !el.closest) return false;
  if (el.closest(".task")) return false;
  if (
    el.closest(
      "input, textarea, select, [contenteditable='true'], [contenteditable='']"
    )
  )
    return false;
  if (el.closest(".drawer, .modal-root, .onb, .focus-root, .cmd-root"))
    return false;
  let cur = el;
  while (cur && cur !== document.body) {
    const st = getComputedStyle(cur);
    if (
      (st.overflowX === "auto" || st.overflowX === "scroll") &&
      cur.scrollWidth > cur.clientWidth
    )
      return false;
    cur = cur.parentElement;
  }
  return true;
}

const SWIPE_MIN_X = 60;
const SWIPE_MAX_OFF_AXIS = 60;
const SWIPE_MAX_TIME = 800;
let _swipeTracking = false;
let _swipeStartX = 0;
let _swipeStartY = 0;
let _swipeStartTime = 0;

document.addEventListener(
  "touchstart",
  (e) => {
    _swipeTracking = false;
    const s = getState();
    if (!s || !s.user?.onboarded) return;
    if (isModalOpen()) return;
    const app = document.getElementById("app");
    if (!app || app.hidden) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    if (!elementAllowsSwipe(t.target)) return;
    _swipeStartX = t.clientX;
    _swipeStartY = t.clientY;
    _swipeStartTime = Date.now();
    _swipeTracking = true;
  },
  { passive: true }
);

document.addEventListener(
  "touchend",
  (e) => {
    if (!_swipeTracking) return;
    _swipeTracking = false;
    if (isModalOpen()) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - _swipeStartX;
    const dy = t.clientY - _swipeStartY;
    const dt = Date.now() - _swipeStartTime;
    if (dt > SWIPE_MAX_TIME) return;
    if (Math.abs(dx) < SWIPE_MIN_X) return;
    if (Math.abs(dy) > SWIPE_MAX_OFF_AXIS) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
    goToAdjacentTab(dx < 0 ? 1 : -1);
  },
  { passive: true }
);

document.addEventListener("touchcancel", () => {
  _swipeTracking = false;
});

/* ============================================================
   INPUT HANDLING
   ============================================================ */
document.addEventListener("input", (e) => {
  const t = e.target;

  if (t.id === "searchInput") {
    const results = document.getElementById("searchResults");
    if (results) results.innerHTML = renderSearchResults(t.value);
    return;
  }

  const s = getState();
  const drawer = t.closest(".drawer");
  const gid = drawer?.dataset.goalId;

  if (t.matches("[data-goal-progress]")) {
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

  if (t.matches("[data-goal-status]")) {
    if (!gid) return;
    const g = s.goals[gid];
    if (!g) return;
    g.status = t.value;
    if (t.value === "Completed") g.progress = 100;
    if (t.value === "Not Started") g.progress = 0;
    logActivity();
    saveState();
    refresh();
    openGoal(gid);
    maybeAwardMilestones();
    return;
  }

  if (t.matches("[data-goal-priority]")) {
    if (!gid) return;
    const g = s.goals[gid];
    if (!g) return;
    g.priority = t.value;
    saveState();
    refresh();
    openGoal(gid);
    return;
  }

  if (t.matches("[data-goal-date]")) {
    if (!gid) return;
    const g = s.goals[gid];
    if (!g) return;
    g.targetDate = t.value;
    saveState();
    return;
  }

  if (t.matches("[data-goal-notes]")) {
    if (!gid) return;
    const g = s.goals[gid];
    if (!g) return;
    g.notes = t.value;
    saveState();
    return;
  }

  if (t.matches("[data-goal-sync]")) {
    if (!gid) return;
    const g = s.goals[gid];
    if (!g) return;
    g.autoSync = t.checked;
    if (t.checked) {
      g.progress = g.subtasks.length
        ? Math.round(
            (g.subtasks.filter((x) => x.done).length / g.subtasks.length) * 100
          )
        : 0;
    }
    logActivity();
    saveState();
    refresh();
    openGoal(gid);
    return;
  }

  if (t.matches("[data-action='toggle-subtask']")) {
    if (!gid) return;
    const g = s.goals[gid];
    if (!g) return;
    const x = g.subtasks.find((y) => y.id === t.dataset.id);
    if (!x) return;
    x.done = t.checked;
    if (g.subtasks.length) {
      g.progress = Math.round(
        (g.subtasks.filter((y) => y.done).length / g.subtasks.length) * 100
      );
    }
    if (g.progress >= 100) g.status = "Completed";
    else if (g.progress === 0) g.status = "Not Started";
    else if (g.status !== "Needs Review") g.status = "In Progress";

    logActivity();
    saveState();

    const { pillar } = findGoal(gid);
    const pillarDone = pillar && checkPillarCompletion(pillar.id);

    refresh();
    openGoal(gid);

    if (pillarDone) {
      celebrate("huge");
      toast("Pillar complete");
    } else if (g.progress >= 100) {
      celebrate("small");
      toast("Goal complete!");
    } else {
      vibrate(10);
    }
    maybeAwardMilestones();
    return;
  }

  if (t.matches("[data-tl]")) {
    const m = t.dataset.tl;
    const i = +t.dataset.i;
    if (!s.timeline[m]) s.timeline[m] = { items: [] };
    s.timeline[m].items[i] = t.checked;
    logActivity();
    saveState();
    renderView();

    const tl = s.timeline[m];
    if (tl.items.length && tl.items.every(Boolean)) {
      celebrate("big");
      toast("Month complete");
    }
    maybeAwardMilestones();
    return;
  }

  if (t.matches("[data-wk-log]")) {
    const cat = t.dataset.wkLog;
    s.weekly.logged[cat] = Math.max(0, +t.value || 0);
    logActivity();
    saveState();
    return;
  }
  if (t.matches("[data-wk-target]")) {
    const cat = t.dataset.wkTarget;
    s.weekly.targets[cat] = Math.max(0, +t.value || 0);
    saveState();
    return;
  }
  if (t.matches("[data-dsa-target]")) {
    const topic = t.dataset.dsaTarget;
    s.dsa.targets[topic] = Math.max(0, +t.value || 0);
    saveState();
    return;
  }

  if (t.matches("[data-pillar]")) {
    const pi = +t.dataset.pillar;
    const p = s.pillars[pi];
    if (!p) return;
    p[t.dataset.f] = t.value;
    saveState();
    return;
  }
});

/* ============================================================
   INLINE EDIT
   ============================================================ */
document.addEventListener("focusout", (e) => {
  const t = e.target;
  if (!t.matches("[data-action='inline-edit']")) return;
  const s = getState();
  const scope = t.dataset.scope;
  const text = t.textContent.trim();

  if (scope === "rm-month") {
    const old = t.dataset.id;
    const r = s.roadmap.find((x) => x.m === old);
    if (!r) return;
    if (r.m === text) return;
    if (s.roadmap.some((x) => x.m === text)) {
      toast("Name exists");
      t.textContent = old;
      return;
    }
    s.timeline[text] = s.timeline[old] || { items: [] };
    delete s.timeline[old];
    r.m = text;
    t.dataset.id = text;
    saveState();
  } else if (scope === "rm-focus") {
    const r = s.roadmap.find((x) => x.m === t.dataset.id);
    if (r) {
      r.focus = text;
      saveState();
    }
  } else if (scope === "rm-item") {
    const r = s.roadmap.find((x) => x.m === t.dataset.id);
    const i = +t.dataset.i;
    if (r && r.items[i] != null) {
      r.items[i] = text;
      saveState();
    }
  }
});

/* ============================================================
   KEYBOARD
   ============================================================ */
document.addEventListener("keydown", (e) => {
  // Cmd/Ctrl + K → command palette
  if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
    e.preventDefault();
    openCommandPalette();
    return;
  }

  if (e.key === "Escape" && isModalOpen()) closeModal();

  if (e.key === "Enter") {
    if (e.target.id === "newSubtask") {
      e.preventDefault();
      const btn = document.querySelector("[data-action='add-subtask']");
      if (btn) btn.click();
    }
    if (e.target.matches("[contenteditable]")) {
      e.preventDefault();
      e.target.blur();
    }
  }
});

window.addEventListener("popstate", () => {
  if (isModalOpen()) closeModal(false);
});

/* ============================================================
   SAVE / VISIBILITY / MIDNIGHT
   ============================================================ */
window.addEventListener("beforeunload", saveStateNow);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    saveStateNow();
    return;
  }
  if (!isModalOpen() && todayISO() !== lastRenderDate) {
    render();
  }
});

setInterval(() => {
  if (todayISO() !== lastRenderDate && !isModalOpen()) render();
}, 30000);

/* ============================================================
   BOOT — click bindings for buttons without data-action
   ============================================================ */
const searchBtnEl = document.getElementById("searchBtn");
if (searchBtnEl) searchBtnEl.addEventListener("click", () => openSearch());

const fabBtnEl = document.getElementById("fabBtn");
if (fabBtnEl) fabBtnEl.addEventListener("click", () => openQuickAdd());

const tabbarEl = document.getElementById("tabbar");
if (tabbarEl) {
  tabbarEl.addEventListener("click", (e) => {
    const b = e.target.closest(".tab");
    if (!b) return;
    activeTab = b.dataset.tab;
    render();
  });
}

async function boot() {
  loadState();

  const isReturningUser = getState() && getState().user?.onboarded;

  if (isReturningUser) {
    const app = $("#app");
    if (app) app.hidden = false;
    renderSkeleton();
  }

  await initAuth();

  if (!isReturningUser) {
    showOnboarding();
  } else {
    render();
    // Catch-up: award milestones silently recorded before this version
    maybeAwardMilestones();
  }
}

/* ============================================================
   MOBILE-FIRST UX — Swipe-to-Action & Pull-to-Sync
   ============================================================ */
let swipeTarget = null;
let swipeStartX = 0;
let swipeStartY = 0;
let swipeDx = 0;

document.addEventListener(
  "touchstart",
  (e) => {
    const task = e.target.closest(".task");
    if (!task) return;
    swipeTarget = task;
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
    swipeDx = 0;
  },
  { passive: true }
);

document.addEventListener(
  "touchmove",
  (e) => {
    if (!swipeTarget) return;
    const dx = e.touches[0].clientX - swipeStartX;
    const dy = e.touches[0].clientY - swipeStartY;
    if (Math.abs(dy) > Math.abs(dx)) {
      swipeTarget = null;
      return;
    }
    e.preventDefault();
    swipeDx = dx;
    swipeTarget.style.transform = `translateX(${dx}px)`;
    swipeTarget.style.transition = "none";
    if (dx > 0) {
      swipeTarget.classList.add("swiping-right");
      swipeTarget.classList.remove("swiping-left");
    } else if (dx < 0) {
      swipeTarget.classList.add("swiping-left");
      swipeTarget.classList.remove("swiping-right");
    }
  },
  { passive: false }
);

document.addEventListener(
  "touchend",
  () => {
    if (!swipeTarget) return;
    const task = swipeTarget;
    const dx = swipeDx;
    task.style.transition = "transform 0.2s ease, background 0.2s ease";
    task.style.transform = "";
    task.classList.remove("swiping-right", "swiping-left");
    swipeTarget = null;

    if (dx > 60) {
      vibrate(10);
      const btn = task.querySelector("[data-action='quick-check']");
      if (btn) btn.click();
    }
  },
  { passive: true }
);

let ptrStartY = 0;
let ptrActive = false;
const spinner = document.getElementById("ptr-spinner");

document.addEventListener(
  "touchstart",
  (e) => {
    if (window.scrollY <= 0 && e.touches.length === 1 && spinner) {
      ptrStartY = e.touches[0].clientY;
      ptrActive = true;
    }
  },
  { passive: true }
);

document.addEventListener(
  "touchmove",
  (e) => {
    if (!ptrActive || !spinner) return;
    const dy = e.touches[0].clientY - ptrStartY;
    if (dy > 0) {
      e.preventDefault();
      const pull = Math.min(dy * 0.5, 80);
      spinner.style.top = `${-50 + pull}px`;
      if (dy > 120) spinner.classList.add("active");
    }
  },
  { passive: false }
);

document.addEventListener(
  "touchend",
  (e) => {
    if (!ptrActive || !spinner) return;
    ptrActive = false;
    const dy = e.changedTouches[0].clientY - ptrStartY;
    spinner.style.top = "-50px";
    if (dy > 120 && spinner.classList.contains("active")) {
      spinner.classList.remove("active");
      pushNow().then(() => toast("Synced to cloud"));
    }
  },
  { passive: true }
);

/* ============================================================
   RESIZE — refresh stats panel visibility
   ============================================================ */
let _resizeTimer = null;
window.addEventListener("resize", () => {
  if (_resizeTimer) clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    renderStatsPanelIfDesktop();
  }, 120);
});

/* ============================================================
   GO
   ============================================================ */
boot();