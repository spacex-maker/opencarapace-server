/**
 * Gateway 端口被占用：从 OpenClaw stderr 解析占用方，必要时用 lsof/netstat 补全；
 * 结束进程前校验 PID 确实在监听「配置端口或 stderr 给出的端口」。
 */
const { execFileSync, execSync } = require("child_process");
const os = require("os");

/** @typedef {{ port: number; pid: number; processName: string; bindAddress?: string; commandLineHint?: string; source: "stderr" }} GatewayPortConflict */

/** @type {{ bundled: GatewayPortConflict | null; external: GatewayPortConflict | null }} */
const gatewayPortConflictByMode = { bundled: null, external: null };
/** @type {{ bundled: number | null; external: number | null }} */
const pendingPortByMode = { bundled: null, external: null };

function normalizeMode(mode) {
  return mode === "external" ? "external" : "bundled";
}

function parsePortFromBind(addr) {
  if (!addr || typeof addr !== "string") return null;
  const m = addr.match(/:(\d+)\s*$/);
  if (!m) return null;
  const p = Number(m[1]);
  return Number.isFinite(p) ? p : null;
}

/**
 * @param {"bundled"|"external"} mode
 * @param {string} rawLine stderr 单行（可含时间戳前缀）
 */
function ingestGatewayPortConflictStderrLine(mode, rawLine) {
  const m = normalizeMode(mode);
  const line = String(rawLine).trim();
  if (!line) return;

  const portM = line.match(/Port\s+(\d+)\s+is already in use/i);
  if (portM) {
    const port = Number(portM[1]);
    if (Number.isFinite(port)) {
      pendingPortByMode[m] = port;
      const cur = gatewayPortConflictByMode[m];
      gatewayPortConflictByMode[m] = {
        port,
        ...(cur?.pid ? { pid: cur.pid } : {}),
        processName: cur?.processName && cur.processName.length ? cur.processName : "（见下一条日志中的进程名）",
        ...(cur?.bindAddress ? { bindAddress: cur.bindAddress } : {}),
        source: "stderr",
      };
    }
    return;
  }

  const pidM = line.match(/-\s*pid\s+(\d+)\s+[^:]+:\s*([^(]+?)\s*\(([^)]+)\)/);
  if (pidM) {
    const pid = Number(pidM[1]);
    const processName = String(pidM[2]).trim();
    const bindAddr = String(pidM[3]).trim();
    let port = pendingPortByMode[m];
    const fromBind = parsePortFromBind(bindAddr);
    if (fromBind != null) port = fromBind;
    if (!Number.isFinite(port)) port = 18789;
    pendingPortByMode[m] = null;
    gatewayPortConflictByMode[m] = {
      port,
      pid,
      processName: processName || "unknown",
      bindAddress: bindAddr,
      source: "stderr",
    };
  }
}

function clearGatewayPortConflictMode(mode) {
  const m = normalizeMode(mode);
  gatewayPortConflictByMode[m] = null;
  pendingPortByMode[m] = null;
}

function clearAllGatewayPortConflicts() {
  gatewayPortConflictByMode.bundled = null;
  gatewayPortConflictByMode.external = null;
  pendingPortByMode.bundled = null;
  pendingPortByMode.external = null;
}

function getGatewayPortConflictsPayload() {
  return {
    gatewayPortConflictBundled: gatewayPortConflictByMode.bundled,
    gatewayPortConflictExternal: gatewayPortConflictByMode.external,
  };
}

function parsePortFromUiUrl(uiUrl) {
  const u = String(uiUrl ?? "").trim();
  if (!u) return 18789;
  try {
    const parsed = new URL(u);
    const n = Number(parsed.port || "");
    return Number.isFinite(n) && n > 0 ? n : 18789;
  } catch {
    return 18789;
  }
}

function listTcpListenersOnPort(port) {
  const p = Number(port);
  if (!Number.isFinite(p) || p <= 0) return [];
  if (process.platform === "win32") {
    return listTcpListenersOnPortWindows(p);
  }
  try {
    const out = execFileSync("lsof", ["-nP", `-iTCP:${p}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      timeout: 8000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const lines = out.trim().split("\n");
    if (lines.length < 2) return [];
    const byPid = new Map();
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length < 2) continue;
      const command = parts[0];
      const pid = Number(parts[1]);
      if (Number.isFinite(pid)) {
        byPid.set(pid, { pid, command });
      }
    }
    return [...byPid.values()];
  } catch {
    return [];
  }
}

function listTcpListenersOnPortWindows(port) {
  try {
    const out = execSync("netstat -ano -p TCP", {
      encoding: "utf8",
      timeout: 8000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const portInLine = new RegExp(`:${port}(?=\\s)`);
    const byPid = new Map();
    for (const line of out.split(/\r?\n/)) {
      if (!/LISTENING/i.test(line)) continue;
      if (!portInLine.test(line)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (!Number.isFinite(pid)) continue;
      let command = "";
      try {
        const tl = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
          encoding: "utf8",
          timeout: 5000,
        });
        const first = tl.split(/\r?\n/).find((x) => x.trim().length);
        const mm = first && first.match(/^"([^"]+)"/);
        command = mm ? mm[1] : "";
      } catch {
        /* ignore */
      }
      byPid.set(pid, { pid, command });
    }
    return [...byPid.values()];
  } catch {
    return [];
  }
}

/**
 * 若仅有 port、stderr 未带出 pid，尝试用系统工具补全（不改变「运行中」判定逻辑，仅服务 UI）。
 */
function enrichGatewayPortConflictsWithLsof() {
  for (const m of /** @type {const} */ (["bundled", "external"])) {
    const c = gatewayPortConflictByMode[m];
    if (!c || !Number.isFinite(c.port)) continue;
    if (c.pid && c.pid > 0) continue;
    const listeners = listTcpListenersOnPort(c.port);
    if (listeners.length === 1) {
      gatewayPortConflictByMode[m] = {
        ...c,
        pid: listeners[0].pid,
        processName: listeners[0].command || c.processName || "unknown",
        commandLineHint: listeners[0].command || undefined,
      };
    } else if (listeners.length > 1) {
      gatewayPortConflictByMode[m] = {
        ...c,
        ambiguousListenerCount: listeners.length,
      };
    }
  }
}

function pidListensOnAnyPort(pid, ports) {
  const p = Number(pid);
  if (!Number.isFinite(p) || p <= 0) return false;
  const set = new Set((ports || []).filter((x) => Number.isFinite(x) && x > 0));
  if (set.size === 0) set.add(18789);
  for (const port of set) {
    const listeners = listTcpListenersOnPort(port);
    if (listeners.some((l) => l.pid === p)) return true;
  }
  return false;
}

function killPidCrossPlatform(pid) {
  const p = Number(pid);
  if (!Number.isFinite(p) || p <= 0) {
    throw new Error("无效 PID");
  }
  if (process.platform === "win32") {
    execSync(`taskkill /F /T /PID ${p}`, { stdio: "ignore", timeout: 15000 });
  } else {
    try {
      process.kill(p, "SIGTERM");
    } catch (e) {
      throw e;
    }
  }
}

/**
 * @param {number} pid
 * @param {{ uiUrl?: string; conflictPort?: number }} opts
 */
async function killVerifiedGatewayPortListener(pid, opts = {}) {
  const { getOpenClawSettings } = require("../db.js");
  const settings = await getOpenClawSettings();
  const settingsPort = parsePortFromUiUrl(settings.uiUrl);
  const ports = [opts.conflictPort, settingsPort].filter((x) => Number.isFinite(x) && x > 0);
  if (!pidListensOnAnyPort(pid, ports)) {
    return {
      ok: false,
      error: "拒绝：该 PID 当前未在配置的 Gateway 端口（或冲突日志中的端口）上监听，无法一键结束。",
    };
  }
  try {
    killPidCrossPlatform(pid);
    clearAllGatewayPortConflicts();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

module.exports = {
  ingestGatewayPortConflictStderrLine,
  clearGatewayPortConflictMode,
  clearAllGatewayPortConflicts,
  getGatewayPortConflictsPayload,
  enrichGatewayPortConflictsWithLsof,
  killVerifiedGatewayPortListener,
  parsePortFromUiUrl,
  listTcpListenersOnPort,
};
