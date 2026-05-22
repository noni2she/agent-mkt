import cron from "node-cron";
import { runScoutPipeline } from "../workflow/pipeline.js";

let task: cron.ScheduledTask | null = null;

export function startScheduler(): void {
  if (process.env.ENABLE_AUTO_SCOUT !== "true") {
    console.log("[scheduler] auto-scout disabled (set ENABLE_AUTO_SCOUT=true to enable)");
    return;
  }
  task = cron.schedule("17 10,15,21 * * *", async () => {
    console.log("[scheduler] scout run start", new Date().toISOString());
    try {
      const stats = await runScoutPipeline();
      console.log("[scheduler] done", stats.session_id, "viewed=", stats.posts_viewed);
    } catch (e) {
      console.error("[scheduler] error", e);
    }
  });
}

export function stopScheduler(): void {
  task?.stop();
  task = null;
}
