import { useCallback, useEffect, useState } from "react";
import KnowledgeView from "./KnowledgeView";
import ReviewQueue from "./ReviewQueue";
import ScoutView from "./ScoutView";
import SetupWizard from "./SetupWizard";
import AccountsView from "./AccountsView";
import AccountSwitcher from "./components/AccountSwitcher";
import { fetchTenant, listAccounts, type TenantInfo } from "./api";
import { NavItem } from "./components";
import { BookMarked, Inbox, Moon, Radar, RefreshCw, Sun } from "./icons";

type Screen = "review" | "scout" | "kb" | "accounts";

export default function App() {
  const [screen, setScreen] = useState<Screen>("scout");
  const [pendingCount, setPendingCount] = useState(0);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccounts, setHasAccounts] = useState<boolean | null>(null);
  const [accountRevision, setAccountRevision] = useState(0);

  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const loadTenant = useCallback(async () => {
    setLoading(true);
    try {
      const nextTenant = await fetchTenant();
      setTenant(nextTenant);
      setHasAccounts(nextTenant.onboarded ? (await listAccounts()).length > 0 : null);
    } catch {
      setTenant({ brandName: "", threadsHandle: "", onboarded: false });
      setHasAccounts(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTenant();
  }, [loadTenant]);

  const brandLine = tenant?.brandName?.trim() ? tenant.brandName : "尚未設定品牌";
  const accountsChanged = useCallback(() => {
    setAccountRevision((value) => value + 1);
    void listAccounts().then((accounts) => setHasAccounts(accounts.length > 0));
  }, []);

  return (
    <div className="flex h-screen flex-col bg-[var(--surface-page)]">
      <header className="flex shrink-0 items-center gap-[10px] border-b border-[var(--border-subtle)] bg-[var(--surface-card)] px-[14px] py-[18px]">
        <img className="h-[30px] w-[30px] shrink-0" src="/logo-mark.svg" alt="" />
        <div>
          <h1 className="[font:var(--fw-black)_15px/1.1_var(--font-sans)] text-[var(--text-strong)]">Agent MKT</h1>
          <p className="mt-[4px] font-[var(--font-mono)] text-[12px] leading-none text-[var(--text-muted)]">{brandLine}</p>
          {tenant?.onboarded ? <AccountSwitcher revision={accountRevision} onManageAccounts={() => setScreen("accounts")} onActiveChange={() => setAccountRevision((value) => value + 1)} /> : null}
        </div>
        <button
          type="button"
          onClick={() => setDark((v) => !v)}
          aria-label={dark ? "切換為日間主題" : "切換為夜間主題"}
          className="ml-auto inline-grid h-[34px] w-[34px] cursor-pointer place-items-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-inset)] hover:text-[var(--text-strong)]"
        >
          {dark ? <Sun width={18} height={18} /> : <Moon width={18} height={18} />}
        </button>
      </header>

      {loading ? (
        <div className="grid flex-1 place-items-center gap-3 p-6 text-center text-[var(--text-muted)]">
          <RefreshCw width={28} height={28} className="animate-spin" />
          <p className="[font:var(--text-small)]">載入中...</p>
        </div>
      ) : tenant && !tenant.onboarded ? (
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <SetupWizard onComplete={() => void loadTenant()} />
        </main>
      ) : tenant?.onboarded && hasAccounts === false ? (
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden"><AccountsView forceCreate onAccountsChanged={accountsChanged} /></main>
      ) : (
        <>
          <nav className="flex shrink-0 gap-1 border-b border-[var(--border-subtle)] bg-[var(--surface-card)] p-2" aria-label="主要功能">
            <NavItem icon={<Radar />} label="海巡" active={screen === "scout"} onClick={() => setScreen("scout")} />
            <NavItem icon={<Inbox />} label="審核佇列" count={pendingCount} active={screen === "review"} onClick={() => setScreen("review")} />
            <NavItem icon={<BookMarked />} label="知識庫" active={screen === "kb"} onClick={() => setScreen("kb")} />
            <NavItem icon={<span className="font-bold">@</span>} label="帳號" active={screen === "accounts"} onClick={() => setScreen("accounts")} />
          </nav>

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {screen === "review" ? <ReviewQueue onCountChange={setPendingCount} /> : null}
            {screen === "scout" ? <ScoutView onScoutComplete={() => setScreen("review")} /> : null}
            {screen === "kb" ? <KnowledgeView /> : null}
            {screen === "accounts" ? <AccountsView onAccountsChanged={accountsChanged} /> : null}
          </main>
        </>
      )}
    </div>
  );
}
