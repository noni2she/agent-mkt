import { execSync } from "node:child_process";
import { OpenAIProvider, setTracingDisabled } from "@openai/agents";
import { env } from "../shared/config.js";

// 未使用 OpenAI tracing 服務時停用，避免每次 LLM 呼叫都印警告
setTracingDisabled(true);

const GITHUB_MODELS_BASE = "https://models.github.ai/inference";

/**
 * GitHub Models 支援：
 *  OpenAIProvider 接受 { apiKey, baseURL }，內部用自己的 openai@6 client。
 *  - 有 OPENAI_API_KEY → provider 指向 api.openai.com
 *  - 無 key → gh auth token + baseURL 改成 models.github.ai（OpenAI-compatible）
 */
export function makeProvider(): { provider: OpenAIProvider; modelName: string } {
  if (env.openaiKey) {
    return {
      provider: new OpenAIProvider({ apiKey: env.openaiKey }),
      modelName: env.openaiModel,
    };
  }
  const ghToken = execSync("gh auth token", { encoding: "utf8" }).trim();
  const modelName = `openai/${env.openaiModel.replace(/^openai\//, "")}`;
  console.log(`  ℹ️  使用 GitHub Models API（Copilot Pro）model: ${modelName}`);
  return {
    // useResponses: false → 強制走 Chat Completions API
    // GitHub Models 只有 /v1/chat/completions，沒有 /v1/responses（Responses API）
    provider: new OpenAIProvider({ apiKey: ghToken, baseURL: GITHUB_MODELS_BASE, useResponses: false }),
    modelName,
  };
}
