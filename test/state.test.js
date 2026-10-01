// test/state.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  defaultState,
  normalize,
  setState,
  getState,
  effectiveProgress,
  pillarProgress,
  stageProgress,
  readiness,
  streak,
  streakWithGrace,
  logActivity,
  todaysBudget,
  checkWeeklyReset,
  nextUpTasks,
  nextSubtaskFor,
  findGoal,
  appTotals,
  dsaStats,
  workoutStats,
  weightStats,
  effortScore,
  effortSparkline,
  progressBand,
  pillarFn,
  pillarColorVar,
  weeklyDelta,
  lastWeekStats,
  shouldShowRecap,
  markRecapSeen,
  checkAndAwardMilestones,
  milestoneStatus,
  computeRecords,
  checkAndAwardRecords,
  personalRecords,
  seededExampleGoal,
  applySeededExample,
  MILESTONE_DEFS,
  PILLAR_FNS
} from "../js/state.js";
import { iso, todayISO, mondayOf } from "../js/utils.js";

/* ============================================================
   Helpers
   ============================================================ */
function fresh() {
  const s = defaultState("Tester", "Land an internship", "career");
  setState(s);
  return s;
}

function dayBefore(isoStr, n) {
  const d = new Date(isoStr);
  d.setDate(d.getDate() - n);
  return iso(d);
}

beforeEach(() => {
  fresh();
});

/* ============================================================
   defaultState / normalize
   ============================================================ */
describe("defaultState", () => {
  it("returns 8 pillars with 8 goals each", () => {
    const s = defaultState();
    expect(s.pillars).toHaveLength(8);
    s.pillars.forEach((p) => expect(p.goals).toHaveLength(8));
  });

  it("returns 8 stages mapped to pillars", () => {
    const s = defaultState();
    expect(s.stages).toHaveLength(8);
    s.stages.forEach((st, i) => {
      expect(st.src).toContain(`pillar${i + 1}`);
    });
  });

  it("initialises new redesign fields", () => {
    const s = defaultState();
    expect(s.settings.a11y).toBe("default");
    expect(s.settings.todayLayout).toBe("momentum");
    expect(s.milestones.earned).toEqual({});
    expect(s.records).toEqual({});
    expect(s.recap.lastSeenWeekStart).toBe("");
    expect(typeof s.weekly.startReadiness).toBe("number");
  });

  it("assigns semantic pillar function to every pillar", () => {
    const s = defaultState();
    s.pillars.forEach((p, i) => {
      expect(p.fn).toBe(PILLAR_FNS[i]);
    });
  });

  it("uses the provided goal type", () => {
    const s = defaultState("A", "G", "fitness");
    expect(s.user.goalType).toBe("fitness");
  });
});

describe("normalize", () => {
  it("handles null input gracefully", () => {
    const out = normalize(null);
    expect(out.pillars).toHaveLength(8);
    expect(out.goals).toBeTruthy();
  });

  it("backfills missing pillars to 8", () => {
    const out = normalize({ pillars: [{ id: "pillar1", goals: [] }] });
    expect(out.pillars).toHaveLength(8);
  });

  it("trims extra pillars to 8", () => {
    const out = normalize({
      pillars: Array.from({ length: 12 }, (_, i) => ({
        id: `p${i}`,
        goals: []
      }))
    });
    expect(out.pillars).toHaveLength(8);
  });

  it("clamps invalid theme to deep", () => {
    const out = normalize({ settings: { theme: "hacker" } });
    expect(out.settings.theme).toBe("deep");
  });

  it("clamps invalid a11y to default", () => {
    const out = normalize({ settings: { a11y: "hyper" } });
    expect(out.settings.a11y).toBe("default");
  });

  it("clamps invalid todayLayout to momentum", () => {
    const out = normalize({ settings: { todayLayout: "diagonal" } });
    expect(out.settings.todayLayout).toBe("momentum");
  });

  it("preserves valid settings", () => {
    const out = normalize({
      settings: { theme: "neon", a11y: "contrast", todayLayout: "calm" }
    });
    expect(out.settings.theme).toBe("neon");
    expect(out.settings.a11y).toBe("contrast");
    expect(out.settings.todayLayout).toBe("calm");
  });

  it("initialises milestones.earned when missing", () => {
    const out = normalize({});
    expect(out.milestones.earned).toEqual({});
  });

  it("initialises recap when missing", () => {
    const out = normalize({});
    expect(typeof out.recap.lastSeenWeekStart).toBe("string");
    expect(typeof out.recap.lastSeenAt).toBe("string");
  });

  it("backfills pillar.fn from index when missing", () => {
    const out = normalize({
      pillars: [{ id: "p1", goals: [], title: "X" }]
    });
    expect(out.pillars[0].fn).toBe(PILLAR_FNS[0]);
  });

  it("preserves explicit pillar.fn", () => {
    const out = normalize({
      pillars: [
        {
          id: "p1",
          goals: [],
          title: "X",
          fn: "craft"
        }
      ]
    });
    expect(out.pillars[0].fn).toBe("craft");
  });

  it("normalises each goal to have subtasks array", () => {
    const out = normalize({
      pillars: [
        {
          id: "pillar1",
          title: "P",
          goals: [{ id: "pillar1_g1", t: "G", st: [] }]
        }
      ],
      goals: { pillar1_g1: { subtasks: null } }
    });
    expect(Array.isArray(out.goals.pillar1_g1.subtasks)).toBe(true);
  });
});

/* ============================================================
   effectiveProgress / pillarProgress / stageProgress / readiness
   ============================================================ */
describe("effectiveProgress", () => {
  it("returns 0 for an unknown goal", () => {
    expect(effectiveProgress("nope")).toBe(0);
  });

  it("returns stored progress when autoSync is off", () => {
    const s = getState();
    s.goals["pillar1_g1"].progress = 42;
    expect(effectiveProgress("pillar1_g1")).toBe(42);
  });

  it("clamps stored progress to 0..100", () => {
    const s = getState();
    s.goals["pillar1_g1"].progress = 150;
    expect(effectiveProgress("pillar1_g1")).toBe(100);
  });

  it("computes progress from subtasks when autoSync is on", () => {
    const s = getState();
    const g = s.goals["pillar1_g1"];
    g.autoSync = true;
    g.subtasks = [{ done: true }, { done: false }];
    expect(effectiveProgress("pillar1_g1")).toBe(50);
  });
});

describe("pillarProgress", () => {
  it("returns 0 for an empty pillar", () => {
    expect(pillarProgress({ goals: [] })).toBe(0);
  });

  it("averages goal progress", () => {
    const s = getState();
    // All goals are pillar1 goals; set two to known values
    s.goals["pillar1_g1"].progress = 100;
    s.goals["pillar1_g2"].progress = 0;
    // Rest are 0; average over 8 goals: 100/8 = 12.5 → 13
    const p = s.pillars[0];
    expect(pillarProgress(p)).toBe(13);
  });
});

describe("stageProgress", () => {
  it("returns 0 for a stage without sources", () => {
    expect(stageProgress({ src: [] })).toBe(0);
  });

  it("averages pillar progress for its sources", () => {
    const s = getState();
    const st = s.stages[0];
    const val = stageProgress(st);
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(100);
  });
});

describe("readiness", () => {
  it("returns 0 when nothing is started", () => {
    expect(readiness()).toBe(0);
  });

  it("returns higher value as goals complete", () => {
    const s = getState();
    // Complete one entire pillar
    for (let i = 1; i <= 8; i++) s.goals[`pillar1_g${i}`].progress = 100;
    expect(readiness()).toBeGreaterThan(0);
  });
});

/* ============================================================
   streak / streakWithGrace / logActivity
   ============================================================ */
describe("streak", () => {
  it("returns 0 with no activity", () => {
    expect(streak()).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    const s = getState();
    const t = todayISO();
    s.activity[t] = 1;
    s.activity[dayBefore(t, 1)] = 1;
    s.activity[dayBefore(t, 2)] = 1;
    expect(streak()).toBe(3);
  });

  it("counts consecutive days ending yesterday when today empty", () => {
    const s = getState();
    const t = todayISO();
    s.activity[dayBefore(t, 1)] = 1;
    s.activity[dayBefore(t, 2)] = 1;
    expect(streak()).toBe(2);
  });
});

describe("streakWithGrace", () => {
  it("returns 0 with no activity", () => {
    expect(streakWithGrace()).toBe(0);
  });

  it("forgives one missed day", () => {
    const s = getState();
    const t = todayISO();
    s.activity[t] = 1;
    // skip yesterday
    s.activity[dayBefore(t, 2)] = 1;
    // streak should be 2 (today + 2 days ago, with grace for yesterday)
    expect(streakWithGrace()).toBe(2);
  });

  it("does not forgive two consecutive missed days", () => {
    const s = getState();
    const t = todayISO();
    s.activity[t] = 1;
    // skip yesterday and 2 days ago
    s.activity[dayBefore(t, 3)] = 1;
    // streak should be 1 (only today counts)
    expect(streakWithGrace()).toBe(1);
  });

  it("counts today even if today is empty", () => {
    const s = getState();
    const t = todayISO();
    s.activity[dayBefore(t, 1)] = 1;
    s.activity[dayBefore(t, 2)] = 1;
    // today empty; yesterday+2 ago = 2
    expect(streakWithGrace()).toBe(2);
  });
});

describe("logActivity", () => {
  it("increments today's count by 1", () => {
    const s = getState();
    logActivity();
    expect(s.activity[todayISO()]).toBe(1);
  });

  it("increments by custom amount", () => {
    const s = getState();
    logActivity(5);
    expect(s.activity[todayISO()]).toBe(5);
  });

  it("stacks on existing value", () => {
    const s = getState();
    s.activity[todayISO()] = 3;
    logActivity(2);
    expect(s.activity[todayISO()]).toBe(5);
  });
});

/* ============================================================
   todaysBudget
   ============================================================ */
describe("todaysBudget", () => {
  it("returns logged and target", () => {
    const s = getState();
    s.settings.dailyBudget = 4;
    s.settings.dailyLogged[todayISO()] = 2;
    const b = todaysBudget();
    expect(b.logged).toBe(2);
    expect(b.target).toBe(4);
  });

  it("defaults logged to 0", () => {
    const b = todaysBudget();
    expect(b.logged).toBe(0);
  });
});

/* ============================================================
   checkWeeklyReset
   ============================================================ */
describe("checkWeeklyReset", () => {
  it("resets logged when week changed", () => {
    const s = getState();
    s.weekly.weekStart = "2020-01-06";
    s.weekly.logged = { "Deep work": 5 };
    const reset = checkWeeklyReset();
    expect(reset).toBe(true);
    expect(s.weekly.logged).toEqual({});
    expect(s.weekly.weekStart).toBe(mondayOf(new Date()));
  });

  it("does not reset when same week", () => {
    const s = getState();
    s.weekly.weekStart = mondayOf(new Date());
    s.weekly.logged = { "Deep work": 2 };
    const reset = checkWeeklyReset();
    expect(reset).toBe(false);
    expect(s.weekly.logged["Deep work"]).toBe(2);
  });

  it("initialises startReadiness when missing", () => {
    const s = getState();
    delete s.weekly.startReadiness;
    checkWeeklyReset();
    expect(typeof s.weekly.startReadiness).toBe("number");
  });
});

/* ============================================================
   nextUpTasks / nextSubtaskFor / findGoal
   ============================================================ */
describe("nextUpTasks", () => {
  it("returns tasks sorted by priority then days", () => {
    const s = getState();
    s.goals["pillar1_g1"].priority = "Low";
    s.goals["pillar1_g2"].priority = "High";
    const tasks = nextUpTasks(5);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].goal.id).toBe("pillar1_g2");
  });

  it("excludes completed goals", () => {
    const s = getState();
    for (let i = 1; i <= 8; i++) s.goals[`pillar1_g${i}`].status = "Completed";
    const tasks = nextUpTasks(64);
    const pillar1Goals = tasks.filter((t) => t.goal.id.startsWith("pillar1"));
    expect(pillar1Goals).toHaveLength(0);
  });

  it("respects the limit", () => {
    expect(nextUpTasks(2)).toHaveLength(2);
  });

  it("marks streak-boosted task when streak protection triggers", () => {
    const s = getState();
    const t = todayISO();
    // Build a 5-day streak (before today so today is empty)
    for (let i = 1; i <= 5; i++) s.activity[dayBefore(t, i)] = 1;
    // Make one goal have exactly 1 open subtask
    const g = s.goals["pillar1_g4"];
    g.subtasks = [
      { id: "s1", title: "Do it", done: false }
    ];
    const tasks = nextUpTasks(5);
    // The boosted one should be at index 0
    expect(tasks[0].boosted).toBe(true);
  });
});

describe("nextSubtaskFor", () => {
  it("returns the first undone subtask", () => {
    const s = getState();
    const g = s.goals["pillar1_g1"];
    g.subtasks = [
      { id: "a", title: "A", done: true },
      { id: "b", title: "B", done: false }
    ];
    const sub = nextSubtaskFor("pillar1_g1");
    expect(sub.id).toBe("b");
  });

  it("returns null when all subtasks are done", () => {
    const s = getState();
    const g = s.goals["pillar1_g1"];
    g.subtasks = [{ id: "a", title: "A", done: true }];
    expect(nextSubtaskFor("pillar1_g1")).toBe(null);
  });

  it("returns null for unknown goal", () => {
    expect(nextSubtaskFor("nope")).toBe(null);
  });
});

describe("findGoal", () => {
  it("locates a goal and its pillar", () => {
    const r = findGoal("pillar1_g1");
    expect(r.goal).toBeTruthy();
    expect(r.pillar).toBeTruthy();
    expect(r.pillar.id).toBe("pillar1");
  });

  it("returns empty object for unknown goal", () => {
    const r = findGoal("nope");
    expect(r.goal).toBeUndefined();
  });
});

/* ============================================================
   Sub-system stats
   ============================================================ */
describe("appTotals", () => {
  it("counts applications by status", () => {
    const s = getState();
    s.applications = [
      { id: "1", status: "Applied" },
      { id: "2", status: "Saved" },
      { id: "3", status: "Interview" },
      { id: "4", status: "Offer" }
    ];
    const t = appTotals();
    expect(t.total).toBe(4);
    // `applied` = everything not still in Saved/Preparing.
    // Applied + Interview + Offer = 3.
    expect(t.applied).toBe(3);
    expect(t.interviews).toBe(1);
    expect(t.offers).toBe(1);
  });
});

describe("dsaStats", () => {
  it("computes solved, total, avg time, streak", () => {
    const s = getState();
    s.dsa.problems = [
      { id: "1", name: "A", status: "Solved", timeMin: 20, date: todayISO() },
      { id: "2", name: "B", status: "Struggled", timeMin: 40, date: todayISO() }
    ];
    const st = dsaStats();
    expect(st.solved).toBe(1);
    expect(st.total).toBe(2);
    expect(st.avg).toBe(30);
    expect(st.streak).toBe(1);
  });
});

describe("workoutStats", () => {
  it("counts sessions this week", () => {
    const s = getState();
    const weekStart = mondayOf(new Date());
    s.workouts.sessions = [
      { id: "1", date: weekStart },
      { id: "2", date: "2020-01-01" }
    ];
    const st = workoutStats();
    expect(st.thisWeek).toBe(1);
    expect(st.total).toBe(2);
  });
});

describe("weightStats", () => {
  it("computes latest weight and delta", () => {
    const s = getState();
    s.weight.entries = [
      { date: "2026-01-01", weight: 70 },
      { date: "2026-01-10", weight: 69.5 }
    ];
    const st = weightStats();
    expect(st.current).toBe(69.5);
    expect(st.delta).toBe(-0.5);
  });

  it("returns null current when empty", () => {
    const st = weightStats();
    expect(st.current).toBe(null);
  });
});

/* ============================================================
   Effort score
   ============================================================ */
describe("effortScore", () => {
  it("returns 0 with no activity", () => {
    expect(effortScore()).toBe(0);
  });

  it("weights today's activity at full value", () => {
    const s = getState();
    s.activity[todayISO()] = 10;
    expect(effortScore()).toBe(10);
  });

  it("decays older activity", () => {
    const s = getState();
    const t = todayISO();
    s.activity[t] = 10;
    s.activity[dayBefore(t, 1)] = 10;
    // 10 + 10 * 29/30 = 10 + 9.667 = 19.667 → 20
    expect(effortScore()).toBe(20);
  });
});

describe("effortSparkline", () => {
  it("returns default 7 entries", () => {
    const arr = effortSparkline();
    expect(arr).toHaveLength(7);
  });

  it("returns custom length", () => {
    expect(effortSparkline(14)).toHaveLength(14);
  });

  it("last entry is today", () => {
    const s = getState();
    s.activity[todayISO()] = 42;
    const arr = effortSparkline();
    expect(arr[arr.length - 1]).toBe(42);
  });
});

/* ============================================================
   progressBand / pillarFn / pillarColorVar
   ============================================================ */
describe("progressBand", () => {
  it("maps boundaries correctly", () => {
    expect(progressBand(0)).toBe("muted");
    expect(progressBand(20)).toBe("muted");
    expect(progressBand(21)).toBe("attention");
    expect(progressBand(50)).toBe("attention");
    expect(progressBand(51)).toBe("accent");
    expect(progressBand(80)).toBe("accent");
    expect(progressBand(81)).toBe("info");
    expect(progressBand(99)).toBe("info");
    expect(progressBand(100)).toBe("success");
  });

  it("clamps out-of-range values", () => {
    expect(progressBand(-5)).toBe("muted");
    expect(progressBand(150)).toBe("success");
  });
});

describe("pillarFn", () => {
  it("returns stored fn when present", () => {
    expect(pillarFn({ fn: "craft" })).toBe("craft");
  });

  it("falls back to reflection for null", () => {
    expect(pillarFn(null)).toBe("reflection");
  });

  it("falls back to first function for unknown pillar", () => {
    expect(pillarFn({})).toBe(PILLAR_FNS[0]);
  });
});

describe("pillarColorVar", () => {
  it("returns a CSS var reference", () => {
    expect(pillarColorVar({ fn: "craft" })).toBe("var(--pillar-craft)");
  });
});

/* ============================================================
   Weekly delta / lastWeekStats
   ============================================================ */
describe("weeklyDelta", () => {
  it("returns 0 when no baseline", () => {
    const s = getState();
    s.weekly.startReadiness = 0;
    expect(weeklyDelta()).toBe(0);
  });

  it("returns positive delta when readiness grows", () => {
    const s = getState();
    s.weekly.startReadiness = 0;
    for (let i = 1; i <= 8; i++) s.goals[`pillar1_g${i}`].progress = 100;
    expect(weeklyDelta()).toBeGreaterThan(0);
  });
});

describe("lastWeekStats", () => {
  it("returns a valid shape", () => {
    const stats = lastWeekStats();
    expect(stats).toHaveProperty("weekStart");
    expect(stats).toHaveProperty("prevWeekStart");
    expect(stats).toHaveProperty("actions");
    expect(stats).toHaveProperty("hours");
    expect(stats).toHaveProperty("deltaReadiness");
    expect(typeof stats.actions).toBe("number");
    expect(typeof stats.hours).toBe("number");
  });

  it("sums actions from this week", () => {
    const s = getState();
    s.activity[todayISO()] = 3;
    const stats = lastWeekStats();
    expect(stats.actions).toBeGreaterThanOrEqual(3);
  });

  it("sums hours logged across categories", () => {
    const s = getState();
    s.weekly.logged = { "Deep work": 2, Practice: 1.5 };
    const stats = lastWeekStats();
    expect(stats.hours).toBe(3.5);
  });
});

/* ============================================================
   Recap gating
   ============================================================ */
describe("shouldShowRecap", () => {
  afterEach(() => vi.useRealTimers());

  it("returns false on non-Sunday days", () => {
    // 2026-01-07 is a Wednesday
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 7, 21, 0, 0));
    expect(shouldShowRecap()).toBe(false);
  });

  it("returns false before 20:00 on Sunday", () => {
    // 2026-01-11 is a Sunday
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 11, 15, 0, 0));
    expect(shouldShowRecap()).toBe(false);
  });

  it("returns true on Sunday after 20:00 when not seen", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 11, 21, 0, 0));
    expect(shouldShowRecap()).toBe(true);
  });

  it("returns false after being seen", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 11, 21, 0, 0));
    markRecapSeen();
    expect(shouldShowRecap()).toBe(false);
  });
});

/* ============================================================
   Milestones
   ============================================================ */
describe("milestoneStatus", () => {
  it("returns all milestone definitions", () => {
    const statuses = milestoneStatus();
    expect(statuses).toHaveLength(MILESTONE_DEFS.length);
  });

  it("marks earned flag correctly", () => {
    const s = getState();
    s.milestones.earned["first-subtask"] = { at: new Date().toISOString() };
    const statuses = milestoneStatus();
    const first = statuses.find((m) => m.id === "first-subtask");
    expect(first.earned).toBe(true);
  });
});

describe("checkAndAwardMilestones", () => {
  it("returns first-subtask after one subtask done", () => {
    const s = getState();
    s.goals["pillar1_g1"].subtasks[0].done = true;
    const newly = checkAndAwardMilestones();
    expect(newly.some((m) => m.id === "first-subtask")).toBe(true);
  });

  it("skips already-earned milestones", () => {
    const s = getState();
    s.milestones.earned["first-subtask"] = { at: new Date().toISOString() };
    s.goals["pillar1_g1"].subtasks[0].done = true;
    const newly = checkAndAwardMilestones();
    expect(newly.some((m) => m.id === "first-subtask")).toBe(false);
  });

  it("returns streak-7 after seven-day grace streak", () => {
    const s = getState();
    const t = todayISO();
    for (let i = 0; i < 7; i++) s.activity[dayBefore(t, i)] = 1;
    const newly = checkAndAwardMilestones();
    expect(newly.some((m) => m.id === "streak-7")).toBe(true);
  });
});

/* ============================================================
   Records
   ============================================================ */
describe("computeRecords", () => {
  it("computes fastest solve from DSA problems", () => {
    const s = getState();
    s.dsa.problems = [
      { id: "1", status: "Solved", timeMin: 45, date: todayISO(), topic: "Arrays" },
      { id: "2", status: "Solved", timeMin: 12, date: todayISO(), topic: "Trees" }
    ];
    const r = computeRecords();
    expect(r.fastestSolve.value).toBe(12);
  });

  it("computes most actions day from activity", () => {
    const s = getState();
    s.activity["2026-01-01"] = 5;
    s.activity["2026-01-02"] = 12;
    const r = computeRecords();
    expect(r.mostActionsDay.value).toBe(12);
    expect(r.mostActionsDay.date).toBe("2026-01-02");
  });
});

describe("checkAndAwardRecords", () => {
  it("returns silent update for new records", () => {
    const s = getState();
    s.activity[todayISO()] = 4;
    const updates = checkAndAwardRecords();
    const dayUpdate = updates.find((u) => u.key === "mostActionsDay");
    expect(dayUpdate).toBeTruthy();
    expect(dayUpdate.silent).toBe(true);
  });

  it("returns loud update when a stored record is beaten", () => {
    const s = getState();
    s.records.mostActionsDay = { value: 3 };
    s.activity[todayISO()] = 10;
    const updates = checkAndAwardRecords();
    const dayUpdate = updates.find((u) => u.key === "mostActionsDay");
    expect(dayUpdate).toBeTruthy();
    expect(dayUpdate.silent).toBe(false);
    expect(dayUpdate.next).toBe(10);
    expect(dayUpdate.prev).toBe(3);
  });

  it("returns nothing when records are not beaten", () => {
    const s = getState();
    s.records.mostActionsDay = { value: 100 };
    s.activity[todayISO()] = 1;
    const updates = checkAndAwardRecords();
    expect(updates.find((u) => u.key === "mostActionsDay")).toBeUndefined();
  });
});

describe("personalRecords", () => {
  it("returns stored records as an array", () => {
    const s = getState();
    s.records.fastestSolve = { value: 12, unit: "min" };
    const recs = personalRecords();
    expect(recs.some((r) => r.key === "fastestSolve")).toBe(true);
  });

  it("returns empty array when no records stored", () => {
    expect(personalRecords()).toEqual([]);
  });
});

/* ============================================================
   Seeded example grid
   ============================================================ */
describe("seededExampleGoal", () => {
  it("returns a career example for career type", () => {
    const ex = seededExampleGoal("career");
    expect(ex.t).toBeTruthy();
    expect(Array.isArray(ex.st)).toBe(true);
    expect(ex.st.length).toBeGreaterThan(0);
  });

  it("returns a fitness example for fitness type", () => {
    const ex = seededExampleGoal("fitness");
    expect(ex.t).toBeTruthy();
  });

  it("falls back to other for unknown type", () => {
    const ex = seededExampleGoal("unknown");
    expect(ex.t).toBeTruthy();
  });
});

describe("applySeededExample", () => {
  it("mutates the first goal with the seed", () => {
    const s = defaultState("A", "G", "career");
    applySeededExample(s, "career");
    const first = s.pillars[0].goals[0];
    expect(first.t).toBe("Complete a mock interview");
    expect(s.goals[first.id].subtasks.length).toBe(4);
  });

  it("returns state unchanged when pillars missing", () => {
    const empty = { pillars: [] };
    expect(applySeededExample(empty, "career")).toBe(empty);
  });
});