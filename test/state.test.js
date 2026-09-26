import { describe, it, expect, beforeEach } from "vitest";
import {
  defaultState,
  normalize,
  setState,
  getState,
  effectiveProgress,
  pillarProgress
} from "../js/state.js";

describe("defaultState", () => {
  it("creates exactly 8 pillars", () => {
    const s = defaultState("Alex", "Ship a product", "career");
    expect(s.pillars).toHaveLength(8);
  });

  it("gives each pillar exactly 8 goals", () => {
    const s = defaultState("Alex", "Ship a product", "career");
    s.pillars.forEach((p) => expect(p.goals).toHaveLength(8));
  });

  it("creates a goals state entry for every goal", () => {
    const s = defaultState("Alex", "Ship a product", "career");
    let count = 0;
    s.pillars.forEach((p) =>
      p.goals.forEach((g) => {
        expect(s.goals[g.id]).toBeDefined();
        count++;
      })
    );
    expect(count).toBe(64);
  });

  it("stores the user's name and goal", () => {
    const s = defaultState("Alex", "Ship a product", "career");
    expect(s.user.name).toBe("Alex");
    expect(s.meta.mainGoal).toBe("Ship a product");
    expect(s.user.goalType).toBe("career");
  });

  it("creates 8 stages", () => {
    const s = defaultState("Alex", "Ship a product", "career");
    expect(s.stages).toHaveLength(8);
  });

  it("defaults the theme to 'deep'", () => {
    expect(defaultState().settings.theme).toBe("deep");
  });
});

describe("normalize", () => {
  it("fills in missing pillars up to 8", () => {
    const partial = { pillars: [{ id: "pillar1", title: "Only one", goals: [] }] };
    const s = normalize(partial);
    expect(s.pillars).toHaveLength(8);
  });

  it("caps extra pillars at 8", () => {
    const extra = defaultState("A", "goal", "other");
    extra.pillars.push(
      ...Array.from({ length: 5 }, (_, i) => ({
        id: "extra" + i,
        title: "Extra",
        goals: []
      }))
    );
    const s = normalize(extra);
    expect(s.pillars).toHaveLength(8);
  });

  it("preserves an existing user name", () => {
    const s = normalize({ user: { name: "Sam", goalType: "fitness", onboarded: true } });
    expect(s.user.name).toBe("Sam");
    expect(s.user.goalType).toBe("fitness");
  });

  it("falls back to 'deep' for an unknown theme", () => {
    const s = normalize({ settings: { theme: "unicorn" } });
    expect(s.settings.theme).toBe("deep");
  });

  it("preserves a valid theme", () => {
    const s = normalize({ settings: { theme: "neon" } });
    expect(s.settings.theme).toBe("neon");
  });

  it("backfills the goals object for every pillar goal", () => {
    const s = normalize({});
    s.pillars.forEach((p) =>
      p.goals.forEach((g) => {
        expect(s.goals[g.id]).toBeDefined();
        expect(Array.isArray(s.goals[g.id].subtasks)).toBe(true);
      })
    );
  });
});

describe("effectiveProgress", () => {
  beforeEach(() => {
    setState(defaultState("Tester", "goal", "career"));
  });

  it("returns the stored progress when autoSync is off", () => {
    const s = getState();
    const id = s.pillars[0].goals[0].id;
    s.goals[id].autoSync = false;
    s.goals[id].progress = 42;
    expect(effectiveProgress(id)).toBe(42);
  });

  it("computes from subtasks when autoSync is on", () => {
    const s = getState();
    const id = s.pillars[0].goals[0].id;
    s.goals[id].autoSync = true;
    s.goals[id].subtasks = [
      { id: "a", title: "one", done: true },
      { id: "b", title: "two", done: true },
      { id: "c", title: "three", done: false },
      { id: "d", title: "four", done: false }
    ];
    expect(effectiveProgress(id)).toBe(50);
  });

  it("returns 0 for an unknown goal id", () => {
    expect(effectiveProgress("does-not-exist")).toBe(0);
  });

  it("clamps values above 100", () => {
    const s = getState();
    const id = s.pillars[0].goals[0].id;
    s.goals[id].autoSync = false;
    s.goals[id].progress = 250;
    expect(effectiveProgress(id)).toBe(100);
  });
});

describe("pillarProgress", () => {
  beforeEach(() => {
    setState(defaultState("Tester", "goal", "career"));
  });

  it("averages progress across the 8 goals", () => {
    const s = getState();
    const p = s.pillars[0];
    p.goals.forEach((g, i) => {
      s.goals[g.id].autoSync = false;
      s.goals[g.id].progress = i * 10; // 0,10,20,...,70 → avg 35
    });
    expect(pillarProgress(p)).toBe(35);
  });

  it("returns 0 for a pillar with no goals", () => {
    expect(pillarProgress({ goals: [] })).toBe(0);
  });
});