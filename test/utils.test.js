// test/utils.test.js
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  esc,
  clamp,
  iso,
  todayISO,
  uid,
  mondayOf,
  daysUntil,
  fmtDate,
  greeting,
  vibrate
} from "../js/utils.js";

/* ============================================================
   esc
   ============================================================ */
describe("esc", () => {
  it("escapes ampersand", () => {
    expect(esc("a & b")).toBe("a &amp; b");
  });

  it("escapes angle brackets", () => {
    expect(esc("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes double quotes", () => {
    expect(esc('say "hi"')).toBe("say &quot;hi&quot;");
  });

  it("escapes single quotes", () => {
    expect(esc("it's")).toBe("it&#39;s");
  });

  it("escapes all five entities together", () => {
    expect(esc(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("handles null", () => {
    expect(esc(null)).toBe("");
  });

  it("handles undefined", () => {
    expect(esc(undefined)).toBe("");
  });

  it("stringifies numbers", () => {
    expect(esc(42)).toBe("42");
  });
});

/* ============================================================
   clamp
   ============================================================ */
describe("clamp", () => {
  it("returns value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to min", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it("clamps to max", () => {
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it("returns min when min equals max", () => {
    expect(clamp(5, 7, 7)).toBe(7);
  });
});

/* ============================================================
   iso / todayISO
   ============================================================ */
describe("iso", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(iso(new Date(2026, 0, 15))).toBe("2026-01-15");
  });

  it("pads single-digit months", () => {
    expect(iso(new Date(2026, 4, 3))).toBe("2026-05-03");
  });

  it("pads single-digit days", () => {
    expect(iso(new Date(2026, 11, 9))).toBe("2026-12-09");
  });
});

describe("todayISO", () => {
  it("returns today's date in ISO format", () => {
    const t = todayISO();
    expect(t).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(t).toBe(iso(new Date()));
  });
});

/* ============================================================
   uid
   ============================================================ */
describe("uid", () => {
  it("returns a string of length 7", () => {
    expect(uid()).toHaveLength(7);
  });

  it("returns base36 characters", () => {
    expect(uid()).toMatch(/^[a-z0-9]+$/);
  });

  it("produces different values on consecutive calls", () => {
    const a = uid();
    const b = uid();
    expect(a).not.toBe(b);
  });
});

/* ============================================================
   mondayOf
   ============================================================ */
describe("mondayOf", () => {
  it("returns the same day for a Monday", () => {
    // 2026-01-05 is a Monday
    expect(mondayOf(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("returns previous Monday for a Wednesday", () => {
    // 2026-01-07 is a Wednesday
    expect(mondayOf(new Date(2026, 0, 7))).toBe("2026-01-05");
  });

  it("returns previous Monday for a Sunday", () => {
    // 2026-01-11 is a Sunday
    expect(mondayOf(new Date(2026, 0, 11))).toBe("2026-01-05");
  });

  it("handles cross-month boundaries", () => {
    // 2026-02-02 is a Monday
    expect(mondayOf(new Date(2026, 1, 3))).toBe("2026-02-02");
  });
});

/* ============================================================
   daysUntil
   ============================================================ */
describe("daysUntil", () => {
  it("returns null for empty input", () => {
    expect(daysUntil("")).toBe(null);
    expect(daysUntil(null)).toBe(null);
  });

  it("returns null for invalid date string", () => {
    expect(daysUntil("not-a-date")).toBe(null);
  });

  it("returns 0 for today", () => {
    expect(daysUntil(todayISO())).toBe(0);
  });

  it("returns positive for future dates", () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    expect(daysUntil(iso(d))).toBe(7);
  });

  it("returns negative for past dates", () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    expect(daysUntil(iso(d))).toBe(-3);
  });
});

/* ============================================================
   fmtDate
   ============================================================ */
describe("fmtDate", () => {
  it("returns empty string for empty input", () => {
    expect(fmtDate("")).toBe("");
    expect(fmtDate(null)).toBe("");
  });

  it("formats a valid date to short month + day", () => {
    const out = fmtDate("2026-01-15");
    expect(out).toMatch(/Jan/);
    expect(out).toMatch(/15/);
  });

  it("returns original string for invalid date", () => {
    expect(fmtDate("nope")).toBe("nope");
  });
});

/* ============================================================
   greeting
   ============================================================ */
describe("greeting", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns morning greeting before 12", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 8, 0, 0));
    expect(greeting("Sam")).toBe("Good morning, Sam");
  });

  it("returns afternoon greeting between 12 and 17", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 14, 0, 0));
    expect(greeting("Sam")).toBe("Good afternoon, Sam");
  });

  it("returns evening greeting after 17", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 20, 0, 0));
    expect(greeting("Sam")).toBe("Good evening, Sam");
  });

  it("omits the name when empty", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 8, 0, 0));
    expect(greeting("")).toBe("Good morning");
  });

  it("omits the name when whitespace only", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 8, 0, 0));
    expect(greeting("   ")).toBe("Good morning");
  });

  it("trims the name", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 8, 0, 0));
    expect(greeting("  Sam  ")).toBe("Good morning, Sam");
  });
});

/* ============================================================
   vibrate
   ============================================================ */
describe("vibrate", () => {
  it("does not throw when navigator.vibrate is missing", () => {
    expect(() => vibrate(10)).not.toThrow();
  });

  it("does not throw when navigator.vibrate is a number pattern", () => {
    expect(() => vibrate([30, 50, 30])).not.toThrow();
  });
});