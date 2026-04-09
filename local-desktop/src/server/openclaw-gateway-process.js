/**
 * 判断本机是否有 OpenClaw Gateway 在跑：凭进程命令行（可执行路径 / openclaw.mjs + gateway run），
 * 不连端口、不 HTTP 探测。
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execWithOutput } = require("./utils.js");

/** @param {string} cmd */
function commandLineLooksLikeOpenClawGatewayRun(cmd) {
  if (!cmd || typeof cmd !== "string") return false;
  /** 上游可能以独立二进制名运行，argv 不含字面量 "gateway run" */
  if (/\bopenclaw-gateway\b/i.test(cmd)) return true;
  if (!/\bgateway\s+run\b/i.test(cmd)) return false;
  if (/openclaw/i.test(cmd)) return true;
  if (/[\\/]node_modules[\\/]openclaw[\\/]/i.test(cmd)) return true;
  return false;
}

function scanLinuxProc() {
  let entries;
  try {
    entries = fs.readdirSync("/proc");
  } catch {
    return false;
  }
  for (const name of entries) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const buf = fs.readFileSync(path.join("/proc", name, "cmdline"));
      const cmd = buf.toString("latin1").replace(/\0/g, " ");
      if (commandLineLooksLikeOpenClawGatewayRun(cmd)) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

async function scanDarwinPs() {
  /** `command=` 在部分 macOS 上对长 argv 仍会截断，丢掉尾部的 gateway run；`args=` + -ww 更完整 */
  const wide = await execWithOutput("ps", ["-axww", "-o", "args="], { cwd: os.tmpdir() });
  if (wide.code === 0) {
    for (const line of wide.stdout.split("\n")) {
      if (commandLineLooksLikeOpenClawGatewayRun(line)) return true;
    }
  }
  /** 再按完整命令行匹配 PID，避免单列 ps 漏行 */
  const pg = await execWithOutput("/usr/bin/pgrep", ["-f", "gateway run"], { cwd: os.tmpdir() });
  if (pg.code !== 0 || !String(pg.stdout).trim()) return false;
  const pids = String(pg.stdout)
    .trim()
    .split(/\s+/)
    .filter((x) => /^\d+$/.test(x));
  for (const pid of pids) {
    const pr = await execWithOutput("ps", ["-p", pid, "-ww", "-o", "args="], { cwd: os.tmpdir() });
    if (pr.code === 0 && commandLineLooksLikeOpenClawGatewayRun(pr.stdout)) return true;
  }
  return false;
}

async function scanWindowsProcesses() {
  const script =
    "Get-CimInstance Win32_Process | ForEach-Object { $_.CommandLine } | Where-Object { $_ -ne $null }";
  const r = await execWithOutput(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { cwd: os.tmpdir() }
  );
  if (r.code !== 0) return false;
  for (const line of r.stdout.split(/\r?\n/)) {
    if (commandLineLooksLikeOpenClawGatewayRun(line)) return true;
  }
  return false;
}

async function detectOpenClawGatewayProcessRunning() {
  try {
    if (process.platform === "win32") {
      return await scanWindowsProcesses();
    }
    if (process.platform === "linux") {
      return scanLinuxProc();
    }
    if (process.platform === "darwin") {
      return await scanDarwinPs();
    }
  } catch (e) {
    console.warn("[OpenClaw][proc] detect gateway process failed:", e?.message || e);
  }
  return false;
}

module.exports = {
  commandLineLooksLikeOpenClawGatewayRun,
  detectOpenClawGatewayProcessRunning,
};
