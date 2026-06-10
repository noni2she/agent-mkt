import { useState } from "react";
import ReviewQueue from "./ReviewQueue";
import ScoutView from "./ScoutView";
import { Card, NavItem } from "./components";
import { BookMarked, Inbox, Radar } from "./icons";

type Screen = "review" | "scout" | "kb";

function Placeholder({ title }: { title: string }) {
  return (
    <div className="grid flex-1 place-items-center p-6">
      <Card pad={18}>
        <h2 className="[font:var(--text-h2)] text-[var(--text-strong)]">{title}</h2>
        <p className="mt-2 [font:var(--text-small)] text-[var(--text-muted)]">即將推出</p>
      </Card>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("scout");
  const [pendingCount, setPendingCount] = useState(0);

  return (
    <div className="flex h-screen bg-[var(--surface-page)]">
      <aside className="flex w-[248px] shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 pt-[18px] pb-5">
        <header className="mb-[22px] flex items-center gap-[10px] px-0.5">
          <img className="h-[30px] w-[30px] shrink-0" src="/logo-mark.svg" alt="" />
          <div>
            <h1 className="[font:var(--fw-bold)_15px/1.1_var(--font-sans)] text-[var(--text-strong)]">Agent MKT</h1>
            <p className="mt-0.5 font-[var(--font-mono)] text-[12px] leading-none text-[var(--text-muted)]">HouseGuide.ai</p>
          </div>
        </header>

        <nav className="flex flex-col gap-0.5" aria-label="主要功能">
          <NavItem icon={<Radar />} label="海巡" active={screen === "scout"} onClick={() => setScreen("scout")} />
          <NavItem icon={<Inbox />} label="審核佇列" count={pendingCount} active={screen === "review"} onClick={() => setScreen("review")} />
          <NavItem icon={<BookMarked />} label="知識庫" active={screen === "kb"} onClick={() => setScreen("kb")} />
        </nav>

        <footer className="mt-auto border-t border-[var(--border-subtle)] px-1 pt-[14px] font-[var(--font-mono)] text-[11px] leading-normal text-[var(--text-faint)]">
          <div>v0.1.0 · PoC</div>
          <div className="mt-0.5">非商業用途</div>
        </footer>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {screen === "review" ? <ReviewQueue onCountChange={setPendingCount} /> : null}
        {screen === "scout" ? <ScoutView onScoutComplete={() => setScreen("review")} /> : null}
        {screen === "kb" ? <Placeholder title="知識庫" /> : null}
      </main>
    </div>
  );
}
