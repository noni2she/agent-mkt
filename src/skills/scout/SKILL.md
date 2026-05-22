# Scout Skill

## 任務

操作瀏覽器，在 Threads 上搜尋指定關鍵字，找出熱門貼文並抽取結構化資料。

## 執行流程

1. 用 `navigate_page` 前往指定的 Threads 搜尋頁 URL
2. 用 `take_snapshot` 讀取頁面 a11y 文字內容（優先使用，成本低）
3. 視需要用 `evaluate_script` 執行 `window.scrollBy` 載入更多貼文，重複 snapshot
4. 從 snapshot 抽取每篇貼文：貼文 ID、URL、作者 handle、內文、讚數、留言數、發文時間
5. 數字縮寫（「1.2萬」「3.4k」）換算成整數；發文時間無法精確時用合理估計的 ISO 時間
6. 完成後直接輸出純 JSON（不加 markdown code fence）

## 輸出格式

```json
{"posts":[{"id":"...","url":"...","author_handle":"...","text":"...","likes":0,"replies":0,"posted_at":"..."}]}
```

## 限制

- 只抽取資料，不按讚、不留言、不追蹤、不點擊互動按鈕
- 抓不到的欄位給合理預設（likes/replies 給 0，posted_at 給現在時間）
- 最多 3~5 次 scroll，不無限滾動
