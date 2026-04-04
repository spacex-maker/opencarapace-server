import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";

function SelectDropdownInput(props: {
  value: string;
  onValueChange: (v: string) => void;
  options: string[];
  placeholder: string;
  pickerLabels: { expand: string; collapse: string; noMatch: string };
}) {
  const [open, setOpen] = useState(false);
  // query 用来做“筛选/搜索”，不要默认等于当前选中的 value。
  // 否则 value 是 `default` / `*` 时，筛选会把候选项过滤成接近空的。
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 当外部 value 被更新时，同步本地 query（比如从“编辑规则”回显）。
  useEffect(() => {
    // 回显后不立即筛选，避免出现仅剩 default / * 的情况。
    setQuery("");
  }, [props.value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const unique = Array.from(new Set(props.options || []));
    // 不输入搜索关键词时：展示“完整数据”，便于用户直接切换。
    if (!q) return unique;
    const hits = unique.filter((v) => String(v).toLowerCase().includes(q));
    // 有搜索时：依然限制一下最多展示数量，避免列表过长影响体验。
    return hits.slice(0, 200);
  }, [query, props.options]);

  useEffect(() => {
    if (!open) return;

    const onDocMouseDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as any)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const commit = (v: string) => {
    props.onValueChange(v);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          border: "1px solid #334155",
          background: "#0f172a",
            borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <input
          ref={inputRef}
          className="llm-input"
          type="text"
          value={props.value}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            props.onValueChange(v);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          placeholder={props.placeholder}
          style={{
            padding: "10px 12px",
            border: "none",
            borderRadius: 0,
            background: "transparent",
            color: "#e2e8f0",
            fontSize: 13,
            transition: "border-color 0.2s",
            flex: 1,
            width: "100%",
            boxSizing: "border-box",
            outline: "none",
          }}
        />
        <button
          type="button"
          onMouseDown={(e) => {
            // 防止按钮点击导致 input 失焦，从而触发不稳定的关闭/打开时序
            e.preventDefault();
          }}
          onClick={() => {
            inputRef.current?.focus();
            setQuery("");
            setOpen((v) => !v);
          }}
          style={{
            width: 38,
            border: "none",
            borderLeft: "1px solid rgba(51,65,85,0.8)",
            background: "transparent",
            color: "#e2e8f0",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            flexShrink: 0,
          }}
          title={open ? props.pickerLabels.collapse : props.pickerLabels.expand}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            zIndex: 60,
            maxHeight: 240,
            overflowY: "auto",
            borderRadius: 16,
            border: "1px solid #1f2937",
            background: "rgba(2, 6, 23, 0.98)",
            boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: "10px 12px", color: "#64748b", fontSize: 12 }}>{props.pickerLabels.noMatch}</div>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(opt);
                }}
                style={{
                  width: "100%",
                  display: "block",
                  textAlign: "left",
                  padding: "8px 12px",
                  border: "none",
                  background: props.value === opt ? "rgba(59,130,246,0.18)" : "transparent",
                  color: props.value === opt ? "#93c5fd" : "#e5e7eb",
                  fontSize: 12,
                  cursor: "pointer",
                }}
                title={opt}
              >
                {opt}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Icons (仅用于弹窗标题)
const TagIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const CoinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
    <path d="M12 18V6"></path>
  </svg>
);

const ChartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"></line>
    <line x1="12" y1="20" x2="12" y2="4"></line>
    <line x1="6" y1="20" x2="6" y2="14"></line>
  </svg>
);

export type BudgetRuleForm = {
  provider_key: string;
  model_id: string;
  input_usd_per_1k: string;
  output_usd_per_1k: string;
  budget_day_usd: string;
  budget_week_usd: string;
  budget_month_usd: string;
  enabled: boolean;
};

export function BudgetRuleModal(props: {
  modalMode: "create" | "edit";
  saving: boolean;
  form: BudgetRuleForm;
  setForm: React.Dispatch<React.SetStateAction<BudgetRuleForm>>;
  providerSuggestions: string[];
  modelSuggestions: string[];
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  const pickerLabels = {
    expand: t("interceptMonitorPage.budgetModal.selectExpand"),
    collapse: t("interceptMonitorPage.budgetModal.selectCollapse"),
    noMatch: t("interceptMonitorPage.budgetModal.selectNoMatch"),
  };
  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2, 6, 23, 0.8)",
        backdropFilter: "blur(6px)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          borderRadius: 24,
          border: "1px solid var(--panel-border)",
          background: "var(--panel-bg)",
          padding: 24,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--fg)" }}>
            {props.modalMode === "create"
              ? t("interceptMonitorPage.budgetModal.titleCreate")
              : t("interceptMonitorPage.budgetModal.titleEdit")}
          </div>
          <button
            type="button"
            className="llm-btn"
            onClick={props.onClose}
            disabled={props.saving}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: "none",
              background: "transparent",
              color: "var(--muted2)",
              cursor: props.saving ? "not-allowed" : "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Section 1: 基础识别 */}
        <div className="llm-modal-section">
          <div className="llm-modal-title">
            <TagIcon /> {t("interceptMonitorPage.budgetModal.sectionIdentity")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="llm-input-group">
              <span className="llm-input-label">{t("interceptMonitorPage.budgetModal.labelProvider")}</span>
              <SelectDropdownInput
                value={String(props.form.provider_key ?? "")}
                onValueChange={(v) => props.setForm((f) => ({ ...f, provider_key: v }))}
                options={props.providerSuggestions}
                placeholder={t("interceptMonitorPage.budgetModal.phProvider")}
                pickerLabels={pickerLabels}
              />
            </div>
            <div className="llm-input-group">
              <span className="llm-input-label">{t("interceptMonitorPage.budgetModal.labelModel")}</span>
              <SelectDropdownInput
                value={String(props.form.model_id ?? "")}
                onValueChange={(v) => props.setForm((f) => ({ ...f, model_id: v }))}
                options={props.modelSuggestions}
                placeholder={t("interceptMonitorPage.budgetModal.phModel")}
                pickerLabels={pickerLabels}
              />
            </div>
          </div>
        </div>

        {/* Section 2: 计费单价 */}
        <div className="llm-modal-section">
          <div className="llm-modal-title">
            <CoinIcon /> {t("interceptMonitorPage.budgetModal.sectionPricing")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="llm-input-group">
              <span className="llm-input-label">{t("interceptMonitorPage.budgetModal.labelInputPrice")}</span>
              <input
                className="llm-input"
                type="number"
                step="any"
                value={props.form.input_usd_per_1k}
                onChange={(e) => props.setForm((f) => ({ ...f, input_usd_per_1k: e.target.value }))}
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--panel-border)",
                  background: "var(--panel-bg)",
                  color: "#34d399",
                  fontSize: 13,
                  fontFamily: "monospace",
                  transition: "border-color 0.2s",
                }}
              />
            </div>
            <div className="llm-input-group">
              <span className="llm-input-label">{t("interceptMonitorPage.budgetModal.labelOutputPrice")}</span>
              <input
                className="llm-input"
                type="number"
                step="any"
                value={props.form.output_usd_per_1k}
                onChange={(e) => props.setForm((f) => ({ ...f, output_usd_per_1k: e.target.value }))}
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--panel-border)",
                  background: "var(--panel-bg)",
                  color: "#60a5fa",
                  fontSize: 13,
                  fontFamily: "monospace",
                  transition: "border-color 0.2s",
                }}
              />
            </div>
          </div>
        </div>

        {/* Section 3: 预算上限 */}
        <div className="llm-modal-section" style={{ marginBottom: 20 }}>
          <div className="llm-modal-title">
            <ChartIcon /> {t("interceptMonitorPage.budgetModal.sectionBudget")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div className="llm-input-group">
              <span className="llm-input-label">{t("interceptMonitorPage.budgetModal.labelDayCap")}</span>
              <input
                className="llm-input"
                type="number"
                step="any"
                placeholder={t("interceptMonitorPage.budgetModal.phUnlimited")}
                value={props.form.budget_day_usd}
                onChange={(e) => props.setForm((f) => ({ ...f, budget_day_usd: e.target.value }))}
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--panel-border)",
                  background: "var(--panel-bg)",
                  color: "var(--fg)",
                  fontSize: 13,
                  transition: "border-color 0.2s",
                }}
              />
            </div>
            <div className="llm-input-group">
              <span className="llm-input-label">{t("interceptMonitorPage.budgetModal.labelWeekCap")}</span>
              <input
                className="llm-input"
                type="number"
                step="any"
                placeholder={t("interceptMonitorPage.budgetModal.phUnlimited")}
                value={props.form.budget_week_usd}
                onChange={(e) => props.setForm((f) => ({ ...f, budget_week_usd: e.target.value }))}
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--panel-border)",
                  background: "var(--panel-bg)",
                  color: "var(--fg)",
                  fontSize: 13,
                  transition: "border-color 0.2s",
                }}
              />
            </div>
            <div className="llm-input-group">
              <span className="llm-input-label">{t("interceptMonitorPage.budgetModal.labelMonthCap")}</span>
              <input
                className="llm-input"
                type="number"
                step="any"
                placeholder={t("interceptMonitorPage.budgetModal.phUnlimited")}
                value={props.form.budget_month_usd}
                onChange={(e) => props.setForm((f) => ({ ...f, budget_month_usd: e.target.value }))}
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--panel-border)",
                  background: "var(--panel-bg)",
                  color: "var(--fg)",
                  fontSize: 13,
                  transition: "border-color 0.2s",
                }}
              />
            </div>
          </div>
        </div>

        {/* 底部操作区 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: "1px solid var(--panel-border)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={props.form.enabled}
              onChange={(e) => props.setForm((f) => ({ ...f, enabled: e.target.checked }))}
              style={{ width: 18, height: 18, accentColor: "#3b82f6", cursor: "pointer" }}
            />
            <span style={{ fontSize: 13, color: "var(--fg)", fontWeight: 500 }}>{t("interceptMonitorPage.budgetModal.enableRule")}</span>
          </label>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              className="llm-btn"
              onClick={props.onClose}
              disabled={props.saving}
              style={{ padding: "8px 18px", borderRadius: 999, border: "1px solid var(--panel-border)", background: "transparent", color: "var(--muted)", fontSize: 13, fontWeight: 500 }}
            >
              {t("interceptMonitorPage.budgetModal.cancel")}
            </button>
            <button
              type="button"
              className="llm-btn"
              disabled={props.saving}
              onClick={props.onSave}
              style={{ padding: "8px 24px", borderRadius: 999, border: "none", background: "#3b82f6", color: "#ffffff", fontSize: 13, fontWeight: 500, boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)" }}
            >
              {props.saving ? t("interceptMonitorPage.budgetModal.saving") : t("interceptMonitorPage.budgetModal.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

