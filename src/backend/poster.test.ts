import { afterEach, describe, expect, it, vi } from "vitest";
import { posterTuning } from "./posterTuning.js";

const baseTuning = {
  dryRun: true,
  cooldownMinRange: [0, 0] as [number, number],
  maxPerSession: 10,
  sessionHours: 3,
  pollMs: 1,
  previewTimeoutMin: 15,
};

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
  vi.clearAllMocks();
  vi.doUnmock("./posterTuning.js");
  vi.doUnmock("./store.js");
  vi.doUnmock("../core/throttle.js");
});

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

describe("startPoster", () => {
  const accountId = "account-1";

  async function loadPoster(opts: {
    tuning?: typeof baseTuning;
    hasPreviewing?: boolean;
    next?: { id: string; postUrl: string; draft: string } | null;
    enqueueResult?: { type: "response"; id: string; status: "ok" };
  }) {
    const store = {
      getNextApproved: vi.fn((_tenant: string, _accountId: string) => opts.next ?? null),
      hasPreviewing: vi.fn((_tenant: string, _accountId: string) => opts.hasPreviewing ?? false),
      sweepStalePreviews: vi.fn((_tenant: string, _accountId: string, _timeoutMin: number) => 0),
      updateReviewItem: vi.fn(),
    };
    vi.doMock("./posterTuning.js", () => ({
      posterTuning: () => opts.tuning ?? baseTuning,
    }));
    vi.doMock("./store.js", () => ({
      getNextApproved: (tenant: string) => store.getNextApproved(tenant, accountId),
      hasPreviewing: (tenant: string) => store.hasPreviewing(tenant, accountId),
      sweepStalePreviews: (tenant: string, timeoutMin: number) =>
        store.sweepStalePreviews(tenant, accountId, timeoutMin),
      updateReviewItem: store.updateReviewItem,
    }));
    vi.doMock("../core/throttle.js", () => ({
      SessionThrottle: vi.fn().mockImplementation(() => ({
        sessionExpired: vi.fn(() => false),
        gateReply: vi.fn(async () => {}),
      })),
    }));
    const { startPoster } = await import("./poster.js");
    const queue = {
      enqueue: vi.fn(async () => opts.enqueueResult ?? { type: "response", id: "cmd-1", status: "ok" }),
    };
    return { startPoster, store, queue };
  }

  it("does not pick or enqueue when a preview is already waiting", async () => {
    vi.useFakeTimers();
    const { startPoster, store, queue } = await loadPoster({ hasPreviewing: true });
    const poster = startPoster(queue as never);
    await vi.advanceTimersByTimeAsync(1);
    poster.stop();

    expect(store.sweepStalePreviews).toHaveBeenCalledWith("us", accountId, 15);
    expect(store.getNextApproved).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("marks dry-run enqueue success as previewing instead of sent", async () => {
    vi.useFakeTimers();
    const { startPoster, store, queue } = await loadPoster({
      next: { id: "review-1", postUrl: "https://threads.net/@a/post/1", draft: "hello" },
    });
    const poster = startPoster(queue as never);
    await vi.advanceTimersByTimeAsync(1);
    poster.stop();

    expect(queue.enqueue).toHaveBeenCalledWith(
      "us",
      { action: "post_reply", postUrl: "https://threads.net/@a/post/1", draft: "hello", dryRun: true, reviewItemId: "review-1" },
      90_000,
    );
    expect(store.updateReviewItem).toHaveBeenCalledTimes(1);
    expect(store.updateReviewItem).toHaveBeenCalledWith("review-1", {
      status: "previewing",
      previewing_at: expect.any(String),
    });
  });

  it("keeps live enqueue success marking items sent", async () => {
    vi.useFakeTimers();
    const { startPoster, store } = await loadPoster({
      tuning: { ...baseTuning, dryRun: false },
      next: { id: "review-2", postUrl: "https://threads.net/@a/post/2", draft: "live" },
    });
    const poster = startPoster({ enqueue: vi.fn(async () => ({ type: "response", id: "cmd-2", status: "ok" })) } as never);
    await vi.advanceTimersByTimeAsync(1);
    poster.stop();

    expect(store.updateReviewItem).toHaveBeenCalledWith("review-2", { status: "sent" });
  });
});
