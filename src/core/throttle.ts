// 行為節流 + 人類節奏模擬。固定頻率本身就是機器人訊號 → 全程隨機分佈。

/** 隨機整數 [min, max] */
export const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/** 高斯擾動，模擬人類停頓而非均勻分佈 */
export function jitter(meanMs: number, spread = 0.4): number {
  const g = (Math.random() + Math.random() + Math.random()) / 3; // 近似常態
  const factor = 1 + (g - 0.5) * 2 * spread;
  return Math.max(150, Math.round(meanMs * factor));
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/** 人類化短暫停頓（讀內容、思考） */
export const humanPause = (meanMs = 1800): Promise<void> => sleep(jitter(meanMs));

/** Session 級節流器：限制每分鐘瀏覽量 + 單日活動時數 + 留言冷卻。 */
export class SessionThrottle {
  private viewTimestamps: number[] = [];
  private lastReplyAt = 0;
  private readonly startedAt = Date.now();

  constructor(
    private readonly maxPerMin: number,
    private readonly sessionMaxHours: number,
    private readonly replyCooldownMinRange: [number, number],
  ) {}

  sessionExpired(): boolean {
    return Date.now() - this.startedAt >= this.sessionMaxHours * 3600_000;
  }

  async gateView(): Promise<void> {
    const now = Date.now();
    this.viewTimestamps = this.viewTimestamps.filter((t) => now - t < 60_000);
    if (this.viewTimestamps.length >= this.maxPerMin) {
      const waitMs = 60_000 - (now - this.viewTimestamps[0]!) + jitter(2000);
      await sleep(waitMs);
    }
    this.viewTimestamps.push(Date.now());
    await humanPause();
  }

  async gateReply(): Promise<void> {
    const [lo, hi] = this.replyCooldownMinRange;
    const since = Date.now() - this.lastReplyAt;
    const need = randInt(lo * 60_000, hi * 60_000);
    if (this.lastReplyAt && since < need) await sleep(need - since);
    this.lastReplyAt = Date.now();
  }
}
