# Write-Post Skill

## 任務

依據品牌 persona 和風格指紋，撰寫符合品牌聲音的 Threads 原創貼文。

## 輸入

- 品牌 persona（`configs/persona_example.yaml`）
- 商業規範（`configs/business_rules.yaml`）
- 風格範例（由 `skills/scripts/extractor.ts` 從歷史貼文萃取）
- 貼文素材/主題 brief

## 輸出

純文字貼文內容，不含任何解釋或包裝。

## 硬性限制

- 不得違反 `business_rules.yaml` 中的任何 hard_rule
- 不含外部連結
- 不揭露為 AI 生成

## 風格動態學習

`skills/scripts/extractor.ts` 分析品牌歷史貼文的文筆指紋（句長、emoji 頻率、用詞習慣），
動態補充 persona 的 `style_fingerprint`，讓生成結果更貼近品牌真實語感。
