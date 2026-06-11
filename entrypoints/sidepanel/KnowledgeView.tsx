import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAgentDef, saveAgentDef, type AgentDef } from "./api";
import { AlertBar, Button, Card, TextArea } from "./components";
import { RefreshCw } from "./icons";

const EMPTY_DEF: AgentDef = { persona: "", ownedProduct: "", marketingStrategy: "", contentWritingRule: "" };

const FIELDS: { key: keyof AgentDef; label: string; hint: string; placeholder: string }[] = [
  { key: "persona", label: "人設 Persona", hint: "小編是誰、語氣、立場", placeholder: "描述小編的身份與語氣。可用 Markdown（## 標題、- 列點、**粗體**）。" },
  { key: "ownedProduct", label: "自家產品 Owned Product", hint: "要行銷的產品/服務與賣點", placeholder: "你是做什麼的、核心產品/服務、價值、受眾、關心的主題。可用 Markdown。" },
  { key: "marketingStrategy", label: "行銷策略 Marketing Strategy", hint: "切入角度、目標受眾、訴求", placeholder: "切入角度、目標受眾、主要訴求。可用 Markdown。" },
  { key: "contentWritingRule", label: "寫稿規範 Content Writing Rule", hint: "hard / soft rules、用字與長度限制", placeholder: "Hard / Soft Rules、用字與長度限制。可用 Markdown（建議用 ## 分段）。" },
];

function defKey(def: AgentDef): string {
  return JSON.stringify(def);
}

export default function KnowledgeView() {
  const [def, setDef] = useState<AgentDef>(EMPTY_DEF);
  const [savedKey, setSavedKey] = useState(defKey(EMPTY_DEF));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => defKey(def) !== savedKey, [def, savedKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAgentDef();
      setDef(data);
      setSavedKey(defKey(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(async () => {
    if (!dirty) return;
    setSaving(true);
    setError(null);
    try {
      await saveAgentDef(def);
      setSavedKey(defKey(def));
      setMessage("知識庫已儲存");
      window.setTimeout(() => setMessage(null), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [def, dirty]);

  if (loading) {
    return (
      <div className="grid flex-1 place-items-center gap-3 p-6 text-center text-[var(--text-muted)]">
        <RefreshCw width={28} height={28} className="animate-spin" />
        <p className="[font:var(--text-small)]">載入知識庫...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
      <div className="flex max-w-[740px] flex-col gap-4">
        <div>
          <h2 className="[font:var(--fw-bold)_20px/1.2_var(--font-sans)] text-[var(--text-strong)]">知識庫</h2>
          <p className="mt-1 [font:var(--fs-sm)/1.6_var(--font-sans)] text-[var(--text-muted)]">編輯 AI 小編的人設與寫稿規範；判斷相關性與草擬回覆時會注入這些定義。</p>
        </div>

        {error ? <AlertBar tone="warning" title="後端尚未連線">{error}</AlertBar> : null}
        {message ? <AlertBar tone="success">{message}</AlertBar> : null}

        {FIELDS.map((f) => (
          <Card key={f.key} className="flex flex-col gap-[10px]">
            <TextArea
              label={f.label}
              value={def[f.key]}
              className="min-h-[140px]"
              placeholder={f.placeholder}
              onChange={(e) => setDef((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
            <span className="[font:var(--fs-xs)/1.4_var(--font-sans)] text-[var(--text-faint)]">{f.hint}</span>
          </Card>
        ))}

        <Button variant="primary" size="lg" full className="mb-2" disabled={saving || !dirty} onClick={() => void persist()}>
          {saving ? "儲存中..." : dirty ? "儲存知識庫" : "已儲存"}
        </Button>
      </div>
    </div>
  );
}
