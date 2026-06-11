import { useState } from "react";
import KnowledgeView from "./KnowledgeView";
import ReviewQueue from "./ReviewQueue";
import ScoutView from "./ScoutView";
import { NavItem } from "./components";
import { BookMarked, Inbox, Radar } from "./icons";

type Screen = "review" | "scout" | "kb";

export default function App() {
  const [screen, setScreen] = useState<Screen>("scout");
  const [pendingCount, setPendingCount] = useState(0);

  return (
    <div className="flex h-screen flex-col bg-[var(--surface-page)]">
      <header className="flex shrink-0 items-center gap-[10px] border-b border-[var(--border-subtle)] bg-[var(--surface-card)] px-[14px] py-[18px]">
        <img className="h-[30px] w-[30px] shrink-0" src="/logo-mark.svg" alt="" />
        <div>
          <h1 className="[font:var(--fw-bold)_15px/1.1_var(--font-sans)] text-[var(--text-strong)]">Agent MKT</h1>
          <p className="mt-0.5 font-[var(--font-mono)] text-[12px] leading-none text-[var(--text-muted)]">HouseGuide.ai</p>
        </div>
      </header>

      <nav className="flex shrink-0 gap-1 border-b border-[var(--border-subtle)] bg-[var(--surface-card)] p-2" aria-label="主要功能">
        <NavItem icon={<Radar />} label="海巡" active={screen === "scout"} onClick={() => setScreen("scout")} />
        <NavItem icon={<Inbox />} label="審核佇列" count={pendingCount} active={screen === "review"} onClick={() => setScreen("review")} />
        <NavItem icon={<BookMarked />} label="知識庫" active={screen === "kb"} onClick={() => setScreen("kb")} />
      </nav>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {screen === "review" ? <ReviewQueue onCountChange={setPendingCount} /> : null}
        {screen === "scout" ? <ScoutView onScoutComplete={() => setScreen("review")} /> : null}
        {screen === "kb" ? <KnowledgeView /> : null}
      </main>
    </div>
  );
}
