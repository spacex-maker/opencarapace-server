/**
 * Gateway 诊断日志系统：内存缓冲 + 磁盘持久化，内置 / 外置分文件。
 * 每条追加会通过 EventEmitter 推送，供 GET /api/openclaw/gateway-diag-stream（SSE）实时输出。
 */

const path = require("path");
const fs = require("fs");
const { EventEmitter } = require("events");

const gatewayDiagEmitter = new EventEmitter();
gatewayDiagEmitter.setMaxListeners(200);
const { getElectronUserDataPath } = require("../openclaw-workspace.js");
const {
  ingestGatewayPortConflictStderrLine,
} = require("../openclaw-gateway-port-conflict.js");

const MAX_GATEWAY_DIAG_CHARS = 200000;
/** @type {{ bundled: string; external: string }} */
let gatewayDiagnosticLogs = { bundled: "", external: "" };

function normalizeGatewayDiagMode(mode) {
  return mode === "external" ? "external" : "bundled";
}

function getGatewayLogsDir() {
  return path.join(getElectronUserDataPath(), "logs");
}

function getGatewayLogFilePath(mode) {
  const m = normalizeGatewayDiagMode(mode);
  const name = m === "external" ? "openclaw-gateway-external.log" : "openclaw-gateway-bundled.log";
  return path.join(getGatewayLogsDir(), name);
}

function appendGatewayDiagToFile(mode, entry) {
  try {
    const m = normalizeGatewayDiagMode(mode);
    const dir = getGatewayLogsDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(getGatewayLogFilePath(m), entry, "utf8");
  } catch (e) {
    console.warn("[OpenClaw][diag] 写入日志文件失败:", e?.message || e);
  }
}

function appendGatewayDiag(line, modeOpt) {
  let m;
  if (modeOpt === "bundled" || modeOpt === "external") {
    m = modeOpt;
  } else {
    const { getGatewayWorkspaceStateSync } = require("../openclaw-workspace.js");
    m = normalizeGatewayDiagMode(getGatewayWorkspaceStateSync().binaryMode);
  }
  const ts = new Date().toISOString();
  const entry = `[${ts}] ${line}\n`;
  gatewayDiagnosticLogs[m] += entry;
  if (gatewayDiagnosticLogs[m].length > MAX_GATEWAY_DIAG_CHARS) {
    gatewayDiagnosticLogs[m] =
      "...[日志过长已截断，仅保留末尾部分]\n" +
      gatewayDiagnosticLogs[m].slice(-(MAX_GATEWAY_DIAG_CHARS - 50));
  }
  appendGatewayDiagToFile(m, entry);
  console.log("[OpenClaw][diag]", line);
  try {
    gatewayDiagEmitter.emit("entry", { mode: m, entry });
  } catch (e) {
    console.warn("[OpenClaw][diag] emit entry failed:", e?.message || e);
  }
}

function clearGatewayDiag(mode) {
  const m = normalizeGatewayDiagMode(mode);
  gatewayDiagnosticLogs[m] = "";
  try {
    gatewayDiagEmitter.emit("clear", { mode: m });
  } catch (e) {
    console.warn("[OpenClaw][diag] emit clear failed:", e?.message || e);
  }
  try {
    const dir = getGatewayLogsDir();
    fs.mkdirSync(dir, { recursive: true });
    const banner = `\n======== OpenClaw Gateway 诊断会话 ${new Date().toISOString()} (${m}) ========\n`;
    fs.appendFileSync(getGatewayLogFilePath(m), banner, "utf8");
  } catch (e) {
    console.warn("[OpenClaw][diag] 会话标记写入失败:", e?.message || e);
  }
}

function getGatewayDiagnosticLogForMode(mode) {
  const m = normalizeGatewayDiagMode(mode);
  return gatewayDiagnosticLogs[m];
}

function getGatewayDiagnosticLog(mode) {
  if (mode === "bundled" || mode === "external") {
    return getGatewayDiagnosticLogForMode(mode);
  }
  const { getGatewayWorkspaceStateSync } = require("../openclaw-workspace.js");
  const st = getGatewayWorkspaceStateSync();
  return getGatewayDiagnosticLogForMode(st.binaryMode === "external" ? "external" : "bundled");
}

function getGatewayDiagnosticLogsPayload() {
  return {
    gatewayDiagnosticLogBundled: gatewayDiagnosticLogs.bundled,
    gatewayDiagnosticLogExternal: gatewayDiagnosticLogs.external,
    gatewayDiagnosticLogFileBundled: getGatewayLogFilePath("bundled"),
    gatewayDiagnosticLogFileExternal: getGatewayLogFilePath("external"),
  };
}

function attachChildProcessLogs(child, mode) {
  const m = normalizeGatewayDiagMode(mode);
  const onData = (label) => (data) => {
    const s = String(data).replace(/\r\n/g, "\n");
    for (const line of s.split("\n")) {
      if (line.trim().length > 0) {
        appendGatewayDiag(`${label} ${line}`, m);
      }
    }
  };
  const onStderr = (data) => {
    const s = String(data).replace(/\r\n/g, "\n");
    for (const line of s.split("\n")) {
      if (line.trim().length > 0) {
        ingestGatewayPortConflictStderrLine(m, line);
        appendGatewayDiag(`[stderr] ${line}`, m);
      }
    }
  };
  child.stdout?.on("data", onData("[stdout]"));
  child.stderr?.on("data", onStderr);
  child.on("error", (err) => {
    appendGatewayDiag(`[spawn-error] ${err?.message || String(err)}`, m);
  });
  child.on("exit", (code, signal) => {
    appendGatewayDiag(`[子进程退出] code=${code} signal=${signal || "(无)"}`, m);
  });
}

/**
 * 子进程 stdout/stderr 单行是否表示 Gateway 已起来。
 */
function gatewayDiagChildLineIndicatesGatewayUp(body) {
  if (!body || typeof body !== "string") return false;
  if (/\blistening on ws:\/\//i.test(body)) return true;
  if (/\[gateway\][^\n]*listening on/i.test(body)) return true;
  if (/\[gateway\][\s\S]*?\bready\s*\(/i.test(body)) return true;
  return false;
}

/**
 * 诊断日志中最近一次判定为 Gateway 已就绪的时间戳（ms）。
 */
function latestClawHeartDiagGatewayUpTimestampMs(mode) {
  const m = normalizeGatewayDiagMode(mode);
  const log = gatewayDiagnosticLogs[m] || "";
  const lineRe =
    /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\] \[(?:stdout|stderr)\] (.*)$/gm;
  let last = 0;
  let mm;
  while ((mm = lineRe.exec(log)) !== null) {
    if (!gatewayDiagChildLineIndicatesGatewayUp(mm[2])) continue;
    const t = Date.parse(mm[1]);
    if (!Number.isNaN(t)) last = Math.max(last, t);
  }
  return last;
}

function gatewayDiagLogShowsGatewayListening(mode) {
  const m = normalizeGatewayDiagMode(mode);
  const log = gatewayDiagnosticLogs[m] || "";
  if (/\blistening on ws:\/\//i.test(log)) return true;
  if (/\[gateway\][^\n]*listening on/i.test(log)) return true;
  if (/\[gateway\][\s\S]*?\bready\s*\(/i.test(log)) return true;
  return false;
}

const PRE_STOP_LOG_MAX = 4000;

/**
 * @param {{ onEntry?: (p: { mode: string; entry: string }) => void; onClear?: (p: { mode: string }) => void }} handlers
 * @returns {() => void} unsubscribe
 */
function subscribeGatewayDiag(handlers) {
  const onEntry = (p) => handlers.onEntry && handlers.onEntry(p);
  const onClear = (p) => handlers.onClear && handlers.onClear(p);
  gatewayDiagEmitter.on("entry", onEntry);
  gatewayDiagEmitter.on("clear", onClear);
  return () => {
    gatewayDiagEmitter.off("entry", onEntry);
    gatewayDiagEmitter.off("clear", onClear);
  };
}

function appendPreStopOutputToDiag(label, text, mode) {
  const s = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!s) return;
  const chunk = s.length > PRE_STOP_LOG_MAX ? `${s.slice(0, PRE_STOP_LOG_MAX)}…[截断]` : s;
  for (const line of chunk.split("\n")) {
    if (line.trim()) appendGatewayDiag(`${label} ${line}`, mode);
  }
}

module.exports = {
  appendGatewayDiag,
  subscribeGatewayDiag,
  clearGatewayDiag,
  getGatewayDiagnosticLog,
  getGatewayDiagnosticLogsPayload,
  attachChildProcessLogs,
  latestClawHeartDiagGatewayUpTimestampMs,
  gatewayDiagLogShowsGatewayListening,
  appendPreStopOutputToDiag,
};
