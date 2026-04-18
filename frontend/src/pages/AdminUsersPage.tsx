import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAdminUser,
  fetchAdminUsers,
  patchAdminUserDisabled,
  patchAdminUserRole,
  resetAdminUserPassword,
  type AdminUserRow,
} from "../api/client";
import { useConfirm } from "../contexts/ConfirmContext";
import { useAuth } from "../contexts/AuthContext";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Loader2,
  Search,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";

const inputCls =
  "w-full min-w-0 h-10 box-border border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-brand-500/35";

const filterLabelCls =
  "block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2 leading-none";

function apiErr(e: unknown): string {
  if (axios.isAxiosError(e) && e.response?.data && typeof (e.response.data as { message?: string }).message === "string") {
    return (e.response.data as { message: string }).message;
  }
  return "操作失败，请稍后重试";
}

function formatDt(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString("zh-CN", { hour12: false });
}

export function AdminUsersPage() {
  const { user: me } = useAuth();
  const { confirm } = useConfirm();
  const [page, setPage] = useState(1);
  const [size] = useState(20);
  const [emailQ, setEmailQ] = useState("");
  const [activeEmailQ, setActiveEmailQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | "USER" | "ADMIN">("");
  const [disabledFilter, setDisabledFilter] = useState<undefined | boolean>(undefined);
  const [items, setItems] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [createRole, setCreateRole] = useState<"USER" | "ADMIN">("USER");
  const [createBusy, setCreateBusy] = useState(false);

  const [pwdUser, setPwdUser] = useState<AdminUserRow | null>(null);
  const [pwdNew, setPwdNew] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUsers({
        page,
        size,
        email: activeEmailQ || undefined,
        role: roleFilter || undefined,
        disabled: disabledFilter,
      });
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
    } catch {
      setError("加载用户列表失败");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, size, activeEmailQ, roleFilter, disabledFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const applySearch = () => {
    setPage(1);
    setActiveEmailQ(emailQ.trim());
  };

  const runCreate = async () => {
    setCreateBusy(true);
    try {
      await createAdminUser({
        email: createEmail.trim(),
        password: createPassword,
        displayName: createDisplayName.trim() || undefined,
        role: createRole,
      });
      setCreateOpen(false);
      setCreateEmail("");
      setCreatePassword("");
      setCreateDisplayName("");
      setCreateRole("USER");
      await load();
    } catch (e) {
      alert(apiErr(e));
    } finally {
      setCreateBusy(false);
    }
  };

  const runResetPwd = async () => {
    if (!pwdUser) return;
    setPwdBusy(true);
    try {
      await resetAdminUserPassword(pwdUser.id, pwdNew);
      setPwdUser(null);
      setPwdNew("");
      await load();
    } catch (e) {
      alert(apiErr(e));
    } finally {
      setPwdBusy(false);
    }
  };

  const filterBtn = (active: boolean, onClick: () => void, label: string) => (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 min-w-[3.25rem] shrink-0 items-center justify-center rounded-lg px-3 text-xs font-semibold transition-colors ${
        active
          ? "bg-brand-600 text-white shadow-sm ring-1 ring-brand-500/30"
          : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="rounded-xl bg-brand-500/10 p-2 text-brand-600 dark:text-brand-400">
          <Users className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white m-0">用户管理</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 m-0 max-w-2xl leading-relaxed">
            手动创建邮箱密码用户、禁用/启用账号、调整角色（USER / ADMIN）、重置密码。OAuth 用户可补充密码以便同时支持邮箱登录。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2 text-sm font-semibold shadow-sm hover:opacity-90"
        >
          <UserPlus className="w-4 h-4" />
          新建用户
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-x-4 lg:gap-y-0 lg:items-end">
          <div className="lg:col-span-5">
            <label className={filterLabelCls}>邮箱筛选</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={emailQ}
                onChange={(e) => setEmailQ(e.target.value)}
                className={inputCls}
                placeholder="模糊匹配邮箱"
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
              />
              <button
                type="button"
                onClick={applySearch}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
              >
                <Search className="h-4 w-4 shrink-0" />
                查询
              </button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <label className={filterLabelCls}>角色</label>
            <div className="flex min-h-10 flex-wrap items-center gap-2">
              {filterBtn(roleFilter === "", () => { setRoleFilter(""); setPage(1); }, "全部")}
              {filterBtn(roleFilter === "USER", () => { setRoleFilter("USER"); setPage(1); }, "USER")}
              {filterBtn(roleFilter === "ADMIN", () => { setRoleFilter("ADMIN"); setPage(1); }, "ADMIN")}
            </div>
          </div>
          <div className="lg:col-span-4">
            <label className={filterLabelCls}>账号状态</label>
            <div className="flex min-h-10 flex-wrap items-center gap-2">
              {filterBtn(disabledFilter === undefined, () => { setDisabledFilter(undefined); setPage(1); }, "全部")}
              {filterBtn(disabledFilter === false, () => { setDisabledFilter(false); setPage(1); }, "正常")}
              {filterBtn(disabledFilter === true, () => { setDisabledFilter(true); setPage(1); }, "已禁用")}
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-sm px-4 py-3">{error}</div>
        ) : null}

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              加载中…
            </div>
          ) : items.length === 0 ? (
            <div className="py-14 text-center text-sm text-slate-500">暂无用户</div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {items.map((u) => (
                <li key={u.id} className="p-4 sm:p-5 hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white truncate">{u.email}</span>
                        {u.role === "ADMIN" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/15 text-violet-700 dark:text-violet-300 px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-violet-500/25">
                            <Shield className="w-3 h-3" />
                            ADMIN
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                            USER
                          </span>
                        )}
                        {u.disabled ? (
                          <span className="inline-flex items-center rounded-md bg-red-500/15 text-red-700 dark:text-red-300 px-2 py-0.5 text-[10px] font-bold ring-1 ring-red-500/25">
                            已禁用
                          </span>
                        ) : null}
                        {u.passwordSet ? (
                          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-500">已设密码</span>
                        ) : (
                          <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">无密码 / 仅 OAuth</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        {u.displayName || "—"} · <span className="font-mono">#{u.id}</span> · {u.provider || "—"} · 注册{" "}
                        {formatDt(u.createdAt)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setPwdUser(u);
                          setPwdNew("");
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        重置密码
                      </button>
                      {u.role === "USER" ? (
                        <button
                          type="button"
                          onClick={() =>
                            confirm({
                              title: "设为管理员",
                              message: `确定将 ${u.email} 设为 ADMIN？`,
                              onConfirm: async () => {
                                try {
                                  await patchAdminUserRole(u.id, "ADMIN");
                                  await load();
                                } catch (e) {
                                  alert(apiErr(e));
                                  throw e;
                                }
                              },
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-violet-200 dark:border-violet-800 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          升为管理员
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            confirm({
                              title: "降为普通用户",
                              message: `确定将 ${u.email} 降为 USER？`,
                              danger: true,
                              onConfirm: async () => {
                                try {
                                  await patchAdminUserRole(u.id, "USER");
                                  await load();
                                } catch (e) {
                                  alert(apiErr(e));
                                  throw e;
                                }
                              },
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
                        >
                          降为 USER
                        </button>
                      )}
                      {u.disabled ? (
                        <button
                          type="button"
                          onClick={() =>
                            confirm({
                              title: "启用账号",
                              message: `启用 ${u.email}？`,
                              onConfirm: async () => {
                                try {
                                  await patchAdminUserDisabled(u.id, false);
                                  await load();
                                } catch (e) {
                                  alert(apiErr(e));
                                  throw e;
                                }
                              },
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 dark:border-emerald-900 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        >
                          启用
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={me?.id === u.id}
                          onClick={() =>
                            confirm({
                              title: "禁用账号",
                              message: `禁用后该用户将无法登录（含 Google）。确定禁用 ${u.email}？`,
                              danger: true,
                              onConfirm: async () => {
                                try {
                                  await patchAdminUserDisabled(u.id, true);
                                  await load();
                                } catch (e) {
                                  alert(apiErr(e));
                                  throw e;
                                }
                              },
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-900/60 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          禁用
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span className="tabular-nums">
            共 {total} 条 · 第 {page} / {totalPages} 页
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-45"
            >
              <ChevronLeft className="w-4 h-4" />
              上一页
            </button>
            <button
              type="button"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-45"
            >
              下一页
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {createOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
          role="presentation"
          onClick={() => !createBusy && setCreateOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-create-user-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="admin-create-user-title" className="text-base font-bold text-slate-900 dark:text-white m-0">
              新建用户
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 m-0">创建本地邮箱密码账号（provider=local）</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">邮箱</label>
                <input type="email" className={inputCls} value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">初始密码（≥6 位）</label>
                <input
                  type="password"
                  className={inputCls}
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">显示名（可选）</label>
                <input className={inputCls} value={createDisplayName} onChange={(e) => setCreateDisplayName(e.target.value)} />
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-500 mb-1">角色</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateRole("USER")}
                    className={`flex-1 rounded-xl py-2 text-xs font-bold ${
                      createRole === "USER"
                        ? "bg-brand-600 text-white"
                        : "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    USER
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateRole("ADMIN")}
                    className={`flex-1 rounded-xl py-2 text-xs font-bold ${
                      createRole === "ADMIN"
                        ? "bg-violet-600 text-white"
                        : "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    ADMIN
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={createBusy}
                onClick={() => setCreateOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                取消
              </button>
              <button
                type="button"
                disabled={createBusy || !createEmail.trim() || createPassword.length < 6}
                onClick={() => void runCreate()}
                className="flex-1 rounded-xl bg-brand-600 text-white py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {createBusy ? "创建中…" : "创建"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pwdUser ? (
        <div
          className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
          role="presentation"
          onClick={() => !pwdBusy && setPwdUser(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-pwd-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="admin-pwd-title" className="text-base font-bold text-slate-900 dark:text-white m-0">
              重置密码
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 m-0 break-all">{pwdUser.email}</p>
            <div className="mt-4">
              <label className="block text-[11px] font-medium text-slate-500 mb-1">新密码（≥6 位）</label>
              <input
                type="password"
                className={inputCls}
                value={pwdNew}
                onChange={(e) => setPwdNew(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={pwdBusy}
                onClick={() => setPwdUser(null)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-semibold"
              >
                取消
              </button>
              <button
                type="button"
                disabled={pwdBusy || pwdNew.length < 6}
                onClick={() => void runResetPwd()}
                className="flex-1 rounded-xl bg-brand-600 text-white py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {pwdBusy ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
