import { useCallback, useEffect, useRef, useState } from "react";
import { getActiveAccount, listAccounts, PreviewingBlockError, setActiveAccount, type ThreadsAccount } from "../api";

interface AccountSwitcherProps {
  revision?: number;
  onManageAccounts: () => void;
  onActiveChange?: () => void;
}

const showHandle = (handle: string) => `@${handle.replace(/^@/, "")}`;

export default function AccountSwitcher({ revision, onManageAccounts, onActiveChange }: AccountSwitcherProps) {
  const [accounts, setAccounts] = useState<ThreadsAccount[]>([]);
  const [active, setActive] = useState<ThreadsAccount | null>(null);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [nextAccounts, nextActive] = await Promise.all([listAccounts(), getActiveAccount()]);
    setAccounts(nextAccounts); setActive(nextActive);
  }, []);

  useEffect(() => { void load().catch(() => undefined); }, [load, revision]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const select = useCallback(async (account: ThreadsAccount) => {
    const previous = active;
    setActive(account); setOpen(false);
    try {
      await setActiveAccount(account.id);
      onActiveChange?.();
    } catch (e) {
      setActive(previous);
      if (e instanceof PreviewingBlockError) window.alert(`${previous ? showHandle(previous.handle) : "目前帳號"} 有 ${e.previewingCount} 筆預覽中，請先 resolve`);
      else window.alert(e instanceof Error ? e.message : String(e));
    }
  }, [active, onActiveChange]);

  return <div ref={root} className="relative mt-[5px]">
    <button type="button" className="rounded px-1 py-0.5 font-[var(--font-mono)] text-[12px] leading-none text-[var(--brand-text)] hover:bg-[var(--brand-soft)]" onClick={() => setOpen((value) => !value)}>{active ? showHandle(active.handle) : "未選擇帳號"} ▼</button>
    {open ? <div className="absolute left-0 top-full z-20 mt-2 min-w-[190px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-card)]">
      {accounts.filter((account) => account.id !== active?.id).map((account) => <button key={account.id} type="button" className="block w-full px-3 py-2 text-left text-sm text-[var(--text-body)] hover:bg-[var(--surface-inset)]" onClick={() => void select(account)}>{showHandle(account.handle)}</button>)}
      <button type="button" className="block w-full border-t border-[var(--border-subtle)] px-3 py-2 text-left text-sm font-medium text-[var(--brand-text)] hover:bg-[var(--brand-soft)]" onClick={() => { setOpen(false); onManageAccounts(); }}>+ 新增帳號</button>
    </div> : null}
  </div>;
}
