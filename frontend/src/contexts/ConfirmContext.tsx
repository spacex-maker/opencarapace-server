import {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from "react";

export interface ConfirmOptions {
  title: string;
  message: string;
  /** 确认按钮文案，默认「确定」 */
  confirmText?: string;
  /** 取消按钮文案，默认「取消」 */
  cancelText?: string;
  /** 危险操作时使用红色主按钮 */
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => void;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [loading, setLoading] = useState(false);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setOpen(true);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!options) return;
    setLoading(true);
    try {
      await options.onConfirm();
      setOpen(false);
      setOptions(null);
    } catch {
      // 调用方可能自己处理错误，这里只关闭 loading
    } finally {
      setLoading(false);
    }
  }, [options]);

  const handleCancel = useCallback(() => {
    options?.onCancel?.();
    setOpen(false);
    setOptions(null);
  }, [options]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {open && options && (
        <ConfirmDialog
          title={options.title}
          message={options.message}
          confirmText={options.confirmText ?? "确定"}
          cancelText={options.cancelText ?? "取消"}
          danger={options.danger}
          loading={loading}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  danger?: boolean;
  loading: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

function ConfirmDialog({
  title,
  message,
  confirmText,
  cancelText,
  danger,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm"
        onClick={loading ? undefined : onCancel}
        aria-hidden
      />
      {/* 弹窗 */}
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-5 space-y-4">
        <h2 id="confirm-title" className="text-base font-semibold text-slate-900 dark:text-white">
          {title}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
          {message}
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={
              danger
                ? "px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors"
                : "px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-50 transition-colors"
            }
          >
            {loading ? "处理中…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
