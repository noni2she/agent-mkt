import { tool } from "@openai/agents";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

const ALLOWED_TOOLS = new Set(["navigate_page", "take_snapshot", "evaluate_script"]);

const OPEN_PARAMS = {
  type: "object" as const,
  properties: {},
  required: [] as string[],
  additionalProperties: true as const,
};

function textOf(result: unknown): string {
  const content = (result as { content?: Array<{ type: string; text?: string }> })?.content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("\n");
}

/** MCP 工具列表 → Agents SDK tool()，每個 tool 內部轉發到 MCP callTool */
export function buildMcpTools(mcp: Client, mcpTools: Array<{ name: string; description?: string }>) {
  return mcpTools
    .filter((t) => ALLOWED_TOOLS.has(t.name))
    .map((t) =>
      tool({
        name: t.name,
        description: (t.description ?? "").slice(0, 256),
        parameters: OPEN_PARAMS,
        strict: false,
        async execute(args) {
          try {
            const r = await mcp.callTool({ name: t.name, arguments: args as Record<string, unknown> });
            return textOf(r).slice(0, 8000) || "(empty)";
          } catch (err) {
            return `ERROR: ${String(err)}`;
          }
        },
      }),
    );
}
