import { describe, expect, it } from "vitest";
import { posterTuning } from "./posterTuning.js";

describe("posterTuning", () => {
  it("defaults: dry-run on, cooldown 4-11, maxPerSession 10", () => {
    const before = { ...process.env };
    for (const k of Object.keys(process.env)) if (k.startsWith("POSTER_")) delete process.env[k];
    const t = posterTuning();
    expect(t.dryRun).toBe(true);
    expect(t.cooldownMinRange).toEqual([4, 11]);
    expect(t.maxPerSession).toBe(10);
    expect(t.sessionHours).toBe(3);
    expect(t.pollMs).toBe(5000);
    process.env = before;
  });

  it("env overrides take effect; invalid values fall back to defaults", () => {
    const before = { ...process.env };
    process.env.POSTER_DRY_RUN = "0";
    process.env.POSTER_COOLDOWN_MIN_MIN = "2";
    process.env.POSTER_COOLDOWN_MIN_MAX = "abc";
    process.env.POSTER_MAX_PER_SESSION = "3";
    const t = posterTuning();
    expect(t.dryRun).toBe(false);
    expect(t.cooldownMinRange).toEqual([2, 11]);
    expect(t.maxPerSession).toBe(3);
    process.env = before;
  });
});
