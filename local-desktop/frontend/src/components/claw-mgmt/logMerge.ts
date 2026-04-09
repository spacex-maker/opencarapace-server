import type { OpenClawInstallDiag } from "./types";

/** 仅安装 / 卸载 / npm 任务块，不含 Gateway 诊断（诊断在 UI 中分列显示） */
export function buildOpenClawSharedTaskLogText(
  oc: OpenClawInstallDiag | undefined,
  uo?: OpenClawInstallDiag | undefined
): string | null {
  const blocks: string[] = [];
  const showUn =
    uo &&
    (uo.running ||
      (typeof uo.log === "string" && uo.log.length > 0) ||
      uo.exitCode != null ||
      !!(uo.lastError && String(uo.lastError).trim().length > 0));
  if (showUn && uo) {
    let uninstallBlock = `=== npm 全局卸载${uo.running ? "（进行中）" : ""} ===\n${uo.log || ""}`;
    if (!uo.running && uo.exitCode != null) {
      uninstallBlock += `\n\n退出码: ${uo.exitCode}`;
    }
    const ule = uo.lastError?.trim();
    if (ule) {
      uninstallBlock += `\n\nlastError:\n${ule}`;
    }
    blocks.push(uninstallBlock);
  }
  const showInstall =
    oc &&
    (oc.running ||
      (typeof oc.log === "string" && oc.log.length > 0) ||
      oc.exitCode != null ||
      !!(oc.lastError && String(oc.lastError).trim().length > 0));
  if (showInstall && oc) {
    let installBlock = `=== OpenClaw 安装${oc.running ? "（进行中）" : ""} ===\n${oc.log || ""}`;
    if (!oc.running && oc.exitCode != null) {
      installBlock += `\n\n退出码: ${oc.exitCode}`;
    }
    const le = oc.lastError?.trim();
    if (le) {
      installBlock += `\n\nlastError:\n${le}`;
    }
    blocks.push(installBlock);
  }
  if (blocks.length === 0) return null;
  return blocks.join("\n\n");
}

export function formatNodeRuntimeInstallBlock(st: {
  profile?: string;
  installing?: boolean;
  stage?: string;
  percent?: number;
  logs?: string[];
  error?: string | null;
  completed?: boolean;
}): string {
  const logs = Array.isArray(st.logs) ? st.logs.join("\n") : "";
  const err = st.error ? `\n错误: ${st.error}` : "";
  const tail = st.completed ? "\n（已完成，可继续安装 OpenClaw）" : "";
  const label =
    st.profile === "external" ? "运行时 Node（外置专用）" : "运行时 Node（内置卡）";
  return `=== ${label}（客户端下载）${st.installing ? "· 进行中" : ""} ===
阶段: ${st.stage || "-"} · ${st.percent ?? 0}%
${logs}${err}${tail}`;
}

/** @deprecated 仅测试或旧调用；UI 已拆分为任务日志 + 内置/外置 Gateway。 */
export function buildOpenClawPanelLogText(
  oc: OpenClawInstallDiag | undefined,
  gatewayDiagnosticLog: string | undefined,
  uo?: OpenClawInstallDiag | undefined
): string | null {
  const shared = buildOpenClawSharedTaskLogText(oc, uo);
  const gw = typeof gatewayDiagnosticLog === "string" ? gatewayDiagnosticLog.trim() : "";
  const blocks: string[] = [];
  if (shared) blocks.push(shared);
  if (gw.length > 0) {
    blocks.push(`=== Gateway 诊断 ===\n${gatewayDiagnosticLog ?? ""}`);
  }
  if (blocks.length === 0) return null;
  return blocks.join("\n\n");
}
