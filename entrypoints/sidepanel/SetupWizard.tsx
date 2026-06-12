import { useCallback, useMemo, useState } from "react";
import { onboardTenant } from "./api";
import { AlertBar, Button, Card, TextArea } from "./components";

interface SetupWizardProps {
  onComplete: () => void;
}

const inputClass =
  "min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-[14px] py-[10px] text-[var(--text-strong)] outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)] [font:var(--fw-regular)_var(--fs-sm)/1.4_var(--font-sans)] focus:border-[var(--brand-500)] focus:shadow-[var(--shadow-focus)]";

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [brandName, setBrandName] = useState("");
  const [threadsHandle, setThreadsHandle] = useState("");
  const [ownedProduct, setOwnedProduct] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = useMemo(
    () => brandName.trim() !== "" && threadsHandle.trim() !== "" && ownedProduct.trim() !== "",
    [brandName, threadsHandle, ownedProduct],
  );

  const submit = useCallback(async () => {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await onboardTenant({ brandName: brandName.trim(), threadsHandle: threadsHandle.trim(), ownedProduct: ownedProduct.trim() });
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [brandName, threadsHandle, ownedProduct, valid, onComplete]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
      <div className="flex max-w-[740px] flex-col gap-4">
        <div>
          <h2 className="[font:var(--fw-bold)_20px/1.2_var(--font-sans)] text-[var(--text-strong)]">設定您的品牌</h2>
          <p className="mt-1 [font:var(--fs-sm)/1.6_var(--font-sans)] text-[var(--text-muted)]">Agent MKT 是你的 AI 行銷小編——它會在 Threads 上巡邏熱門貼文、判斷哪些和你的品牌相關，並草擬回覆，發布前都由你審核。開始前，先讓它認識你的品牌。</p>
        </div>

        {error ? <AlertBar tone="warning" title="設定失敗">{error}</AlertBar> : null}

        <Card className="flex flex-col gap-[14px]">
          <label className="flex flex-col gap-[6px]">
            <span className="[font:var(--fw-medium)_var(--fs-sm)/1.3_var(--font-sans)] text-[var(--text-strong)]">品牌名稱 *</span>
            <input className={inputClass} value={brandName} placeholder="例：HouseGuide.ai" onChange={(e) => setBrandName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-[6px]">
            <span className="[font:var(--fw-medium)_var(--fs-sm)/1.3_var(--font-sans)] text-[var(--text-strong)]">Threads 帳號 *</span>
            <input className={inputClass} value={threadsHandle} placeholder="例：@houseguide" onChange={(e) => setThreadsHandle(e.target.value)} />
          </label>
        </Card>

        <Card className="flex flex-col gap-[10px]">
          <TextArea
            label="產品說明 Owned Product *"
            value={ownedProduct}
            className="min-h-[160px]"
            placeholder="你是做什麼的、核心產品/服務、提供什麼價值、目標受眾、關心的主題。可用 Markdown 語法（## 標題、- 列點、**粗體**）。"
            onChange={(e) => setOwnedProduct(e.target.value)}
          />
          <span className="[font:var(--fs-xs)/1.4_var(--font-sans)] text-[var(--text-faint)]">這段是小編判斷與寫稿最重要的依據，必填。語氣、寫稿規範等其餘設定會先套用通用預設，之後都能在「知識庫」調整。</span>
        </Card>

        <Button variant="primary" size="lg" full className="mb-2" disabled={saving || !valid} onClick={() => void submit()}>
          {saving ? "設定中..." : "完成設定"}
        </Button>
      </div>
    </div>
  );
}
