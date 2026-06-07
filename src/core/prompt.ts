/** agent 的 4 類定義（現在來自 configs/agent/*.md；未來來自 DB）。 */
export interface AgentDef {
  persona: string;
  ownedProduct: string;
  marketingStrategy: string;
  contentWritingRule: string;
}

/** 組 reviewer agent 的 instructions：注入 4 類定義，供「相關性判斷 + 寫 reply」用。 */
export function buildReviewerInstructions(def: AgentDef, keyword: string): string {
  return [
    `# 你的身份 Persona`,
    def.persona,
    ``,
    `# 我們的產品 Owned Product`,
    def.ownedProduct,
    ``,
    `# 行銷策略 Marketing Strategy`,
    def.marketingStrategy,
    ``,
    `# 寫作規範 Content Writing Rule`,
    def.contentWritingRule,
    ``,
    `---`,
    `以上是你的身份、產品知識、行銷策略與寫作規範。針對使用者提供的一篇 Threads 貼文：`,
    `1) 用行銷專家視角判斷它是否與關鍵字「${keyword}」及我們的品牌／受眾／策略高度相關、且值得互動。`,
    `2) 若相關：嚴格依「寫作規範」（含 Hard/Soft Rules、文筆、reply 規範）寫一則回覆草稿。`,
    `3) 若不相關：relevant=false、draft 留空字串。`,
    `輸出 relevant(布林)、reason(簡短中文理由)、draft(回覆草稿；不相關則空字串)。`,
  ].join("\n");
}
