import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain } from "electron";
import { loadBusinessRules } from "../shared/config.js";
import { history, queue } from "../shared/store.js";
import type { ReviewItem } from "../shared/types.js";
import { runScoutPipeline } from "../workflow/pipeline.js";
import { newPage, closeBrowser } from "../browser/playwright.js";
import { sendReply } from "../workflow/poster.js";
import { startScheduler } from "../scheduler/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1180,
    height: 880,
    title: "agent-mkt — 小編審核台",
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }

}

ipcMain.handle("queue:pending", () => queue.pending());
ipcMain.handle("queue:all", () => queue.all());
ipcMain.handle("stats:sessions", () => history.sessions());

ipcMain.handle("scout:run", async () => runScoutPipeline());

ipcMain.handle("review:reject", (_e, id: string) => {
  queue.update(id, { status: "rejected", reviewed_at: new Date().toISOString() });
  return queue.pending();
});

ipcMain.handle(
  "review:approve",
  async (_e, payload: { id: string; editedDraft?: string }) => {
    const item = queue.all().find((i: ReviewItem) => i.id === payload.id);
    if (!item) return { ok: false, error: "not found" };

    const status = payload.editedDraft ? "edited" : "approved";
    queue.update(item.id, {
      status,
      edited_draft: payload.editedDraft,
      reviewed_at: new Date().toISOString(),
    });

    const rules = loadBusinessRules();
    const fresh = queue.all().find((i: ReviewItem) => i.id === payload.id)!;
    try {
      const page = await newPage();
      const res = await sendReply(page, fresh, rules);
      queue.update(item.id, {
        status: res.ok ? "sent" : "failed",
        sent_at: res.ok ? new Date().toISOString() : undefined,
      });
      await closeBrowser();
      return { ok: res.ok, signals: res.signals };
    } catch (err) {
      queue.update(item.id, { status: "failed" });
      return { ok: false, error: String(err) };
    }
  },
);

app.whenReady().then(() => {
  createWindow();
  startScheduler();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
