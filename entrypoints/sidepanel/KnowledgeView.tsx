import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAgentDef, listAccounts, saveAgentDef, updateAccount, type AgentDef, type ThreadsAccount } from "./api";
import { AlertBar, Button, Card, TextArea } from "./components";
import { RefreshCw } from "./icons";

const EMPTY_DEF: AgentDef = { persona: "", ownedProduct: "", marketingStrategy: "", contentWritingRule: "" };
const accountKey = (account: ThreadsAccount) => JSON.stringify([account.persona, account.marketing_strategy, account.content_writing_rule]);
const showHandle = (handle: string) => `@${handle.replace(/^@/, "")}`;

export default function KnowledgeView() {
  const [def, setDef] = useState<AgentDef>(EMPTY_DEF);
  const [accounts, setAccounts] = useState<ThreadsAccount[]>([]);
  const [selected, setSelected] = useState<string>("brand");
  const [savedKey, setSavedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const account = accounts.find((item) => item.id === selected) ?? null;
  const currentKey = account ? accountKey(account) : def.ownedProduct;
  const dirty = useMemo(() => currentKey !== savedKey, [currentKey, savedKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextDef, nextAccounts] = await Promise.all([fetchAgentDef(), listAccounts()]);
      setDef(nextDef);
      setAccounts(nextAccounts);
      setSelected((value) => value === "brand" || nextAccounts.some((item) => item.id === value) ? value : "brand");
      setSavedKey(nextDef.ownedProduct);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectTab = useCallback((id: string) => {
    setSelected(id);
    const nextAccount = accounts.find((item) => item.id === id);
    setSavedKey(nextAccount ? accountKey(nextAccount) : def.ownedProduct);
    setMessage(null);
  }, [accounts, def.ownedProduct]);

  const changeAccount = useCallback((patch: Partial<ThreadsAccount>) => {
    setAccounts((items) => items.map((item) => item.id === selected ? { ...item, ...patch } : item));
  }, [selected]);

  const persist = useCallback(async () => {
    if (!dirty) return;
    setSaving(true);
    setError(null);
    try {
      if (account) {
        await updateAccount(account.id, {
          persona: account.persona,
          marketing_strategy: account.marketing_strategy,
          content_writing_rule: account.content_writing_rule,
        });
        setSavedKey(accountKey(account));
      } else {
        await saveAgentDef(def);
        setSavedKey(def.ownedProduct);
      }
      setMessage("知識庫已儲存");
      window.setTimeout(() => setMessage(null), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [account, def, dirty]);

  if (loading) return <div className="grid flex-1 place-items-center gap-3 p-6 text-center text-[var(--text-muted)]"><RefreshCw width={28} height={28} className="animate-spin" /><p className="[font:var(--text-small)]">載入知識庫...</p></div>;

  return <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
    <div className="flex max-w-[740px] flex-col gap-4">
      <div><h2 className="[font:var(--fw-bold)_20px/1.2_var(--font-sans)] text-[var(--text-strong)]">知識庫</h2><p className="mt-1 [font:var(--fs-sm)/1.6_var(--font-sans)] text-[var(--text-muted)]">品牌資訊由所有帳號共用；人設、策略與寫稿規範則各帳號獨立。</p></div>

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)]" role="tablist" aria-label="知識庫分類">
        {[{ id: "brand", label: "品牌資訊" }, ...accounts.map((item) => ({ id: item.id, label: showHandle(item.handle) }))].map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={selected === tab.id} className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${selected === tab.id ? "border-[var(--brand)] text-[var(--brand-text)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-strong)]"}`} onClick={() => selectTab(tab.id)}>{tab.label}</button>)}
      </div>

      {error ? <AlertBar tone="warning" title="知識庫操作失敗">{error}</AlertBar> : null}
      {message ? <AlertBar tone="success">{message}</AlertBar> : null}

      {account ? <>
        <Card><TextArea label="人設 Persona" value={account.persona} className="min-h-[140px]" dense placeholder="描述小編的身份與語氣。" onChange={(e) => changeAccount({ persona: e.target.value })} /></Card>
        <Card><TextArea label="行銷策略 Marketing Strategy" value={account.marketing_strategy} className="min-h-[140px]" dense placeholder="切入角度、目標受眾、主要訴求。" onChange={(e) => changeAccount({ marketing_strategy: e.target.value })} /></Card>
        <Card><TextArea label="寫稿規範 Content Writing Rule" value={account.content_writing_rule} className="min-h-[140px]" dense placeholder="Hard / Soft Rules、用字與長度限制。" onChange={(e) => changeAccount({ content_writing_rule: e.target.value })} /></Card>
      </> : <Card><TextArea label="自家產品 Owned Product" value={def.ownedProduct} className="min-h-[180px]" dense placeholder="核心產品、服務、價值、受眾與關心的主題。" onChange={(e) => setDef((value) => ({ ...value, ownedProduct: e.target.value }))} /></Card>}

      <Button variant="primary" size="lg" full className="mb-2" disabled={saving || !dirty} onClick={() => void persist()}>{saving ? "儲存中..." : dirty ? "儲存知識庫" : "已儲存"}</Button>
    </div>
  </div>;
}
