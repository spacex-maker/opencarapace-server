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

/** @param {string} text */
function parsePowerShellProcessJson(text) {
  const t = String(text || "").trim();
  if (!t) return [];
  try {
    const j = JSON.parse(t);
    if (Array.isArray(j)) return j;
    if (j && typeof j === "object" && j.ProcessId != null) return [j];
  } catch {
    /* ignore */
  }
  return [];
}

/**
 * Windows：`cmd /c openclaw.cmd … gateway run` 下 cmd 常先于 node 退出，`openclawProcess` 指向已死 PID，
 * `openclaw gateway stop` 又只停「服务」(`Gateway service missing`)，无法结束子进程里的 `gateway run`。
 * 这里按命令行中的路径标记（内置 unpacked / 外置 prefix 与 openclaw 二进制路径等）找出仍存活的 PID，供 taskkill /T。
 * @param {string[]} pathMarkers 规范化后的绝对路径片段（小写比较在函数内完成）
 * @returns {Promise<number[]>}
 */
async function findBundledGatewayRunPidsWindows(pathMarkers) {
  if (process.platform !== "win32") return [];
  const markers = [
    ...new Set(
      (pathMarkers || [])
        .map((m) => path.normalize(String(m).trim()))
        .filter((m) => m.length >= 4)
    ),
  ];
  if (!markers.length) return [];

  const script =
    "Get-CimInstance Win32_Process | Where-Object { $null -ne $_.CommandLine -and $_.CommandLine -match 'gateway\\s+run' } | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress -Depth 3";
  const r = await execWithOutput(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { cwd: os.tmpdir() }
  );
  if (r.code !== 0) return [];

  const pids = [];
  for (const row of parsePowerShellProcessJson(r.stdout)) {
    const line = String(row.CommandLine || "");
    if (!commandLineLooksLikeOpenClawGatewayRun(line)) continue;
    const lower = line.toLowerCase();
    let hit = false;
    for (const raw of markers) {
      const a = raw.toLowerCase();
      const b = raw.replace(/\\/g, "/").toLowerCase();
      if (lower.includes(a) || lower.includes(b)) {
        hit = true;
        break;
      }
    }
    if (!hit) continue;
    const pid = Number(row.ProcessId);
    if (Number.isFinite(pid) && pid > 0) pids.push(pid);
  }
  return [...new Set(pids)];
}

module.exports = {
  commandLineLooksLikeOpenClawGatewayRun,
  detectOpenClawGatewayProcessRunning,
  findBundledGatewayRunPidsWindows,
};
