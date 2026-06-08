The draft-editing textarea — central to the review flow. Supports a character budget counter and the dashed "empty / stage-2 not generated" state.

```jsx
<TextArea label="AI 草稿（可直接改寫）" maxHint={60} value={draft} onChange={e => setDraft(e.target.value)} />
<TextArea label="AI 回應草稿（階段二尚未產生）" empty placeholder="目前僅海巡。階段二將由 AI 為這篇貼文產生回應草稿。" />
```
