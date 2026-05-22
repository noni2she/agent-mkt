import { randomUUID } from "node:crypto";
import { Agent, MaxTurnsExceededError, Runner, type RunItemStreamEvent } from "@openai/agents";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { makeProvider } from "../../agents/BaseAgent.js";
import { connect } from "../../browser/chrome.js";
import { ensureLoggedIn } from "../../browser/login.js";
import { loadBusinessRules } from "../../shared/config.js";
import { history, processed, queue } from "../../shared/store.js";
import type { ReviewItem, ScoutedPost, SessionStats } from "../../shared/types.js";
import { env } from "../../shared/config.js";
import { buildMcpTools } from "./tools.js";
import { isPopular } from "./filter.js";

/**
 * 動態產生 system prompt，帶入熱門門檻與目標數量。
 * agent 會自己邊滾動邊篩，湊足 target 篇才停止輸出。
 */
function buildSystemPrompt(minLikes: number, minReplies: number, maxAgeHours: number, target: number): string {
  return `你是一個操作瀏覽器的 AI 小編助手，任務是「海巡」Threads 上的熱門貼文。

你只能透過提供的工具操作瀏覽器。

## 熱門門檻（你自己篩，三個條件都要符合）
- 讚數 ≥ ${minLikes}
- 留言數 ≥ ${minReplies}
- 發文時間在 **${maxAgeHours} 小時內**（太舊的略過）

## 目標
收集 **${target} 篇**符合上述門檻的貼文後停止。

## 工具使用規格（嚴格遵守）

**navigate_page**：一律帶 url 參數
\`\`\`
navigate_page(url="https://...")
\`\`\`

**take_snapshot**：不需參數，直接呼叫

**evaluate_script**：function 參數必須是完整的 function 宣告，不能是表達式
\`\`\`
evaluate_script(function="() => { window.scrollBy(0, 1200); return true; }")
\`\`\`

## 流程
1. 用 navigate_page(url="...") 前往指定的 Threads 搜尋頁 URL
2. 用 take_snapshot 讀取頁面 a11y 文字內容
3. 逐篇抽取：貼文 ID、URL、作者 handle、內文、讚數、留言數、發文時間
   - 數字縮寫（1.2萬、3.4k）請換算成整數
   - 發文時間無法精確時，用合理估計的 ISO 時間
4. 把同時符合**所有門檻**的貼文加入清單（讚數、留言數、發文時間都要符合）
5. 若符合篇數 < ${target}，用 evaluate_script(function="() => { window.scrollBy(0, 1200); return true; }") 載入更多，再重複 take_snapshot
6. 湊足 ${target} 篇（或已滾動 8 次仍不足），**停止呼叫工具**，直接輸出純 JSON（不含 markdown code fence）：
{"posts":[{"id","url","author_handle","text","likes","replies","posted_at"}]}

## 注意
- 只抽取，**不要**對任何貼文按讚、留言、追蹤或點擊任何互動按鈕
- **不要點「最近」tab**，只在「最相關」tab 搜尋
- 抓不到的欄位給合理預設（likes/replies 給 0，posted_at 給現在時間）
- 若一篇貼文不符合門檻，略過不輸出
- 輸出只包含符合門檻的貼文，最多 ${target} 篇`;
}

export interface RawPost {
  id: string;
  url: string;
  author_handle: string;
  text: string;
  likes: number;
  replies: number;
  posted_at: string;
}

export interface AgentExtractOptions {
  keyword: string;
  searchUrl: string;
  /** 最少讚數，對應 business_rules.popular_criteria.min_likes */
  minLikes?: number;
  /** 最少留言數，對應 business_rules.popular_criteria.min_replies */
  minReplies?: number;
  /** 發文時間上限（小時），對應 business_rules.popular_criteria.max_post_age_hours */
  maxAgeHours?: number;
  /** 目標收集篇數（agent 自篩後湊足才停止） */
  target?: number;
  /** agent 最大 turn 數上限（防止無限迴圈） */
  maxIterations?: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface McpScoutOptions {}

/** LLM agent 自主操作瀏覽器抽取貼文 */
export async function runAgentExtract(
  mcp: Client,
  opts: AgentExtractOptions,
): Promise<RawPost[]> {
  const minLikes = opts.minLikes ?? 0;
  const minReplies = opts.minReplies ?? 0;
  const maxAgeHours = opts.maxAgeHours ?? 72;
  const target = opts.target ?? 10;

  const { provider, modelName } = makeProvider();
  const { tools: mcpToolDefs } = await mcp.listTools();

  const agent = new Agent({
    name: "threads-scout",
    instructions: buildSystemPrompt(minLikes, minReplies, maxAgeHours, target),
    model: modelName,
    modelSettings: {},
    tools: buildMcpTools(mcp, mcpToolDefs),
  });

  const runner = new Runner({ modelProvider: provider });

  try {
    const stream = await runner.run(
      agent,
      `關鍵字「${opts.keyword}」。請前往這個搜尋頁開始海巡：\n${opts.searchUrl}`,
      { stream: true, maxTurns: opts.maxIterations ?? 25 },
    );

    // 每次 LLM 呼叫工具算一個 turn（tool_output 後再次出現 tool_called = 新 turn）
    let turnNumber = 0;
    let afterOutput = true; // 初始為 true，讓第一個 tool_called 觸發 Turn 1

    for await (const event of stream) {
      if (event.type === "run_item_stream_event") {
        const e = event as RunItemStreamEvent;
        if (e.name === "tool_called") {
          if (afterOutput) {
            turnNumber++;
            console.log(`\n  📍 Turn ${turnNumber}`);
            afterOutput = false;
          }
          const call = e.item as { rawItem?: { name?: string; arguments?: string } };
          const toolName = call.rawItem?.name ?? "?";
          const args = call.rawItem?.arguments ?? "{}";
          let argSummary = "";
          try {
            const parsed = JSON.parse(args) as Record<string, unknown>;
            argSummary = Object.entries(parsed)
              .map(([k, v]) => `${k}=${JSON.stringify(v).slice(0, 60)}`)
              .join(", ");
          } catch { argSummary = args.slice(0, 80); }
          console.log(`    🔧 ${toolName}(${argSummary})`);
        } else if (e.name === "tool_output") {
          const out = e.item as { rawItem?: { output?: unknown } };
          const raw = out.rawItem?.output;
          const output = typeof raw === "string" ? raw : JSON.stringify(raw) ?? "";
          console.log(`    ↩  ${output.slice(0, 120).replace(/\n/g, " ")}`);
          afterOutput = true;
        }
      }
    }
    console.log(`\n  📊 共使用 ${turnNumber} turns`);

    return parsePosts(stream.finalOutput ?? "");
  } catch (err) {
    if (err instanceof MaxTurnsExceededError) {
      console.log(`  ⚠️ 達到 max iterations (${opts.maxIterations ?? 25})`);
      return [];
    }
    throw err;
  }
}

/** MCP 路線：connect → login → 逐關鍵字 agent 抽取 → isPopular 過濾 → 寫入 queue */
export async function runMcpScout(opts: McpScoutOptions = {}): Promise<SessionStats> {
  const rules = loadBusinessRules();
  const stats: SessionStats = {
    session_id: randomUUID(),
    started_at: new Date().toISOString(),
    posts_viewed: 0,
    replies_sent: 0,
    approvals: 0,
    rejections: 0,
    detection_signals: [],
  };

  const mcp = await connect();
  try {
    const ok = await ensureLoggedIn(mcp.client);
    if (!ok) {
      stats.detection_signals.push("not_logged_in");
      return stats;
    }

    for (const kw of rules.popular_criteria.topic_keywords) {
      const searchUrl = `https://www.threads.com/search?q=${encodeURIComponent(kw)}&serp_type=default`;
      console.log(`\n🔍 海巡關鍵字：「${kw}」`);

      const target = rules.popular_criteria.scout_target_per_keyword;
      let raw: RawPost[];
      try {
        raw = await runAgentExtract(mcp.client, {
          keyword: kw,
          searchUrl,
          minLikes: rules.popular_criteria.min_likes,
          minReplies: rules.popular_criteria.min_replies,
          maxAgeHours: rules.popular_criteria.max_post_age_hours,
          target,
          // 每次 scroll + snapshot 約 2 turns；目標 10 篇最多滾 8 次 → 留 30 turns 安全邊際
          maxIterations: 30,
        });
      } catch (err) {
        console.log(`  ⚠️ 關鍵字「${kw}」抽取失敗：${String(err)}`);
        continue;
      }

      // agent 已自行篩過，這裡做後端雙重驗證（防止數字換算錯誤或時間誤判）
      let kept = 0;
      let skippedDuplicate = 0;
      let skippedFilter = 0;
      for (const p of raw) {
        if (processed.has(p.id)) { skippedDuplicate++; continue; }
        stats.posts_viewed += 1;

        const base = {
          id: p.id,
          url: p.url,
          author_handle: p.author_handle,
          author_followers: null,
          text: p.text,
          likes: p.likes,
          replies: p.replies,
          posted_at: p.posted_at,
          thread_excerpt: [] as string[],
        };

        const v = isPopular(base, rules);
        if (!v.ok) {
          skippedFilter++;
          console.log(`  ⚠️ 後端驗證不通過（${v.reason}）：likes=${p.likes} replies=${p.replies}`);
          continue;
        }

        const post: ScoutedPost = { ...base, is_popular: true, popular_reason: v.reason };
        history.pushScouted(post);
        processed.mark(p.id);

        const item: ReviewItem = {
          id: randomUUID(),
          kind: "reply",
          target_post: post,
          draft: "",
          recommend_reason: post.popular_reason,
          rule_flags: [],
          status: "pending",
          created_at: new Date().toISOString(),
        };
        queue.add(item);
        kept += 1;
        console.log(`  ✅ ${post.popular_reason}｜@${post.author_handle}：${post.text.slice(0, 40)}`);
      }
      const summary = [`「${kw}」agent 回傳 ${raw.length} 篇，通過後端驗證 ${kept} 篇`];
      if (skippedDuplicate) summary.push(`重複略過 ${skippedDuplicate}`);
      if (skippedFilter) summary.push(`後端過濾 ${skippedFilter}`);
      console.log(`  ${summary.join("，")}`);
    }
  } finally {
    history.saveSession(stats);
    await mcp.close();
  }

  return stats;
}

function parsePosts(content: string): RawPost[] {
  const cleaned = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const obj = JSON.parse(cleaned);
    const arr = Array.isArray(obj) ? obj : obj.posts;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((p): RawPost => ({
        id: String(p.id ?? "").trim(),
        url: String(p.url ?? "").trim(),
        author_handle: String(p.author_handle ?? "").replace(/^@/, "").trim(),
        text: String(p.text ?? "").trim(),
        likes: Number(p.likes) || 0,
        replies: Number(p.replies) || 0,
        posted_at: String(p.posted_at ?? new Date().toISOString()),
      }))
      .filter((p) => p.id && p.text);
  } catch {
    console.log("  ⚠️ 無法解析 LLM 輸出為 JSON，內容前 300 字：\n" + content.slice(0, 300));
    return [];
  }
}
