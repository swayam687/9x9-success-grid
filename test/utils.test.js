import { describe, it, expect } from "vitest";
import { esc, clamp, iso, mondayOf, daysUntil, uid } from "../js/utils.js";

describe("esc", () => {
  it("escapes HTML special characters", () => {
    expect(esc("<script>alert('x')</script>")).toBe(
      "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;"
    );
  });

  it("escapes quotes", () => {
    expect(esc('He said "hi" & left')).toBe("He said &quot;hi&quot; &amp; left");
  });

  it("handles null and undefined as empty string", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });

  it("passes numbers through as strings", () => {
    expect(esc(42)).toBe("42");
  });
});

describe("clamp", () => {
  it("returns value when inside range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("clamps to lower bound", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it("clamps to upper bound", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
  it("handles equal bounds", () => {
    expect(clamp(5, 5, 5)).toBe(5);
  });
});

describe("iso", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(iso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
  it("pads single-digit months and days", () => {
    expect(iso(new Date(2026, 8, 9))).toBe("2026-09-09");
  });
});

describe("mondayOf", () => {
  it("returns a Monday for any input day", () => {
    const result = mondayOf(new Date(2026, 8, 26)); // a Saturday
    const d = new Date(result);
    expect(d.getDay()).toBe(1); // 1 = Monday
  });

  it("returns the same date when given a Monday", () => {
    const monday = new Date(2026, 8, 21); // Monday
    expect(mondayOf(monday)).toBe(iso(monday));
  });
});

describe("daysUntil", () => {
  it("returns 0 for today", () => {
    const today = new Date();
    const iso_today = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(today.getDate()).padStart(2, "0")}`;
    expect(daysUntil(iso_today)).toBe(0);
  });

  it("returns positive for future dates", () => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    const iso_future = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
    expect(daysUntil(iso_future)).toBe(5);
  });

  it("returns negative for past dates", () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    const iso_past = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
    expect(daysUntil(iso_past)).toBe(-3);
  });

  it("returns null for empty or invalid input", () => {
    expect(daysUntil("")).toBe(null);
    expect(daysUntil("not-a-date")).toBe(null);
    expect(daysUntil(null)).toBe(null);
  });
});

describe("uid", () => {
  it("returns a non-empty string", () => {
    expect(typeof uid()).toBe("string");
    expect(uid().length).toBeGreaterThan(0);
  });
  it("returns unique values across calls", () => {
    const a = new Set();
    for (let i = 0; i < 100; i++) a.add(uid());
    expect(a.size).toBe(100);
  });
});