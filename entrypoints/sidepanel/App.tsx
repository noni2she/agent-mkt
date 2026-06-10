import { useState } from "react";
import ReviewQueue from "./ReviewQueue";
import { Badge, Card, NavItem } from "./components";
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
  const [screen, setScreen] = useState<Screen>("review");
  const [pendingCount, setPendingCount] = useState(0);

  return (
    <div className="flex h-screen flex-col bg-[var(--surface-page)]">
      <header className="flex h-[66px] shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-card)] px-5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-[var(--radius-md)] bg-[var(--surface-ink)] font-[var(--font-serif)] text-[20px] font-[var(--fw-black)] leading-none text-[var(--text-inverse)]">a</div>
          <div>
            <h1 className="[font:var(--fw-bold)_17px/1.15_var(--font-sans)] text-[var(--text-strong)]">agent-mkt</h1>
            <p className="mt-1 font-[var(--font-mono)] text-[11px] leading-none text-[var(--text-muted)]">HouseGuide.ai</p>
          </div>
        </div>
        <Badge tone="brand" solid>{pendingCount}</Badge>
      </header>

      <nav className="flex shrink-0 gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-card)] p-3" aria-label="主要功能">
        <NavItem icon={<Radar />} label="海巡" active={screen === "scout"} onClick={() => setScreen("scout")} />
        <NavItem icon={<Inbox />} label="審核佇列" count={pendingCount} active={screen === "review"} onClick={() => setScreen("review")} />
        <NavItem icon={<BookMarked />} label="知識庫" active={screen === "kb"} onClick={() => setScreen("kb")} />
      </nav>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {screen === "review" ? <ReviewQueue onCountChange={setPendingCount} /> : null}
        {screen === "scout" ? <Placeholder title="海巡" /> : null}
        {screen === "kb" ? <Placeholder title="知識庫" /> : null}
      </main>
    </div>
  );
}
