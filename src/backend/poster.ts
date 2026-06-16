import { CommandQueue } from "./commandQueue.js";
import { posterTuning } from "./posterTuning.js";
import { getNextApproved, updateReviewItem } from "./store.js";
import { SessionThrottle } from "../core/throttle.js";

const TENANT = "us"; // 單一安裝＝單一租戶；多租戶推遲

/** 啟動發布 poster：常駐 loop，找 approved → 節流 → 下指令 → 標 sent。 */
export function startPoster(queue: CommandQueue): { stop: () => void } {
  const t = posterTuning();
  const throttle = new SessionThrottle(1000, t.sessionHours, t.cooldownMinRange);
  let sentInSession = 0;
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  console.log(`[poster] 啟動：dryRun=${t.dryRun} cooldown=${t.cooldownMinRange[0]}-${t.cooldownMinRange[1]}min maxPerSession=${t.maxPerSession} pollMs=${t.pollMs}`);

  const tick = async () => {
    if (stopped) return;
    if (sentInSession >= t.maxPerSession) {
      console.log(`[poster] 已達單 session 上限 ${t.maxPerSession}，停止本 session`);
      stopped = true;
      return;
    }
    if (throttle.sessionExpired()) {
      console.log(`[poster] session 已過 ${t.sessionHours}h，停止本 session`);
      stopped = true;
      return;
    }
    const next = getNextApproved(TENANT);
    if (!next) {
      timer = setTimeout(tick, t.pollMs);
      return;
    }
    console.log(`[poster] 取得 approved id=${next.id} → 等冷卻…`);
    await throttle.gateReply();
    if (stopped) return;
    try {
      const res = await queue.enqueue(
        TENANT,
        { action: "post_reply", postUrl: next.postUrl, draft: next.draft, dryRun: t.dryRun },
        90_000,
      );
      if (res.status === "ok") {
        updateReviewItem(next.id, { status: "sent" });
        sentInSession += 1;
        console.log(`[poster] ✅ 已${t.dryRun ? "（dry-run）" : ""}發送 id=${next.id}（本 session ${sentInSession}/${t.maxPerSession}）`);
      } else {
        console.warn(`[poster] ⚠️ 發送失敗 id=${next.id} status=${res.status} error=${res.error ?? ""}；保留 approved 由人工處理`);
      }
    } catch (e) {
      console.warn(`[poster] ⚠️ 發送 exception id=${next.id}：${(e as Error).message}；保留 approved 由人工處理`);
    }
    if (!stopped) timer = setTimeout(tick, t.pollMs);
  };

  timer = setTimeout(tick, t.pollMs);

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
