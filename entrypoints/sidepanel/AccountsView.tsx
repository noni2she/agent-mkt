import { useCallback, useEffect, useMemo, useState } from "react";
import { createAccount, deleteAccount, getActiveAccount, listAccounts, PreviewingBlockError, setActiveAccount, type ThreadsAccount } from "./api";
import { AlertBar, Button, Card, StatusChip, TextArea } from "./components";

interface AccountsViewProps {
  forceCreate?: boolean;
  onAccountsChanged?: () => void;
}

const inputClass = "w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-[14px] py-[10px] text-[var(--text-strong)] outline-none focus:border-[var(--brand-500)] focus:shadow-[var(--shadow-focus)] [font:var(--fw-regular)_var(--fs-sm)/1.4_var(--font-sans)]";
const showHandle = (handle: string) => `@${handle.replace(/^@/, "")}`;

export default function AccountsView({ forceCreate = false, onAccountsChanged }: AccountsViewProps) {
  const [accounts, setAccounts] = useState<ThreadsAccount[]>([]);
  const [active, setActive] = useState<ThreadsAccount | null>(null);
  const [showForm, setShowForm] = useState(forceCreate);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [persona, setPersona] = useState("");
  const [strategy, setStrategy] = useState("");
  const [rule, setRule] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextAccounts, nextActive] = await Promise.all([listAccounts(), getActiveAccount()]);
      setAccounts(nextAccounts);
      setActive(nextActive);
      if (nextAccounts.length === 0) setShowForm(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const valid = useMemo(() => handle.trim().replace(/^@/, "") !== "" && displayName.trim() !== "" && persona.trim() !== "", [displayName, handle, persona]);

  const add = useCallback(async () => {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createAccount({ handle: handle.trim().replace(/^@/, ""), display_name: displayName.trim(), persona: persona.trim(), marketing_strategy: strategy.trim(), content_writing_rule: rule.trim() });
      if (accounts.length === 0) await setActiveAccount(created.id);
      setHandle(""); setDisplayName(""); setPersona(""); setStrategy(""); setRule(""); setShowForm(false);
      await load();
      onAccountsChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [accounts.length, displayName, handle, load, onAccountsChanged, persona, rule, strategy, valid]);

  const activate = useCallback(async (account: ThreadsAccount) => {
    try {
      await setActiveAccount(account.id);
      setActive(account);
      onAccountsChanged?.();
    } catch (e) {
      if (e instanceof PreviewingBlockError) {
        window.alert(`${active ? showHandle(active.handle) : "目前帳號"} 有 ${e.previewingCount} 筆預覽中，請先 resolve`);
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }, [active, onAccountsChanged]);

  const remove = useCallback(async (account: ThreadsAccount) => {
    if (active?.id === account.id) return;
    await deleteAccount(account.id).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    await load();
    onAccountsChanged?.();
  }, [active?.id, load, onAccountsChanged]);

  return <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
    <div className="flex max-w-[740px] flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="[font:var(--fw-bold)_20px/1.2_var(--font-sans)] text-[var(--text-strong)]">Threads 帳號</h2><p className="mt-1 text-sm text-[var(--text-muted)]">管理帳號人格，並選擇目前操作的 active 帳號。</p></div>
        <Button variant="primary" onClick={() => setShowForm((value) => !value)}>{showForm ? "收起" : "+ 新增帳號"}</Button>
      </div>
      {error ? <AlertBar tone="warning" title="帳號操作失敗">{error}</AlertBar> : null}
      {showForm ? <Card className="flex flex-col gap-[14px]">
        <label className="flex flex-col gap-[6px]"><span className="text-sm font-medium text-[var(--text-strong)]">Threads handle *</span><input className={inputClass} value={handle} placeholder="例：houseguide" onChange={(e) => setHandle(e.target.value)} /></label>
        <label className="flex flex-col gap-[6px]"><span className="text-sm font-medium text-[var(--text-strong)]">顯示名稱 *</span><input className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
        <TextArea label="帳號人格 Persona *" value={persona} className="min-h-[110px]" onChange={(e) => setPersona(e.target.value)} />
        <TextArea label="行銷策略 Marketing Strategy" value={strategy} className="min-h-[90px]" onChange={(e) => setStrategy(e.target.value)} />
        <TextArea label="寫稿規則 Content Writing Rule" value={rule} className="min-h-[90px]" onChange={(e) => setRule(e.target.value)} />
        <Button variant="primary" disabled={saving || !valid} onClick={() => void add()}>{saving ? "新增中..." : "新增帳號"}</Button>
      </Card> : null}
      {loading ? <p className="text-sm text-[var(--text-muted)]">載入中...</p> : accounts.map((account) => {
        const isActive = active?.id === account.id;
        return <Card key={account.id} className="flex items-center justify-between gap-3">
          <div className="min-w-0"><div className="flex items-center gap-2"><strong className="truncate text-[var(--text-strong)]">{showHandle(account.handle)}</strong>{isActive ? <StatusChip tone="success">active</StatusChip> : null}</div><p className="mt-1 truncate text-sm text-[var(--text-muted)]">{account.display_name}</p></div>
          <div className="flex shrink-0 gap-2"><Button size="sm" disabled={isActive} onClick={() => void activate(account)}>設為 active</Button><Button size="sm" variant="danger" disabled={isActive} title={isActive ? "請先切換 active 帳號" : undefined} onClick={() => void remove(account)}>軟刪除</Button></div>
        </Card>;
      })}
    </div>
  </div>;
}
