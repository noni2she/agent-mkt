import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchConfig, fetchScoutStatus, getActiveAccount, runScout, saveConfig, stopScout, type AccountMismatch, type TenantConfig, type ThreadsAccount } from "./api";
import { AlertBar, Badge, Button, Card } from "./components";
import { Radar, RefreshCw, X } from "./icons";

const EMPTY_CONFIG: TenantConfig = {
  keywords: [],
  minLikes: 100,
  maxAgeHours: 720,
  targetRelevant: 3,
  excludeKeywords: [],
  serpType: "default",
};

interface ScoutViewProps {
  onScoutComplete?: () => void;
}

function configKey(config: TenantConfig): string {
  return JSON.stringify(config);
}

function numberValue(value: number | null): string {
  return value == null ? "" : String(value);
}

function parseKeywordList(value: string): string[] {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ScoutView({ onScoutComplete }: ScoutViewProps) {
  const [config, setConfig] = useState<TenantConfig>(EMPTY_CONFIG);
  const [savedKey, setSavedKey] = useState(configKey(EMPTY_CONFIG));
  const [keywordInput, setKeywordInput] = useState("");
  const [excludeInput, setExcludeInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ThreadsAccount | null>(null);
  const [mismatch, setMismatch] = useState<AccountMismatch | null>(null);

  const dirty = useMemo(() => configKey(config) !== savedKey, [config, savedKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, nextActive, status] = await Promise.all([fetchConfig(), getActiveAccount(), fetchScoutStatus()]);
      setConfig(data);
      setActive(nextActive);
      setMismatch(status.accountMismatch ?? null);
      setSavedKey(configKey(data));
      setExcludeInput(data.excludeKeywords.join("\n"));
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
      await saveConfig(config);
      setSavedKey(configKey(config));
      setMessage("設定已儲存");
      window.setTimeout(() => setMessage(null), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [config, dirty]);

  const addKeyword = useCallback(() => {
    const additions = parseKeywordList(keywordInput);
    if (!additions.length) return;
    setConfig((prev) => ({ ...prev, keywords: Array.from(new Set([...prev.keywords, ...additions])) }));
    setKeywordInput("");
  }, [keywordInput]);

  const removeKeyword = useCallback((keyword: string) => {
    setConfig((prev) => ({ ...prev, keywords: prev.keywords.filter((item) => item !== keyword) }));
  }, []);

  const updateExclude = useCallback((value: string) => {
    setExcludeInput(value);
    setConfig((prev) => ({ ...prev, excludeKeywords: parseKeywordList(value) }));
  }, []);

  const startScout = useCallback(async () => {
    setError(null);
    try {
      const nextActive = await getActiveAccount();
      setActive(nextActive);
      if (!nextActive) throw new Error("請先新增並選擇一個帳號");
      setRunning(true);
      await persist();
      await runScout(config.keywords[0]);
    } catch (e) {
      setRunning(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [config.keywords, persist]);

  useEffect(() => {
    let cancelled = false;
    const checkStatus = async () => {
      try {
        const [status, nextActive] = await Promise.all([fetchScoutStatus(), getActiveAccount()]);
        if (cancelled) return;
        setActive(nextActive);
        setMismatch(status.accountMismatch ?? null);
        if (running && !status.running) {
          setRunning(false);
          onScoutComplete?.();
        }
      } catch {
        // Keep the local stop control available while the backend is briefly unreachable.
      }
    };
    const timer = window.setInterval(() => {
      void checkStatus();
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [onScoutComplete, running]);

  const stopActiveScout = useCallback(async () => {
    setStopping(true);
    setError(null);
    try {
      await stopScout();
      setRunning(false);
      setMessage("海巡已中止");
      window.setTimeout(() => setMessage(null), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStopping(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="grid flex-1 place-items-center gap-3 p-6 text-center text-[var(--text-muted)]">
        <RefreshCw width={28} height={28} className="animate-spin" />
        <p className="[font:var(--text-small)]">載入海巡設定...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
      <div className="flex max-w-[740px] flex-col gap-4">
        <div>
          <h2 className="[font:var(--fw-bold)_20px/1.2_var(--font-sans)] text-[var(--text-strong)]">海巡設定</h2>
          <p className="mt-1 [font:var(--fs-sm)/1.6_var(--font-sans)] text-[var(--text-muted)]">在 Threads 上搜尋熱門貼文，依門檻過濾後加入審核佇列。</p>
          <p className="mt-1 [font:var(--fs-sm)/1.6_var(--font-sans)] text-[var(--brand-text)]">{active ? `目前以 @${active.handle.replace(/^@/, "")} 身份海巡` : "請先新增並選擇一個帳號"}</p>
        </div>

        {mismatch ? <AlertBar tone="account-mismatch" actual={mismatch.actual} expected={mismatch.expected} /> : null}
        {error ? <AlertBar tone="warning" title="後端尚未連線">{error}</AlertBar> : null}
        {message ? <AlertBar tone="success">{message}</AlertBar> : null}

        <Card className="flex flex-col gap-[14px]">
          <div className="font-[var(--font-mono)] text-[12px] font-semibold leading-none tracking-[0.06em] text-[var(--text-muted)] uppercase">關鍵字</div>
          <div className="flex flex-wrap gap-[7px]">
            {config.keywords.length ? config.keywords.map((keyword) => (
              <Badge key={keyword} tone="brand" className="gap-[6px] rounded-[var(--radius-pill)] py-[5px] pr-[8px] pl-[11px]">
                {keyword}
                <button
                  type="button"
                  className="inline-grid h-[16px] w-[16px] cursor-pointer place-items-center rounded-full text-[var(--brand-text)] hover:bg-[var(--brand-soft-bd)] disabled:cursor-not-allowed"
                  aria-label={`移除 ${keyword}`}
                  onClick={() => removeKeyword(keyword)}
                  onBlur={() => void persist()}
                >
                  <X width={12} height={12} />
                </button>
              </Badge>
            )) : <span className="[font:var(--text-small)] text-[var(--text-faint)]">尚未設定關鍵字</span>}
          </div>
          <div className="flex flex-col gap-2">
            <label className="[font:var(--fw-medium)_var(--fs-sm)/1.3_var(--font-sans)] text-[var(--text-strong)]" htmlFor="keyword-input">新增關鍵字</label>
            <div className="flex gap-2">
              <input
                id="keyword-input"
                className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-[14px] py-[10px] text-[var(--text-strong)] outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)] [font:var(--fw-regular)_var(--fs-sm)/1.4_var(--font-sans)] focus:border-[var(--brand-500)] focus:shadow-[var(--shadow-focus)]"
                value={keywordInput}
                placeholder="買房、重劃區"
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                onBlur={() => void persist()}
              />
              <Button variant="secondary" onClick={addKeyword}>新增</Button>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col gap-[14px]">
          <div className="font-[var(--font-mono)] text-[12px] font-semibold leading-none tracking-[0.06em] text-[var(--text-muted)] uppercase">熱門門檻</div>
          <div className="grid gap-3">
            <label className="flex flex-col gap-[6px]">
              <span className="[font:var(--fw-medium)_var(--fs-sm)/1.3_var(--font-sans)] text-[var(--text-strong)]">最低讚數</span>
              <input
                className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-[14px] py-[10px] font-[var(--font-mono)] text-[var(--text-strong)] outline-none [font-variant-numeric:tabular-nums] focus:border-[var(--brand-500)] focus:shadow-[var(--shadow-focus)]"
                type="number"
                min={0}
                value={config.minLikes}
                onChange={(e) => setConfig((prev) => ({ ...prev, minLikes: Number(e.target.value || 0) }))}
                onBlur={() => void persist()}
              />
            </label>
            <label className="flex flex-col gap-[6px]">
              <span className="[font:var(--fw-medium)_var(--fs-sm)/1.3_var(--font-sans)] text-[var(--text-strong)]">最長貼文年齡（小時）</span>
              <input
                className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-[14px] py-[10px] font-[var(--font-mono)] text-[var(--text-strong)] outline-none [font-variant-numeric:tabular-nums] focus:border-[var(--brand-500)] focus:shadow-[var(--shadow-focus)]"
                type="number"
                min={0}
                value={numberValue(config.maxAgeHours)}
                placeholder="不限"
                onChange={(e) => setConfig((prev) => ({ ...prev, maxAgeHours: e.target.value === "" ? null : Number(e.target.value) }))}
                onBlur={() => void persist()}
              />
            </label>
            <label className="flex flex-col gap-[6px]">
              <span className="[font:var(--fw-medium)_var(--fs-sm)/1.3_var(--font-sans)] text-[var(--text-strong)]">目標相關數</span>
              <input
                className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-[14px] py-[10px] font-[var(--font-mono)] text-[var(--text-strong)] outline-none [font-variant-numeric:tabular-nums] focus:border-[var(--brand-500)] focus:shadow-[var(--shadow-focus)]"
                type="number"
                min={1}
                value={config.targetRelevant}
                onChange={(e) => setConfig((prev) => ({ ...prev, targetRelevant: Number(e.target.value || 1) }))}
                onBlur={() => void persist()}
              />
            </label>
          </div>
        </Card>

        <Card className="flex flex-col gap-[14px]">
          <div className="font-[var(--font-mono)] text-[12px] font-semibold leading-none tracking-[0.06em] text-[var(--text-muted)] uppercase">搜尋模式</div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant={config.serpType === "default" ? "primary" : "secondary"} onClick={() => setConfig((prev) => ({ ...prev, serpType: "default" }))}>Default</Button>
            <Button variant={config.serpType === "recent" ? "primary" : "secondary"} onClick={() => setConfig((prev) => ({ ...prev, serpType: "recent" }))}>Recent</Button>
          </div>
        </Card>

        <Card className="flex flex-col gap-[14px]">
          <div className="font-[var(--font-mono)] text-[12px] font-semibold leading-none tracking-[0.06em] text-[var(--text-muted)] uppercase">排除關鍵字</div>
          <textarea
            className="min-h-[94px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-[14px] py-3 text-[var(--text-strong)] outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)] [font:var(--fw-regular)_var(--fs-body)/var(--lh-relaxed)_var(--font-sans)] focus:border-[var(--brand-500)] focus:shadow-[var(--shadow-focus)]"
            value={excludeInput}
            placeholder="每行或逗號分隔"
            onChange={(e) => updateExclude(e.target.value)}
            onBlur={() => void persist()}
          />
        </Card>

        <div className="flex flex-col gap-3">
          <Button
            variant={running ? "danger" : "primary"}
            size="lg"
            full
            icon={running ? <X /> : <Radar />}
            disabled={stopping || (!running && (!config.keywords.length || !active))}
            onClick={() => void (running ? stopActiveScout() : startScout())}
          >
            {running ? (stopping ? "中止中..." : "中止海巡") : "執行海巡"}
          </Button>
          <Button variant="secondary" full disabled={saving || !dirty} onClick={() => void persist()}>
            {saving ? "儲存中..." : dirty ? "儲存設定" : "設定已儲存"}
          </Button>
          <span className="font-[var(--font-mono)] text-[12px] leading-none text-[var(--text-faint)]">上次：尚無即時資料</span>
        </div>

        <Card className="mb-2">
          <div className="mb-3 font-[var(--font-mono)] text-[12px] font-semibold leading-none tracking-[0.06em] text-[var(--text-muted)] uppercase">上次海巡結果</div>
          <div className="grid grid-cols-2 gap-4">
            {[
              ["瀏覽貼文", "--"],
              ["通過門檻", "--"],
              ["加入佇列", "--"],
              ["偵測訊號", "待執行"],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="font-[var(--font-mono)] text-[22px] font-bold leading-none text-[var(--text-strong)] [font-variant-numeric:tabular-nums]">{value}</div>
                <div className="mt-1 [font:var(--fs-xs)/1_var(--font-sans)] text-[var(--text-muted)]">{label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
