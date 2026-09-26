import { iso, todayISO, mondayOf } from "./utils.js";

export const KEY = "success-grid-v6";
const OLD_KEYS = ["success-grid-v5", "success-grid-v4"];
export const DEFAULT_MAIN_GOAL = "🎯 Your main goal";

export const PILLAR_COLORS = ["#5B8DEF","#8E4EC6","#06B6D4","#14B8A6","#F59E0B","#EC4899","#30A46C","#6366F1"];
export const STAGE_NAMES = ["LEARN","PRACTICE","BUILD","PROVE","PREPARE","APPLY","INTERVIEW","IMPROVE"];
export const DSA_TOPICS = ["Arrays","Strings","Hashmaps","Two Pointers","Sliding Window","Stacks","Queues","Linked Lists","Trees","Graphs","DP","Recursion","Sorting","Binary Search","Heaps","Tries"];
export const DSA_DIFFICULTIES = ["Easy","Medium","Hard"];
export const DSA_STATUSES = ["Solved","Struggled","Hint used","Failed"];

export const DEFAULT_TEMPLATES = [
  { id:"push", name:"Push Day", exercises:[
    { name:"Bench Press", sets:4, reps:8, weight:0 },
    { name:"Incline DB Press", sets:3, reps:10, weight:0 },
    { name:"Overhead Press", sets:3, reps:8, weight:0 },
    { name:"Triceps Pushdown", sets:3, reps:12, weight:0 }
  ]},
  { id:"pull", name:"Pull Day", exercises:[
    { name:"Deadlift", sets:3, reps:5, weight:0 },
    { name:"Barbell Row", sets:4, reps:8, weight:0 },
    { name:"Lat Pulldown", sets:3, reps:10, weight:0 },
    { name:"Bicep Curl", sets:3, reps:12, weight:0 }
  ]},
  { id:"legs", name:"Leg Day", exercises:[
    { name:"Squat", sets:4, reps:6, weight:0 },
    { name:"Romanian Deadlift", sets:3, reps:8, weight:0 },
    { name:"Leg Press", sets:3, reps:10, weight:0 },
    { name:"Calf Raise", sets:4, reps:15, weight:0 }
  ]}
];

function emptyPillar(i){
  const id = "pillar" + (i + 1);
  return {
    id, title:`PILLAR ${i+1}`, short:"P"+(i+1),
    color: PILLAR_COLORS[i % 8], w: 1.0,
    tagline: "Define what this pillar means for your goal.",
    goals: Array.from({length:8}, (_, g) => ({
      id:`${id}_g${g+1}`, t:`Goal ${g+1}`, d:"Describe this goal.",
      p:"Medium", td: todayISO(), st:["Subtask 1","Subtask 2"], seed:0
    }))
  };
}

export function defaultState(userName="", mainGoal="", goalType="career"){
  const pillars = Array.from({length:8}, (_,i) => emptyPillar(i));
  const goals = {};
  pillars.forEach(p => p.goals.forEach(g => {
    goals[g.id] = {
      progress:0, status:"Not Started", priority:g.p,
      targetDate:g.td, notes:"", autoSync:false,
      subtasks: g.st.map((s,i) => ({ id:`${g.id}_s${i}`, title:s, done:false }))
    };
  }));
  return {
    version: 6,
    user: { name: userName, goalType, onboarded: true },
    meta: {
      logo:"🎯", title:"Success Grid",
      subtitle: mainGoal ? mainGoal.slice(0,60) : "Your goal · 9 × 9",
      mainGoal: mainGoal || DEFAULT_MAIN_GOAL,
      mainGoalNote: mainGoal ? "" : "Define your goal window, location, and target type here.",
      flow:"Learn → Practice → Build → Prove → Prepare → Apply → Interview → Improve → Achieve",
      focusChips:[{label:"Track 1",pct:60},{label:"Track 2",pct:25},{label:"Track 3",pct:15}]
    },
    pillars,
    stages: Array.from({length:8}, (_,i) => ({
      name: STAGE_NAMES[i],
      src:[`pillar${i+1}`],
      desc:"Describe what this stage means."
    })),
    roadmap: [
      { m:"Month 1", focus:"Foundations", items:["Action item 1","Action item 2","Action item 3"] },
      { m:"Month 2", focus:"Building", items:["Action item 1","Action item 2"] },
      { m:"Month 3", focus:"Shipping", items:["Action item 1","Action item 2"] }
    ],
    goals,
    projects: [],
    applications: [],
    timeline: {},
    weekly: { weekStart: mondayOf(new Date()), targets:{ "Deep work":5, "Practice":4, "Project":5, "Review":2 }, logged:{} },
    activity: {},
    settings: { theme:"deep", viewMode:"map", dailyBudget:3, dailyLogged:{} },
    tabs: [
      { id:"today", label:"Today" }, { id:"grid", label:"Grid" }, { id:"plan", label:"Plan" },
      { id:"track", label:"Track" }, { id:"more", label:"More" }
    ],
    aiPrompt: { mainGoal:"", skillLevel:"", timeAvailable:"", deadline:"", constraints:"", priorities:"" },
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
    weight: { unit:"kg", goal: null, entries: [] }
  };
}

export function normalize(s){
  const d = defaultState(s?.user?.name, s?.meta?.mainGoal, s?.user?.goalType);
  const out = Object.assign({}, d, s || {});
  out.user = Object.assign({ name:"", goalType:"career", onboarded:false }, d.user, s?.user || {});
  out.meta = Object.assign({}, d.meta, s?.meta || {});

  if (!Array.isArray(out.pillars) || !out.pillars.length) out.pillars = d.pillars;
  while (out.pillars.length < 8) out.pillars.push(emptyPillar(out.pillars.length));
  out.pillars = out.pillars.slice(0, 8);
  out.pillars.forEach(p => {
    if (!Array.isArray(p.goals)) p.goals = [];
    while (p.goals.length < 8){
      const i = p.goals.length;
      p.goals.push({ id:`${p.id}_g${i+1}`, t:`Goal ${i+1}`, d:"Describe this goal.", p:"Medium", td:todayISO(), st:["Subtask 1","Subtask 2"], seed:0 });
    }
    p.goals = p.goals.slice(0, 8);
  });

  if (!Array.isArray(out.stages) || out.stages.length < 8) out.stages = d.stages;
  out.stages = out.stages.slice(0,8).map((st, i) => ({
    name: st?.name || STAGE_NAMES[i] || `STAGE ${i+1}`,
    src: Array.isArray(st?.src) && st.src.length ? st.src : [`pillar${i+1}`],
    desc: st?.desc || ""
  }));

  if (!Array.isArray(out.roadmap)) out.roadmap = d.roadmap;
  out.goals = Object.assign({}, d.goals, s?.goals || {});
  out.pillars.forEach(p => p.goals.forEach(g => {
    out.goals[g.id] = Object.assign({}, {
      progress:0, status:"Not Started", priority:g.p || "Medium",
      targetDate:g.td || todayISO(), notes:"", autoSync:false,
      subtasks: (g.st || []).map((st,i) => ({ id:`${g.id}_s${i}`, title:st, done:false }))
    }, out.goals[g.id] || {});
    if (!Array.isArray(out.goals[g.id].subtasks)) out.goals[g.id].subtasks = [];
  }));

  if (!Array.isArray(out.projects)) out.projects = [];
  if (!Array.isArray(out.applications)) out.applications = [];
  if (!out.timeline) out.timeline = {};
  out.roadmap.forEach(r => {
    if (!out.timeline[r.m]) out.timeline[r.m] = { items:(r.items || []).map(() => false) };
    if (!Array.isArray(out.timeline[r.m].items)) out.timeline[r.m].items = [];
    while (out.timeline[r.m].items.length < (r.items || []).length) out.timeline[r.m].items.push(false);
  });

  if (!out.weekly) out.weekly = d.weekly;
  if (!out.weekly.targets) out.weekly.targets = d.weekly.targets;
  if (!out.weekly.logged) out.weekly.logged = {};
  if (!out.activity) out.activity = {};
  out.settings = Object.assign({}, d.settings, s?.settings || {});
  if (!["deep","sunset","neon"].includes(out.settings.theme)) out.settings.theme = "deep";
  if (!out.settings.dailyLogged || typeof out.settings.dailyLogged !== "object") out.settings.dailyLogged = {};
  if (!Array.isArray(out.tabs) || !out.tabs.length) out.tabs = d.tabs;
  if (!out.aiPrompt) out.aiPrompt = d.aiPrompt;

  if (!out.dsa) out.dsa = d.dsa;
  if (!Array.isArray(out.dsa.problems)) out.dsa.problems = [];
  if (!out.dsa.targets) out.dsa.targets = d.dsa.targets;

  if (!out.workouts) out.workouts = d.workouts;
  if (!Array.isArray(out.workouts.customTemplates)) out.workouts.customTemplates = [];
  if (!Array.isArray(out.workouts.sessions)) out.workouts.sessions = [];
  if (typeof out.workouts.weeklyTarget !== "number") out.workouts.weeklyTarget = 4;

  if (!out.weight) out.weight = d.weight;
  if (!Array.isArray(out.weight.entries)) out.weight.entries = [];
  if (!["kg","lbs"].includes(out.weight.unit)) out.weight.unit = "kg";

  return out;
}

let _state = null;
export function getState(){ return _state; }
export function setState(s){ _state = s; }
export function loadState(){
  try {
    const raw = localStorage.getItem(KEY);
    if (raw){ _state = normalize(JSON.parse(raw)); return; }
    for (const k of OLD_KEYS){
      const old = localStorage.getItem(k);
      if (old){
        try {
          const o = JSON.parse(old);
          _state = normalize(Object.assign(defaultState(), o));
          _state.user.onboarded = false;
          return;
        } catch(e){}
      }
    }
    _state = null;
  } catch(e){ _state = null; }
}
export function saveState(){
  try { localStorage.setItem(KEY, JSON.stringify(_state)); }
  catch(e){ console.warn("Save failed", e); }
}

export function findGoal(id){
  const s = getState();
  for (const p of s.pillars){
    const g = (p.goals || []).find(x => x.id === id);
    if (g) return { pillar: p, goal: g };
  }
  return {};
}
export function effectiveProgress(id){
  const s = getState();
  const g = s.goals[id];
  if (!g) return 0;
  if (g.autoSync && g.subtasks.length){
    return Math.round(g.subtasks.filter(x => x.done).length / g.subtasks.length * 100);
  }
  return Math.max(0, Math.min(100, +g.progress || 0));
}
export function pillarProgress(p){
  if (!p.goals || !p.goals.length) return 0;
  return Math.round(p.goals.reduce((a, g) => a + effectiveProgress(g.id), 0) / p.goals.length);
}
export function stageProgress(s){
  if (!s.src || !s.src.length) return 0;
  const s_ = getState();
  const vals = s.src.map(pid => {
    const p = s_.pillars.find(x => x.id === pid);
    return p ? pillarProgress(p) : 0;
  });
  return Math.round(vals.reduce((a,b) => a+b, 0) / vals.length);
}
export function readiness(){
  const s = getState();
  let total = 0, wsum = 0;
  s.pillars.forEach(p => { const w = +p.w || 1; total += pillarProgress(p) * w; wsum += w; });
  return wsum ? Math.round(total / wsum) : 0;
}
export function streak(){
  const s = getState();
  const a = s.activity;
  let n = 0; const d = new Date();
  if (!a[iso(d)]) d.setDate(d.getDate() - 1);
  while (a[iso(d)]){ n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function logActivity(n=1){
  const s = getState();
  const k = todayISO();
  s.activity[k] = (s.activity[k] || 0) + n;
}
export function todaysBudget(){
  const s = getState();
  const k = todayISO();
  return { logged: +(s.settings.dailyLogged[k] || 0), target: +(s.settings.dailyBudget || 3) };
}
export function nextUpTasks(limit=3){
  const s = getState();
  const open = [];
  s.pillars.forEach(p => (p.goals || []).forEach(g => {
    const st = s.goals[g.id];
    if (!st || st.status === "Completed" || effectiveProgress(g.id) >= 100) return;
    const days = (function(dstr){
      if (!dstr) return null;
      const dd = new Date(dstr);
      if (isNaN(dd.getTime())) return null;
      const a = dd.setHours(0,0,0,0);
      const b = new Date().setHours(0,0,0,0);
      return Math.round((a - b) / 86400000);
    })(st.targetDate);
    open.push({ goal:g, pillar:p, status:st, days, pri: st.priority === "High" ? 0 : st.priority === "Medium" ? 1 : 2 });
  }));
  open.sort((a, b) => {
    if (a.pri !== b.pri) return a.pri - b.pri;
    const ad = a.days == null ? 9999 : a.days;
    const bd = b.days == null ? 9999 : b.days;
    return ad - bd;
  });
  return open.slice(0, limit);
}
export function nextSubtaskFor(goalId){
  const s = getState();
  const st = s.goals[goalId];
  if (!st) return null;
  return st.subtasks.find(x => !x.done) || null;
}
export function appTotals(){
  const s = getState();
  const a = s.applications || [];
  return {
    total: a.length,
    applied: a.filter(x => !["Saved","Preparing"].includes(x.status)).length,
    interviews: a.filter(x => x.status === "Interview" || x.interview).length,
    offers: a.filter(x => x.status === "Offer").length
  };
}
export function dsaStats(){
  const s = getState();
  const problems = s.dsa.problems;
  const solved = problems.filter(p => p.status === "Solved").length;
  const total = problems.length;
  const times = problems.filter(p => p.timeMin).map(p => p.timeMin);
  const avg = times.length ? Math.round(times.reduce((a,b) => a+b, 0) / times.length) : 0;
  // DSA streak
  const days = new Set(problems.map(p => p.date));
  let st = 0; const d = new Date();
  if (!days.has(iso(d))) d.setDate(d.getDate() - 1);
  while (days.has(iso(d))){ st++; d.setDate(d.getDate() - 1); }
  return { solved, total, avg, streak: st };
}
export function workoutStats(){
  const s = getState();
  const weekStart = mondayOf(new Date());
  const sessions = s.workouts.sessions.filter(x => x.date >= weekStart);
  return { thisWeek: sessions.length, target: s.workouts.weeklyTarget, total: s.workouts.sessions.length };
}
export function weightStats(){
  const s = getState();
  const entries = [...s.weight.entries].sort((a,b) => a.date.localeCompare(b.date));
  const latest = entries[entries.length - 1];
  const previous = entries[entries.length - 2];
  const current = latest ? latest.weight : null;
  const delta = latest && previous ? +(latest.weight - previous.weight).toFixed(1) : 0;
  return { current, delta, entries, goal: s.weight.goal, unit: s.weight.unit };
}