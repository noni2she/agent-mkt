import { describe, it, expect } from "vitest";
import { randInt, jitter, SessionThrottle } from "./throttle.js";

describe("randInt", () => {
  it("stays within [min,max] over many runs", () => {
    for (let i = 0; i < 1000; i++) {
      const v = randInt(3, 8);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(8);
    }
  });
});

describe("jitter", () => {
  it("never returns below the 150ms floor", () => {
    for (let i = 0; i < 1000; i++) {
      expect(jitter(100)).toBeGreaterThanOrEqual(150);
    }
  });
  it("stays near the mean within the spread band", () => {
    for (let i = 0; i < 1000; i++) {
      const v = jitter(1000, 0.4);
      expect(v).toBeGreaterThanOrEqual(150);
      expect(v).toBeLessThanOrEqual(1800); // mean*(1+spread) 上界
    }
  });
});

describe("SessionThrottle.sessionExpired", () => {
  it("is false right after construction", () => {
    const t = new SessionThrottle(10, 1, [3, 8]);
    expect(t.sessionExpired()).toBe(false);
  });
  it("is true when max hours is zero", () => {
    const t = new SessionThrottle(10, 0, [3, 8]);
    expect(t.sessionExpired()).toBe(true);
  });
});
