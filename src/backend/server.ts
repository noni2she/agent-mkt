import { createServer, type Server } from "node:http";
import { ResponseEnvelopeSchema } from "../core/protocol.js";
import { CommandQueue } from "./commandQueue.js";
import { scoutAndReview } from "./coordinator.js";
import { getReviews, getTenantConfig, setTenantConfig, updateReviewItem } from "./store.js";

/** 建立 polling HTTP server：GET /poll?tenant=us、POST /result。 */
export function createPollServer(queue: CommandQueue): Server {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }

    if (req.method === "GET" && url.pathname === "/poll") {
      const tenant = url.searchParams.get("tenant") ?? "";
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(queue.drain(tenant)));
      return;
    }

    if (req.method === "GET" && url.pathname === "/config") {
      const tenant = url.searchParams.get("tenant") ?? "";
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(getTenantConfig(tenant)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/config") {
      let body = ""; for await (const c of req) body += c;
      try { const tenant = url.searchParams.get("tenant") ?? "us"; setTenantConfig(tenant, JSON.parse(body)); res.statusCode = 204; res.end(); }
      catch { res.statusCode = 400; res.end("bad config"); }
      return;
    }

    if (req.method === "POST" && url.pathname === "/scout") {
      const tenant = url.searchParams.get("tenant") ?? "us";
      let body = ""; for await (const c of req) body += c;
      let keyword = "";
      try { keyword = (JSON.parse(body || "{}").keyword as string) ?? ""; } catch {}
      const cfg = getTenantConfig(tenant);
      const kw = keyword || cfg.keywords[0] || "";
      if (!kw) { res.statusCode = 400; res.end("no keyword"); return; }
      // fire-and-forget：背景跑，立刻回 202；UI 之後 poll /reviews
      void scoutAndReview(queue, tenant, {
        keyword: kw,
        serpType: cfg.serpType,
        criteria: { minLikes: cfg.minLikes, maxAgeHours: cfg.maxAgeHours ?? undefined, excludeKeywords: cfg.excludeKeywords },
        budget: {},
        targetRelevant: cfg.targetRelevant,
      }).catch((e) => console.error("[scout] 失敗:", e));
      res.statusCode = 202; res.end();
      return;
    }

    if (req.method === "POST" && url.pathname === "/result") {
      let body = "";
      for await (const chunk of req) body += chunk;
      try {
        const parsed = ResponseEnvelopeSchema.parse(JSON.parse(body));
        queue.resolveResult(parsed);
        res.statusCode = 204;
        res.end();
      } catch {
        res.statusCode = 400;
        res.end("bad result");
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/reviews") {
      const tenant = url.searchParams.get("tenant") ?? "";
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(getReviews(tenant)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/review") {
      let body = "";
      for await (const chunk of req) body += chunk;
      try {
        const { id, status, draft } = JSON.parse(body) as { id: string; status?: string; draft?: string };
        if (!id) throw new Error("missing id");
        updateReviewItem(id, { status, draft });
        res.statusCode = 204;
        res.end();
      } catch {
        res.statusCode = 400;
        res.end("bad review update");
      }
      return;
    }

    res.statusCode = 404;
    res.end();
  });
}
