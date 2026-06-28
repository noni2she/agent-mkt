import { useCallback, useMemo, useState } from "react";
import { createAccount, onboardTenant, setActiveAccount } from "./api";
import { AlertBar, Button, Card, TextArea } from "./components";

interface SetupWizardProps {
  onComplete: () => void;
}

const inputClass =
  "min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-[14px] py-[10px] text-[var(--text-strong)] outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)] [font:var(--fw-regular)_var(--fs-sm)/1.4_var(--font-sans)] focus:border-[var(--brand-500)] focus:shadow-[var(--shadow-focus)]";

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [brandName, setBrandName] = useState("");
  const [ownedProduct, setOwnedProduct] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [persona, setPersona] = useState("");
  const [marketingStrategy, setMarketingStrategy] = useState("");
  const [contentWritingRule, setContentWritingRule] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brandValid = useMemo(() => brandName.trim() !== "" && ownedProduct.trim() !== "", [brandName, ownedProduct]);
  const accountValid = useMemo(
    () => handle.trim().replace(/^@/, "") !== "" && displayName.trim() !== "" && persona.trim() !== "",
    [handle, displayName, persona],
  );

  const submit = useCallback(async () => {
    if (!brandValid || !accountValid) return;
    setSaving(true);
    setError(null);
    try {
      const normalizedHandle = handle.trim().replace(/^@/, "");
      await onboardTenant({ brandName: brandName.trim(), threadsHandle: normalizedHandle, ownedProduct: ownedProduct.trim() });
      const account = await createAccount({
        handle: normalizedHandle,
        display_name: displayName.trim(),
        persona: persona.trim(),
        marketing_strategy: marketingStrategy.trim(),
        content_writing_rule: contentWritingRule.trim(),
      });
      await setActiveAccount(account.id);
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [accountValid, brandName, brandValid, contentWritingRule, displayName, handle, marketingStrategy, onComplete, ownedProduct, persona]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
      <div className="flex max-w-[740px] flex-col gap-4">
        <div>
          <h2 className="[font:var(--fw-bold)_20px/1.2_var(--font-sans)] text-[var(--text-strong)]">{step === 1 ? "設定您的品牌" : "新增第一個 Threads 帳號"}</h2>
          <p className="mt-1 [font:var(--fs-sm)/1.6_var(--font-sans)] text-[var(--text-muted)]">Agent MKT 是你的 AI 行銷小編——它會在 Threads 上巡邏熱門貼文、判斷哪些和你的品牌相關，並草擬回覆，發布前都由你審核。開始前，先讓它認識你的品牌。</p>
        </div>

        {error ? <AlertBar tone="warning" title="設定失敗">{error}</AlertBar> : null}

        {step === 1 ? <><Card className="flex flex-col gap-[14px]">
          <label className="flex flex-col gap-[6px]">
            <span className="[font:var(--fw-medium)_var(--fs-sm)/1.3_var(--font-sans)] text-[var(--text-strong)]">品牌名稱 *</span>
            <input className={inputClass} value={brandName} placeholder="例：HouseGuide.ai" onChange={(e) => setBrandName(e.target.value)} />
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

        <Button variant="primary" size="lg" full className="mb-2" disabled={!brandValid} onClick={() => setStep(2)}>下一步：新增 Threads 帳號</Button></> : <>
          <Card className="flex flex-col gap-[14px]">
            <label className="flex flex-col gap-[6px]">
              <span className="[font:var(--fw-medium)_var(--fs-sm)/1.3_var(--font-sans)] text-[var(--text-strong)]">Threads handle *</span>
              <input className={inputClass} value={handle} placeholder="例：houseguide" onChange={(e) => setHandle(e.target.value)} />
            </label>
            <label className="flex flex-col gap-[6px]">
              <span className="[font:var(--fw-medium)_var(--fs-sm)/1.3_var(--font-sans)] text-[var(--text-strong)]">顯示名稱 *</span>
              <input className={inputClass} value={displayName} placeholder="例：HouseGuide 團隊" onChange={(e) => setDisplayName(e.target.value)} />
            </label>
            <TextArea label="帳號人格 Persona *" value={persona} className="min-h-[120px]" onChange={(e) => setPersona(e.target.value)} />
            <TextArea label="行銷策略 Marketing Strategy" value={marketingStrategy} className="min-h-[100px]" onChange={(e) => setMarketingStrategy(e.target.value)} />
            <TextArea label="寫稿規則 Content Writing Rule" value={contentWritingRule} className="min-h-[100px]" onChange={(e) => setContentWritingRule(e.target.value)} />
          </Card>
          <div className="flex gap-2">
            <Button full disabled={saving} onClick={() => setStep(1)}>上一步</Button>
            <Button variant="primary" full disabled={saving || !accountValid} onClick={() => void submit()}>{saving ? "設定中..." : "完成設定"}</Button>
          </div>
        </>}
      </div>
    </div>
  );
}
