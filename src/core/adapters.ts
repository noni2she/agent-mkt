import type { ScoutedPost } from "./types.js";

/** 鍵值持久化（impl: SQLite / in-memory）。 */
export interface Storage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

/** 機密讀取（impl: 後端 env / keychain）。永遠不在 extension 實作。 */
export interface SecretStore {
  getSecret(name: string): Promise<string | null>;
}

/** 取候選貼文（impl: extension-DOM；未來 Meta-API）。後續計畫補方法簽章。 */
export interface ScoutAdapter {
  /** 回傳一批候選（尚未經 LLM 判斷）。keyword 為海巡關鍵字。 */
  scout(keyword: string): Promise<ScoutedPost[]>;
}

/** 發 reply / 發文（impl: extension-DOM；未來 Meta-API）。 */
export interface PublisherAdapter {
  postReply(url: string, text: string): Promise<void>;
  createPost(text: string): Promise<void>;
}

/** LLM 呼叫（impl: openai / @openai/agents）。吸收各 model 能力差異。 */
export interface LLMClient {
  complete(prompt: string): Promise<string>;
}
