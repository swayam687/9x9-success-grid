// js/state.js — state shape, defaults, persistence, selectors
import { iso, todayISO, mondayOf } from "./utils.js";

/* ============================================================
   CONSTANTS
   ============================================================ */
export const KEY = "success-grid-v6";
const OLD_KEYS = ["success-grid-v5", "success-grid-v4"];
export const DEFAULT_MAIN_GOAL = "🎯 Your main goal";

export const PILLAR_COLORS = [
  "#5B8DEF", "#8E4EC6", "#06B6D4", "#14B8A6",
  "#F59E0B", "#EC4899", "#30A46C", "#6366F1"
];

// Semantic function tags — how each pillar maps to a "kind of work".
// The redesign uses these to color pillars by meaning, not by index.
export const PILLAR_FNS = [
  "learning",   // blue
  "practice",   // teal
  "building",   // green
  "outreach",   // purple
  "health",     // rose
  "money",      // amber
  "craft",      // indigo
  "reflection"  // slate
];

export const STAGE_NAMES = [
  "LEARN", "PRACTICE", "BUILD", "PROVE",
  "PREPARE", "APPLY", "INTERVIEW", "IMPROVE"
];

export const DSA_TOPICS = [
  "Arrays", "Strings", "Hashmaps", "Two Pointers", "Sliding Window",
  "Stacks", "Queues", "Linked Lists", "Trees", "Graphs", "DP",
  "Recursion", "Sorting", "Binary Search", "Heaps", "Tries"
];
export const DSA_DIFFICULTIES = ["Easy", "Medium", "Hard"];
export const DSA_STATUSES = ["Solved", "Struggled", "Hint used", "Failed"];

export const DEFAULT_TEMPLATES = [
  { id: "push", name: "Push Day", exercises: [
    { name: "Bench Press", sets: 4, reps: 8, weight: 0 },
    { name: "Incline DB Press", sets: 3, reps: 10, weight: 0 },
    { name: "Overhead Press", sets: 3, reps: 8, weight: 0 },
    { name: "Triceps Pushdown", sets: 3, reps: 12, weight: 0 }
  ]},
  { id: "pull", name: "Pull Day", exercises: [
    { name: "Deadlift", sets: 3, reps: 5, weight: 0 },
    { name: "Barbell Row", sets: 4, reps: 8, weight: 0 },
    { name: "Lat Pulldown", sets: 3, reps: 10, weight: 0 },
    { name: "Bicep Curl", sets: 3, reps: 12, weight: 0 }
  ]},
  { id: "legs", name: "Leg Day", exercises: [
    { name: "Squat", sets: 4, reps: 6, weight: 0 },
    { name: "Romanian Deadlift", sets: 3, reps: 8, weight: 0 },
    { name: "Leg Press", sets: 3, reps: 10, weight: 0 },
    { name: "Calf Raise", sets: 4, reps: 15, weight: 0 }
  ]}
];

export const STREAK_MILESTONES = [7, 30, 100, 365];

/* ============================================================
   MILESTONE DEFINITIONS
   ------------------------------------------------------------
   Pure check() functions. `checkAndAwardMilestones()` returns
   the subset whose check passes for the current state AND
   which have not been earned yet. app.js writes them back.
   ============================================================ */
function countSubtasksDone(s) {
  let n = 0;
  for (const gid of Object.keys(s.goals || {})) {
    const g = s.goals[gid];
    if (!g || !Array.isArray(g.subtasks)) continue;
    for (const x of g.subtasks) if (x.done) n++;
  }
  return n;
}

function countGoalsComplete(s) {
  let n = 0;
  for (const p of s.pillars || []) {
    for (const g of p.goals || []) {
      const st = s.goals[g.id];
      if (st && (st.status === "Completed" || effectiveProgress(g.id) >= 100)) n++;
    }
  }
  return n;
}

function countPillarsComplete(s) {
  let n = 0;
  for (const p of s.pillars || []) {
    if (!p.goals || !p.goals.length) continue;
    const all = p.goals.every((g) => {
      const st = s.goals[g.id];
      return st && (st.status === "Completed" || effectiveProgress(g.id) >= 100);
    });
    if (all) n++;
  }
  return n;
}

function countMonthsComplete(s) {
  let n = 0;
  for (const r of s.roadmap || []) {
    const tl = s.timeline?.[r.m];
    if (!tl || !tl.items || !tl.items.length) continue;
    if (tl.items.every(Boolean)) n++;
  }
  return n;
}

export const MILESTONE_DEFS = [
  {
    id: "first-subtask",
    kicker: "FIRST STEP",
    title: "First subtask done",
    subtitle: "The grid is alive.",
    check: (s) => countSubtasksDone(s) >= 1
  },
  {
    id: "subtasks-10",
    kicker: "MILESTONE",
    title: "10 subtasks",
    subtitle: "Momentum is real.",
    check: (s) => countSubtasksDone(s) >= 10
  },
  {
    id: "subtasks-50",
    kicker: "MILESTONE",
    title: "50 subtasks",
    subtitle: "That's a serious body of work.",
    check: (s) => countSubtasksDone(s) >= 50
  },
  {
    id: "subtasks-100",
    kicker: "MILESTONE",
    title: "100 subtasks",
    subtitle: "Century. Nicely done.",
    check: (s) => countSubtasksDone(s) >= 100
  },
  {
    id: "subtasks-500",
    kicker: "MILESTONE",
    title: "500 subtasks",
    subtitle: "This is a practice, not a project.",
    check: (s) => countSubtasksDone(s) >= 500
  },
  {
    id: "first-goal",
    kicker: "MILESTONE",
    title: "First goal complete",
    subtitle: "A whole cell, filled.",
    check: (s) => countGoalsComplete(s) >= 1
  },
  {
    id: "goals-10",
    kicker: "MILESTONE",
    title: "10 goals complete",
    subtitle: "A tenth of the grid, closed.",
    check: (s) => countGoalsComplete(s) >= 10
  },
  {
    id: "first-pillar",
    kicker: "MILESTONE",
    title: "First pillar complete",
    subtitle: "One eighth of the grid, mastered.",
    check: (s) => countPillarsComplete(s) >= 1
  },
  {
    id: "readiness-25",
    kicker: "MILESTONE",
    title: "25% readiness",
    subtitle: "A quarter of the way there.",
    check: (s) => readiness() >= 25
  },
  {
    id: "readiness-50",
    kicker: "MILESTONE",
    title: "50% readiness",
    subtitle: "Halfway. Keep climbing.",
    check: (s) => readiness() >= 50
  },
  {
    id: "readiness-75",
    kicker: "MILESTONE",
    title: "75% readiness",
    subtitle: "Closing in.",
    check: (s) => readiness() >= 75
  },
  {
    id: "readiness-100",
    kicker: "GOAL ACHIEVED",
    title: "100% readiness",
    subtitle: "The grid is complete. That's rare.",
    check: (s) => readiness() >= 100
  },
  {
    id: "streak-7",
    kicker: "NEW PERSONAL BEST",
    title: "7-day streak",
    subtitle: "You've never done this before.",
    check: (s) => streakWithGrace() >= 7
  },
  {
    id: "streak-30",
    kicker: "NEW PERSONAL BEST",
    title: "30-day streak",
    subtitle: "A month of showing up.",
    check: (s) => streakWithGrace() >= 30
  },
  {
    id: "streak-100",
    kicker: "NEW PERSONAL BEST",
    title: "100-day streak",
    subtitle: "This is a habit now.",
    check: (s) => streakWithGrace() >= 100
  },
  {
    id: "streak-365",
    kicker: "NEW PERSONAL BEST",
    title: "365-day streak",
    subtitle: "A full year. Unbelievable.",
    check: (s) => streakWithGrace() >= 365
  },
  {
    id: "first-ship",
    kicker: "MILESTONE",
    title: "First project shipped",
    subtitle: "You built something real.",
    check: (s) => (s.projects || []).some((p) => p.status === "Completed")
  },
  {
    id: "first-offer",
    kicker: "MILESTONE",
    title: "First offer",
    subtitle: "All the work paid off.",
    check: (s) => (s.applications || []).some((a) => a.status === "Offer")
  },
  {
    id: "first-hard",
    kicker: "MILESTONE",
    title: "First hard problem solved",
    subtitle: "You didn't back down.",
    check: (s) =>
      (s.dsa?.problems || []).some(
        (p) => p.difficulty === "Hard" && p.status === "Solved"
      )
  },
  {
    id: "first-month",
    kicker: "MILESTONE",
    title: "First month complete",
    subtitle: "Every action checked.",
    check: (s) => countMonthsComplete(s) >= 1
  }
];

/* ============================================================
   DEFAULT STATE
   ============================================================ */
function emptyPillar(i) {
  const id = "pillar" + (i + 1);
  return {
    id,
    title: `PILLAR ${i + 1}`,
    short: "P" + (i + 1),
    color: PILLAR_COLORS[i % 8],
    fn: PILLAR_FNS[i % 8],
    w: 1.0,
    tagline: "Define what this pillar means for your goal.",
    goals: Array.from({ length: 8 }, (_, g) => ({
      id: `${id}_g${g + 1}`,
      t: `Goal ${g + 1}`,
      d: "Describe this goal.",
      p: "Medium",
      td: todayISO(),
      st: ["Subtask 1", "Subtask 2"],
      seed: 0
    }))
  };
}

export function defaultState(userName = "", mainGoal = "", goalType = "career") {
  const pillars = Array.from({ length: 8 }, (_, i) => emptyPillar(i));
  const goals = {};
  pillars.forEach((p) =>
    p.goals.forEach((g) => {
      goals[g.id] = {
        progress: 0,
        status: "Not Started",
        priority: g.p,
        targetDate: g.td,
        notes: "",
        autoSync: false,
        subtasks: g.st.map((s, i) => ({
          id: `${g.id}_s${i}`,
          title: s,
          done: false
        }))
      };
    })
  );
  return {
    version: 6,
    user: { name: userName, goalType, onboarded: true },
    meta: {
      logo: "🎯",
      title: "Success Grid",
      subtitle: mainGoal ? mainGoal.slice(0, 60) : "Your goal · 9 × 9",
      mainGoal: mainGoal || DEFAULT_MAIN_GOAL,
      mainGoalNote: mainGoal
        ? ""
        : "Define your goal window, location, and target type here.",
      flow:
        "Learn → Practice → Build → Prove → Prepare → Apply → Interview → Improve → Achieve",
      focusChips: [
        { label: "Track 1", pct: 60 },
        { label: "Track 2", pct: 25 },
        { label: "Track 3", pct: 15 }
      ]
    },
    pillars,
    stages: Array.from({ length: 8 }, (_, i) => ({
      name: STAGE_NAMES[i],
      src: [`pillar${i + 1}`],
      desc: "Describe what this stage means."
    })),
    roadmap: [
      {
        m: "Month 1",
        focus: "Foundations",
        items: ["Action item 1", "Action item 2", "Action item 3"]
      },
      { m: "Month 2", focus: "Building", items: ["Action item 1", "Action item 2"] },
      { m: "Month 3", focus: "Shipping", items: ["Action item 1", "Action item 2"] }
    ],
    goals,
    projects: [],
    applications: [],
    timeline: {},
    weekly: {
      weekStart: mondayOf(new Date()),
      startReadiness: 0,
      targets: { "Deep work": 5, Practice: 4, Project: 5, Review: 2 },
      logged: {}
    },
    activity: {},
    settings: {
      theme: "deep",
      a11y: "default",
      viewMode: "map",
      todayLayout: "momentum",
      dailyBudget: 3,
      dailyLogged: {}
    },
    tabs: [
      { id: "today", label: "Today" },
      { id: "grid", label: "Grid" },
      { id: "plan", label: "Plan" },
      { id: "track", label: "Track" },
      { id: "more", label: "You" }
    ],
    aiPrompt: {
      mainGoal: "",
      skillLevel: "",
      timeAvailable: "",
      deadline: "",
      constraints: "",
      priorities: ""
    },
    dsa: {
      problems: [],
      targets: {
        Arrays: 30, Strings: 25, Hashmaps: 15, "Two Pointers": 10,
        "Sliding Window": 10, Stacks: 10, Queues: 8, "Linked Lists": 15,
        Trees: 20, Graphs: 15, DP: 25, Recursion: 12,
        Sorting: 10, "Binary Search": 10, Heaps: 8, Tries: 6
      }
    },
    workouts: { customTemplates: [], sessions: [], weeklyTarget: 4 },
    weight: { unit: "kg", goal: null, entries: [] },

    // ---- NEW in the redesign ----
    milestones: { earned: {} },
    records: {},
    recap: { lastSeenWeekStart: "", lastSeenAt: "" }
  };
}

/* ============================================================
   NORMALIZE
   ============================================================ */
export function normalize(s) {
  const d = defaultState(s?.user?.name, s?.meta?.mainGoal, s?.user?.goalType);
  const out = Object.assign({}, d, s || {});
  out.user = Object.assign(
    { name: "", goalType: "career", onboarded: false },
    d.user,
    s?.user || {}
  );
  out.meta = Object.assign({}, d.meta, s?.meta || {});

  if (!Array.isArray(out.pillars) || !out.pillars.length) out.pillars = d.pillars;
  while (out.pillars.length < 8) out.pillars.push(emptyPillar(out.pillars.length));
  out.pillars = out.pillars.slice(0, 8);
  out.pillars.forEach((p, i) => {
    if (!p.fn || typeof p.fn !== "string" || !PILLAR_FNS.includes(p.fn)) {
      p.fn = PILLAR_FNS[i % 8];
    }
    if (!Array.isArray(p.goals)) p.goals = [];
    while (p.goals.length < 8) {
      const j = p.goals.length;
      p.goals.push({
        id: `${p.id}_g${j + 1}`,
        t: `Goal ${j + 1}`,
        d: "Describe this goal.",
        p: "Medium",
        td: todayISO(),
        st: ["Subtask 1", "Subtask 2"],
        seed: 0
      });
    }
    p.goals = p.goals.slice(0, 8);
  });

  if (!Array.isArray(out.stages) || out.stages.length < 8) out.stages = d.stages;
  out.stages = out.stages.slice(0, 8).map((st, i) => ({
    name: st?.name || STAGE_NAMES[i] || `STAGE ${i + 1}`,
    src:
      Array.isArray(st?.src) && st.src.length ? st.src : [`pillar${i + 1}`],
    desc: st?.desc || ""
  }));

  if (!Array.isArray(out.roadmap)) out.roadmap = d.roadmap;
  out.goals = Object.assign({}, d.goals, s?.goals || {});
  out.pillars.forEach((p) =>
    p.goals.forEach((g) => {
      out.goals[g.id] = Object.assign(
        {},
        {
          progress: 0,
          status: "Not Started",
          priority: g.p || "Medium",
          targetDate: g.td || todayISO(),
          notes: "",
          autoSync: false,
          subtasks: (g.st || []).map((st, i) => ({
            id: `${g.id}_s${i}`,
            title: st,
            done: false
          }))
        },
        out.goals[g.id] || {}
      );
      if (!Array.isArray(out.goals[g.id].subtasks)) out.goals[g.id].subtasks = [];
    })
  );

  if (!Array.isArray(out.projects)) out.projects = [];
  if (!Array.isArray(out.applications)) out.applications = [];
  if (!out.timeline) out.timeline = {};
  out.roadmap.forEach((r) => {
    if (!out.timeline[r.m])
      out.timeline[r.m] = { items: (r.items || []).map(() => false) };
    if (!Array.isArray(out.timeline[r.m].items)) out.timeline[r.m].items = [];
    while (out.timeline[r.m].items.length < (r.items || []).length)
      out.timeline[r.m].items.push(false);
  });

  if (!out.weekly) out.weekly = d.weekly;
  if (!out.weekly.targets) out.weekly.targets = d.weekly.targets;
  if (!out.weekly.logged) out.weekly.logged = {};
  if (typeof out.weekly.startReadiness !== "number") out.weekly.startReadiness = 0;
  if (!out.activity) out.activity = {};

  out.settings = Object.assign({}, d.settings, s?.settings || {});
  if (!["paper", "deep", "sunset", "neon"].includes(out.settings.theme))
    out.settings.theme = "deep";
  if (!["default", "contrast", "low-stim"].includes(out.settings.a11y))
    out.settings.a11y = "default";
  if (!["momentum", "precision", "calm"].includes(out.settings.todayLayout))
    out.settings.todayLayout = "momentum";
  if (
    !out.settings.dailyLogged ||
    typeof out.settings.dailyLogged !== "object"
  )
    out.settings.dailyLogged = {};

  if (!Array.isArray(out.tabs) || !out.tabs.length) out.tabs = d.tabs;
  if (!out.aiPrompt) out.aiPrompt = d.aiPrompt;

  if (!out.dsa) out.dsa = d.dsa;
  if (!Array.isArray(out.dsa.problems)) out.dsa.problems = [];
  if (!out.dsa.targets) out.dsa.targets = d.dsa.targets;

  if (!out.workouts) out.workouts = d.workouts;
  if (!Array.isArray(out.workouts.customTemplates))
    out.workouts.customTemplates = [];
  if (!Array.isArray(out.workouts.sessions)) out.workouts.sessions = [];
  if (typeof out.workouts.weeklyTarget !== "number")
    out.workouts.weeklyTarget = 4;

  if (!out.weight) out.weight = d.weight;
  if (!Array.isArray(out.weight.entries)) out.weight.entries = [];
  if (!["kg", "lbs"].includes(out.weight.unit)) out.weight.unit = "kg";

  // ---- Redesign additions ----
  if (!out.milestones || typeof out.milestones !== "object")
    out.milestones = { earned: {} };
  if (!out.milestones.earned || typeof out.milestones.earned !== "object")
    out.milestones.earned = {};

  if (!out.records || typeof out.records !== "object") out.records = {};

  if (!out.recap || typeof out.recap !== "object")
    out.recap = { lastSeenWeekStart: "", lastSeenAt: "" };
  if (typeof out.recap.lastSeenWeekStart !== "string")
    out.recap.lastSeenWeekStart = "";
  if (typeof out.recap.lastSeenAt !== "string") out.recap.lastSeenAt = "";

  return out;
}

/* ============================================================
   PERSISTENCE
   ============================================================ */
let _state = null;
let _saveTimer = null;
let _onSave = null;

export function getState() {
  return _state;
}
export function setState(s) {
  _state = s;
}
export function setOnSave(cb) {
  _onSave = cb;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      _state = normalize(JSON.parse(raw));
      return;
    }
    for (const k of OLD_KEYS) {
      const old = localStorage.getItem(k);
      if (old) {
        try {
          const o = JSON.parse(old);
          _state = normalize(Object.assign(defaultState(), o));
          _state.user.onboarded = false;
          return;
        } catch (e) {}
      }
    }
    _state = null;
  } catch (e) {
    _state = null;
  }
}

export function saveState() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(flushSave, 250);
}

export function saveStateNow() {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  flushSave();
}

function flushSave() {
  try {
    localStorage.setItem(KEY, JSON.stringify(_state));
    if (typeof _onSave === "function") _onSave();
  } catch (e) {
    console.warn("Save failed", e);
  }
}

/* ============================================================
   CORE SELECTORS (unchanged behavior)
   ============================================================ */
export function findGoal(id) {
  const s = getState();
  for (const p of s.pillars) {
    const g = (p.goals || []).find((x) => x.id === id);
    if (g) return { pillar: p, goal: g };
  }
  return {};
}

export function effectiveProgress(id) {
  const s = getState();
  const g = s.goals[id];
  if (!g) return 0;
  if (g.autoSync && g.subtasks.length) {
    return Math.round(
      (g.subtasks.filter((x) => x.done).length / g.subtasks.length) * 100
    );
  }
  return Math.max(0, Math.min(100, +g.progress || 0));
}

export function pillarProgress(p) {
  if (!p.goals || !p.goals.length) return 0;
  return Math.round(
    p.goals.reduce((a, g) => a + effectiveProgress(g.id), 0) / p.goals.length
  );
}

export function stageProgress(s) {
  if (!s.src || !s.src.length) return 0;
  const s_ = getState();
  const vals = s.src.map((pid) => {
    const p = s_.pillars.find((x) => x.id === pid);
    return p ? pillarProgress(p) : 0;
  });
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function readiness() {
  const s = getState();
  let total = 0,
    wsum = 0;
  s.pillars.forEach((p) => {
    const w = +p.w || 1;
    total += pillarProgress(p) * w;
    wsum += w;
  });
  return wsum ? Math.round(total / wsum) : 0;
}

export function streak() {
  const s = getState();
  const a = s.activity;
  let n = 0;
  const d = new Date();
  if (!a[iso(d)]) d.setDate(d.getDate() - 1);
  while (a[iso(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function logActivity(n = 1) {
  const s = getState();
  const k = todayISO();
  s.activity[k] = (s.activity[k] || 0) + n;
}

export function todaysBudget() {
  const s = getState();
  const k = todayISO();
  return {
    logged: +(s.settings.dailyLogged[k] || 0),
    target: +(s.settings.dailyBudget || 3)
  };
}

export function checkWeeklyReset() {
  const s = getState();
  if (!s.weekly) return false;
  // Lazy-init startReadiness on very first call after upgrade
  if (typeof s.weekly.startReadiness !== "number") {
    s.weekly.startReadiness = readiness();
  }
  const currentWeek = mondayOf(new Date());
  if (s.weekly.weekStart !== currentWeek) {
    s.weekly.weekStart = currentWeek;
    s.weekly.logged = {};
    s.weekly.startReadiness = readiness();
    return true;
  }
  return false;
}

export function nextUpTasks(limit = 3) {
  const s = getState();
  const open = [];
  s.pillars.forEach((p) =>
    (p.goals || []).forEach((g) => {
      const st = s.goals[g.id];
      if (!st || st.status === "Completed" || effectiveProgress(g.id) >= 100)
        return;
      const days = (function (dstr) {
        if (!dstr) return null;
        const dd = new Date(dstr);
        if (isNaN(dd.getTime())) return null;
        const a = dd.setHours(0, 0, 0, 0);
        const b = new Date().setHours(0, 0, 0, 0);
        return Math.round((a - b) / 86400000);
      })(st.targetDate);
      const subs = st.subtasks || [];
      const openSubs = subs.filter((x) => !x.done).length;
      open.push({
        goal: g,
        pillar: p,
        status: st,
        days,
        pri:
          st.priority === "High" ? 0 : st.priority === "Medium" ? 1 : 2,
        openSubs,
        boosted: false
      });
    })
  );

  open.sort((a, b) => {
    if (a.pri !== b.pri) return a.pri - b.pri;
    const ad = a.days == null ? 9999 : a.days;
    const bd = b.days == null ? 9999 : b.days;
    return ad - bd;
  });

  // Streak protection — same behavior as before
  const todayKey = todayISO();
  const loggedToday = +(s.activity?.[todayKey] || 0) > 0;
  const currentStreak = streak();

  if (!loggedToday && currentStreak >= 3 && open.length > 1) {
    let quickIdx = -1;
    let quickCount = Infinity;
    open.forEach((t, i) => {
      if (t.openSubs >= 1 && t.openSubs <= 2 && t.openSubs < quickCount) {
        quickCount = t.openSubs;
        quickIdx = i;
      }
    });
    if (quickIdx > 0) {
      const quick = open.splice(quickIdx, 1)[0];
      quick.boosted = true;
      open.unshift(quick);
    }
  }

  return open.slice(0, limit);
}

export function nextSubtaskFor(goalId) {
  const s = getState();
  const st = s.goals[goalId];
  if (!st) return null;
  return st.subtasks.find((x) => !x.done) || null;
}

export function appTotals() {
  const s = getState();
  const a = s.applications || [];
  return {
    total: a.length,
    applied: a.filter((x) => !["Saved", "Preparing"].includes(x.status)).length,
    interviews: a.filter((x) => x.status === "Interview" || x.interview).length,
    offers: a.filter((x) => x.status === "Offer").length
  };
}

export function dsaStats() {
  const s = getState();
  const problems = s.dsa.problems;
  const solved = problems.filter((p) => p.status === "Solved").length;
  const total = problems.length;
  const times = problems.filter((p) => p.timeMin).map((p) => p.timeMin);
  const avg = times.length
    ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    : 0;
  const days = new Set(problems.map((p) => p.date));
  let st = 0;
  const d = new Date();
  if (!days.has(iso(d))) d.setDate(d.getDate() - 1);
  while (days.has(iso(d))) {
    st++;
    d.setDate(d.getDate() - 1);
  }
  return { solved, total, avg, streak: st };
}

export function workoutStats() {
  const s = getState();
  const weekStart = mondayOf(new Date());
  const sessions = s.workouts.sessions.filter((x) => x.date >= weekStart);
  return {
    thisWeek: sessions.length,
    target: s.workouts.weeklyTarget,
    total: s.workouts.sessions.length
  };
}

export function weightStats() {
  const s = getState();
  const entries = [...s.weight.entries].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const latest = entries[entries.length - 1];
  const previous = entries[entries.length - 2];
  const current = latest ? latest.weight : null;
  const delta =
    latest && previous ? +(latest.weight - previous.weight).toFixed(1) : 0;
  return { current, delta, entries, goal: s.weight.goal, unit: s.weight.unit };
}

/* ============================================================
   NEW — STREAK WITH GRACE
   ------------------------------------------------------------
   Same as streak() but forgives exactly ONE missed day
   anywhere in the run. If two days are missed in a row,
   the streak ends.
   ============================================================ */
export function streakWithGrace() {
  const s = getState();
  const a = s.activity || {};
  const now = new Date();
  let n = 0;
  let frozen = false;
  for (let i = 0; i < 400; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = iso(d);
    if (a[k]) {
      n++;
    } else if (i === 0) {
      // Today may not have started yet — don't break on today's miss
      continue;
    } else if (!frozen) {
      frozen = true;
      continue;
    } else {
      break;
    }
  }
  return n;
}

/* ============================================================
   NEW — PROGRESS BAND (data-viz token name)
   ============================================================ */
export function progressBand(pct) {
  const p = Math.max(0, Math.min(100, +pct || 0));
  if (p >= 100) return "success";
  if (p >= 81) return "info";
  if (p >= 51) return "accent";
  if (p >= 21) return "attention";
  return "muted";
}

/* ============================================================
   NEW — PILLAR FUNCTION RESOLUTION
   ============================================================ */
export function pillarFn(pillar) {
  if (!pillar) return "reflection";
  if (pillar.fn && PILLAR_FNS.includes(pillar.fn)) return pillar.fn;
  const idx = (getState()?.pillars || []).indexOf(pillar);
  return PILLAR_FNS[Math.max(0, idx) % 8];
}

export function pillarColorVar(pillar) {
  return `var(--pillar-${pillarFn(pillar)})`;
}

/* ============================================================
   NEW — EFFORT SCORE (rolling 30-day, linear decay)
   ============================================================ */
export function effortScore() {
  const s = getState();
  const now = new Date();
  let sum = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const v = s.activity[iso(d)] || 0;
    sum += v * (1 - i / 30);
  }
  return Math.round(sum);
}

export function effortSparkline(days = 7) {
  const s = getState();
  const now = new Date();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(s.activity[iso(d)] || 0);
  }
  return out;
}

/* ============================================================
   NEW — WEEKLY DELTA & LAST-WEEK STATS
   ============================================================ */
export function weeklyDelta() {
  const s = getState();
  if (!s.weekly || typeof s.weekly.startReadiness !== "number") return 0;
  return readiness() - s.weekly.startReadiness;
}

export function lastWeekStats() {
  const s = getState();
  const thisMonday = mondayOf(new Date());
  const lastMonday = (() => {
    const d = new Date(thisMonday);
    d.setDate(d.getDate() - 7);
    return iso(d);
  })();

  // Sum actions this week from state.activity
  let actions = 0;
  for (const k of Object.keys(s.activity || {})) {
    if (k >= thisMonday) actions += s.activity[k] || 0;
  }

  // Sum hours logged this week
  let hours = 0;
  for (const cat of Object.keys(s.weekly.logged || {})) {
    hours += +s.weekly.logged[cat] || 0;
  }

  // Top pillar by delta (proxy: highest pillar progress this week)
  let topPillar = null;
  let topProg = -1;
  for (const p of s.pillars || []) {
    const prog = pillarProgress(p);
    if (prog > topProg) {
      topProg = prog;
      topPillar = p;
    }
  }

  // Readiness delta from week start snapshot
  const startReadiness = +s.weekly.startReadiness || 0;
  const deltaReadiness = readiness() - startReadiness;

  return {
    weekStart: thisMonday,
    prevWeekStart: lastMonday,
    actions,
    hours,
    topPillar,
    topPillarProgress: Math.max(0, topProg),
    deltaReadiness
  };
}

/* ============================================================
   NEW — WEEKLY RECAP GATING
   ============================================================ */
export function shouldShowRecap() {
  const s = getState();
  const now = new Date();
  // Show on Sunday (day 0) after 20:00 local, once per week
  if (now.getDay() !== 0) return false;
  if (now.getHours() < 20) return false;
  const currentMonday = mondayOf(now);
  return s.recap?.lastSeenWeekStart !== currentMonday;
}

export function markRecapSeen() {
  const s = getState();
  if (!s.recap) s.recap = { lastSeenWeekStart: "", lastSeenAt: "" };
  s.recap.lastSeenWeekStart = mondayOf(new Date());
  s.recap.lastSeenAt = new Date().toISOString();
}

/* ============================================================
   NEW — MILESTONE AWARDING
   ------------------------------------------------------------
   Returns array of milestone defs that are newly earned.
   Caller must write to s.milestones.earned[id].
   ============================================================ */
export function checkAndAwardMilestones() {
  const s = getState();
  const earned = (s.milestones && s.milestones.earned) || {};
  const newly = [];
  for (const m of MILESTONE_DEFS) {
    if (earned[m.id]) continue;
    try {
      if (m.check(s)) newly.push(m);
    } catch (e) {
      // Skip malformed checks silently
    }
  }
  return newly;
}

export function milestoneStatus() {
  const s = getState();
  const earned = (s.milestones && s.milestones.earned) || {};
  return MILESTONE_DEFS.map((m) => ({
    ...m,
    earned: Boolean(earned[m.id]),
    earnedAt: earned[m.id]?.at || ""
  }));
}

/* ============================================================
   NEW — PERSONAL RECORDS
   ------------------------------------------------------------
   Records are computed from state. `checkAndAwardRecords()`
   returns an array of { key, label, unit, prev, next, at }
   for records that were beaten.
   Caller writes back with `s.records[key] = { value, at, ... }`.
   ============================================================ */
export function computeRecords() {
  const s = getState();
  const r = {};

  // Fastest solve (min)
  const solved = (s.dsa?.problems || []).filter(
    (p) => p.status === "Solved" && +p.timeMin > 0
  );
  if (solved.length) {
    const best = solved.reduce((a, b) =>
      +a.timeMin <= +b.timeMin ? a : b
    );
    r.fastestSolve = {
      value: +best.timeMin,
      unit: "min",
      meta: best.topic || "",
      date: best.date || "",
      problemId: best.id
    };
  }

  // Most subtasks completed in a day (from activity)
  let bestDay = { value: 0, date: "" };
  for (const k of Object.keys(s.activity || {})) {
    const v = s.activity[k] || 0;
    if (v > bestDay.value) bestDay = { value: v, date: k };
  }
  if (bestDay.value > 0) r.mostActionsDay = bestDay;

  // Longest streak (current grace streak is a candidate)
  const currentStreak = streakWithGrace();
  const storedStreak = +(s.records?.longestStreak?.value || 0);
  r.longestStreak = {
    value: Math.max(currentStreak, storedStreak),
    unit: "days"
  };

  // Best week readiness
  const delta = weeklyDelta();
  const storedBest = +(s.records?.bestWeek?.value || 0);
  r.bestWeek = {
    value: Math.max(delta, storedBest),
    unit: "%"
  };

  return r;
}

export function checkAndAwardRecords() {
  const s = getState();
  const stored = s.records || {};
  const computed = computeRecords();
  const updates = [];

  const beat = (key, label, unit, higherIsBetter = true) => {
    const c = computed[key];
    if (!c) return;
    const prev = stored[key]?.value;
    if (prev == null) {
      // First time we see this record — record it silently, no overlay
      updates.push({ key, label, unit, prev: null, next: c.value, silent: true, meta: c });
      return;
    }
    const beaten = higherIsBetter ? c.value > prev : c.value < prev;
    if (beaten) {
      updates.push({ key, label, unit, prev, next: c.value, silent: false, meta: c });
    }
  };

  beat("fastestSolve", "Fastest solve", "min", false);
  beat("mostActionsDay", "Most actions in a day", "actions", true);
  beat("longestStreak", "Longest streak", "days", true);
  beat("bestWeek", "Best week delta", "%", true);

  return updates;
}

export function personalRecords() {
  const s = getState();
  const stored = s.records || {};
  return Object.keys(stored)
    .map((k) => ({ key: k, ...stored[k] }))
    .filter((x) => x.value != null);
}

/* ============================================================
   NEW — SEEDED EXAMPLE GRID (for onboarding)
   ============================================================ */
export function seededExampleGoal(goalType) {
  const examples = {
    career: {
      t: "Complete a mock interview",
      d: "Practice a 45-minute system design interview with a friend.",
      p: "High",
      st: [
        "Pick a real problem",
        "Sketch the architecture",
        "Do the mock",
        "Write up feedback"
      ]
    },
    fitness: {
      t: "Do 3 workouts this week",
      d: "Three sessions — push, pull, legs.",
      p: "Medium",
      st: ["Push day", "Pull day", "Leg day"]
    },
    other: {
      t: "Define what success looks like",
      d: "Write one sentence describing the outcome you want.",
      p: "High",
      st: ["Write a draft", "Refine with a friend", "Save the final version"]
    }
  };
  return examples[goalType] || examples.other;
}

export function applySeededExample(s, goalType) {
  const ex = seededExampleGoal(goalType);
  const p = s?.pillars?.[0];
  if (!p || !p.goals?.[0]) return s;
  const g = p.goals[0];
  g.t = ex.t;
  g.d = ex.d;
  g.p = ex.p;
  g.st = ex.st.slice();
  g.td = todayISO();
  const st = s.goals[g.id];
  if (st) {
    st.priority = ex.p;
    st.subtasks = ex.st.map((title, i) => ({
      id: `${g.id}_s${i}`,
      title,
      done: false
    }));
  }
  return s;
}