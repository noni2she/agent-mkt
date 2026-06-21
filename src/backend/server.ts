import { createServer, type Server } from "node:http";
import { ResponseEnvelopeSchema } from "../core/protocol.js";
import { CommandQueue } from "./commandQueue.js";
import { scoutAndReview } from "./coordinator.js";
import { scoutBudget } from "./scoutTuning.js";
import { getAgentDef, getReviewItem, getReviews, getTenant, getTenantConfig, onboardTenant, setAgentDef, setTenantConfig, updateReviewItem } from "./store.js";

const TENANT = "us"; // 單一安裝＝單一租戶；多租戶推遲

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

    if (req.method === "GET" && url.pathname === "/agent-def") {
      const tenant = url.searchParams.get("tenant") ?? "";
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(getAgentDef(tenant)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/agent-def") {
      let body = ""; for await (const c of req) body += c;
      try {
        const tenant = url.searchParams.get("tenant") ?? "us";
        setAgentDef(tenant, JSON.parse(body));
        res.statusCode = 204; res.end();
      } catch {
        res.statusCode = 400; res.end("bad agent-def");
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/tenant") {
      const tenant = url.searchParams.get("tenant") ?? "";
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(getTenant(tenant)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/tenant/onboard") {
      let body = ""; for await (const c of req) body += c;
      try {
        const tenant = url.searchParams.get("tenant") ?? "us";
        onboardTenant(tenant, JSON.parse(body));
        res.statusCode = 204; res.end();
      } catch (e) {
        res.statusCode = 400; res.end(e instanceof Error ? e.message : "bad onboard");
      }
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
      queue.clearScoutStop(tenant);
      queue.markScoutActive(tenant);
      // fire-and-forget：背景跑，立刻回 202；UI 之後 poll /reviews
      void scoutAndReview(queue, tenant, {
        keyword: kw,
        serpType: cfg.serpType,
        criteria: { minLikes: cfg.minLikes, maxAgeHours: cfg.maxAgeHours ?? undefined, excludeKeywords: cfg.excludeKeywords },
        budget: scoutBudget(),
        targetRelevant: cfg.targetRelevant,
      })
        .catch((e) => console.error("[scout] 失敗:", e))
        .finally(() => queue.markScoutInactive(tenant));
      res.statusCode = 202; res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/scout/status") {
      const tenant = url.searchParams.get("tenant") ?? "us";
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ running: queue.isScoutActive(tenant) }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/scout/stop") {
      const tenant = url.searchParams.get("tenant") ?? "us";
      queue.requestScoutStop(tenant);
      res.statusCode = 202;
      res.end();
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/v1/preview/resolve") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      try {
        const body = JSON.parse(raw || "{}") as { id?: string; action?: string };
        const action = body.action === "sent" || body.action === "skipped" ? body.action : null;
        res.setHeader("Content-Type", "application/json");
        if (!body.id || !action) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "bad request" }));
          return;
        }
        const item = getReviewItem(body.id);
        if (!item) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "not found" }));
          return;
        }
        if (item.tenant_id !== TENANT) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: "forbidden" }));
          return;
        }
        if (item.status !== "previewing") {
          res.statusCode = 409;
          res.end(JSON.stringify({ error: `status=${item.status}, not previewing` }));
          return;
        }
        updateReviewItem(body.id, { status: action });
        console.log(`[server] preview 解決 id=${body.id} → ${action}`);
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "bad request" }));
      }
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
