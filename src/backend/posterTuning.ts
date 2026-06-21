/**
 * 發布 poster 內部調校（D16 護城河）。
 *
 * 僅供開發者調節擬人化節奏 + 安全閘；不開放使用者。可在 .env 覆寫：
 *
 *   POSTER_DRY_RUN              "1"=啟用 dry-run（content script 不真的送 DOM）；預設 1
 *   POSTER_COOLDOWN_MIN_MIN     兩篇回覆之間最少分鐘數，預設 4
 *   POSTER_COOLDOWN_MIN_MAX     最多分鐘數，預設 11
 *   POSTER_MAX_PER_SESSION      單 session 最多發幾篇（避免一次失控），預設 10
 *   POSTER_SESSION_HOURS        single session 持續多久（小時），預設 3
 *   POSTER_POLL_MS              掃 DB 找下一篇 approved 的週期（毫秒），預設 5000
 *   POSTER_PREVIEW_TIMEOUT_MIN  dry-run 預覽等待人工確認逾時分鐘數，預設 15
 */
function num(value: string | undefined, fallback: number): number {
  const n = value != null ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export interface PosterTuning {
  dryRun: boolean;
  cooldownMinRange: [number, number];
  maxPerSession: number;
  sessionHours: number;
  pollMs: number;
  previewTimeoutMin: number;
}

export function posterTuning(): PosterTuning {
  const env = process.env;
  return {
    dryRun: (env.POSTER_DRY_RUN ?? "1") === "1",
    cooldownMinRange: [num(env.POSTER_COOLDOWN_MIN_MIN, 4), num(env.POSTER_COOLDOWN_MIN_MAX, 11)],
    maxPerSession: num(env.POSTER_MAX_PER_SESSION, 10),
    sessionHours: num(env.POSTER_SESSION_HOURS, 3),
    pollMs: num(env.POSTER_POLL_MS, 5000),
    previewTimeoutMin: num(env.POSTER_PREVIEW_TIMEOUT_MIN, 15),
  };
}
