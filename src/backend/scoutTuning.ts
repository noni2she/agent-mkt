import type { ScoutBudget } from "../core/protocol.js";

/**
 * 海巡內部調校參數（D16 護城河）。
 *
 * 僅供「開發者調校 AI 核心海巡行為」用，**不開放使用者**——不進 tenant_config、不進海巡頁 UI。
 * 預設值在此版本控制；要臨時實驗時，可在 .env 設同名大寫變數覆寫，不必改碼：
 *
 *   SCOUT_TARGET_CANDIDATES  單輪最多收集幾篇候選（補量迴圈每輪會再壓成缺額）
 *   SCOUT_MAX_SCROLLS        單輪最多捲動次數（擬人上限）
 *   SCOUT_MAX_SCANNED        單輪最多掃描幾張貼文卡
 */
function num(value: string | undefined, fallback: number): number {
  const n = value != null ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** 單輪 scout 的「先到先停」上限。 */
export function scoutBudget(): ScoutBudget {
  const env = process.env;
  return {
    targetCandidates: num(env.SCOUT_TARGET_CANDIDATES ?? env.DEV_TARGET, 10),
    maxScrolls: num(env.SCOUT_MAX_SCROLLS ?? env.DEV_MAX_SCROLLS, 30),
    maxScanned: num(env.SCOUT_MAX_SCANNED ?? env.DEV_MAX_SCANNED, 60),
  };
}
