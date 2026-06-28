import { CommandQueue } from "./commandQueue.js";
import { posterTuning } from "./posterTuning.js";
import { getActiveAccount, getActiveAccountId, getNextApproved, hasPreviewing, sweepStalePreviews, updateReviewItem } from "./store.js";
import { SessionThrottle } from "../core/throttle.js";

const TENANT = "us"; // 單一安裝＝單一租戶；多租戶推遲

/** 啟動發布 poster：常駐 loop，找 approved → 節流 → 下指令 → 標 sent。 */
export function startPoster(queue: CommandQueue): { stop: () => void } {
  const t = posterTuning();
  const throttles = new Map<string, SessionThrottle>();
  const sentInSession = new Map<string, number>();
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const getThrottle = (accountId: string): SessionThrottle => {
    let throttle = throttles.get(accountId);
    if (!throttle) {
      throttle = new SessionThrottle(1000, t.sessionHours, t.cooldownMinRange);
      throttles.set(accountId, throttle);
    }
    return throttle;
  };

  console.log(`[poster] 啟動：dryRun=${t.dryRun} cooldown=${t.cooldownMinRange[0]}-${t.cooldownMinRange[1]}min maxPerSession=${t.maxPerSession} pollMs=${t.pollMs}`);

  const tick = async () => {
    if (stopped) return;
    const activeId = getActiveAccountId(TENANT);
    if (!activeId) {
      timer = setTimeout(tick, t.pollMs);
      return;
    }
    const throttle = getThrottle(activeId);
    const sentCount = sentInSession.get(activeId) ?? 0;
    if (sentCount >= t.maxPerSession) {
      console.log(`[poster] 已達單 session 上限 ${t.maxPerSession}，停止本 session`);
      stopped = true;
      return;
    }
    if (throttle.sessionExpired()) {
      console.log(`[poster] session 已過 ${t.sessionHours}h，停止本 session`);
      stopped = true;
      return;
    }
    const swept = sweepStalePreviews(TENANT, activeId, t.previewTimeoutMin);
    if (swept > 0) console.log(`[poster] 清理 @${activeId} 超時 previewing ${swept} 筆`);
    if (hasPreviewing(TENANT, activeId)) {
      timer = setTimeout(tick, t.pollMs);
      return;
    }
    const next = getNextApproved(TENANT, activeId);
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
        {
          action: "post_reply",
          postUrl: next.postUrl,
          draft: next.draft,
          dryRun: t.dryRun,
          reviewItemId: next.id,
          expectedHandle: getActiveAccount(TENANT)!.handle,
        },
        90_000,
      );
      if (res.status === "ok") {
        if (t.dryRun) {
          updateReviewItem(next.id, { status: "previewing", previewing_at: new Date().toISOString() });
          console.log(`[poster] 🔍 dry-run 草稿已填入 id=${next.id}，等待人工確認（timeout=${t.previewTimeoutMin}min，預設 15min）`);
        } else {
          updateReviewItem(next.id, { status: "sent" });
          const nextSentCount = sentCount + 1;
          sentInSession.set(activeId, nextSentCount);
          console.log(`[poster] ✅ 已發送 id=${next.id}（本 session ${nextSentCount}/${t.maxPerSession}）`);
        }
      } else if (res.status === "account_mismatch") {
        console.warn(`[poster] ⚠️ 發送失敗 id=${next.id} status=account_mismatch error=${res.error ?? ""}；保留 approved 由人工處理`);
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
