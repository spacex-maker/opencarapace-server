/**
 * PID 文件管理：业界标准的进程定位/存活检测/停止机制。
 *
 * 每种模式（bundled / external）在各自的 OPENCLAW_STATE_DIR 下写一个
 * clawheart-gateway.pid，内容为 JSON：
 *   { pid, pgid, port, bin, startedAt }
 *
 * 停止时读 PID 文件 → kill(-pgid) 杀整个进程组 → 删除 PID 文件。
 */

const fs = require("fs");
const path = require("path");

const PID_FILENAME = "clawheart-gateway.pid";

function pidFilePath(stateDir) {
  return path.join(stateDir, PID_FILENAME);
}

function writePidFile(stateDir, info) {
  const filePath = pidFilePath(stateDir);
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({
      pid: info.pid,
      pgid: info.pgid ?? info.pid,
      port: info.port ?? null,
      bin: info.bin ?? null,
      startedAt: Date.now(),
    }, null, 2));
  } catch (err) {
    console.warn(`[PID] 写入 ${filePath} 失败:`, err?.message || err);
  }
}

function readPidFile(stateDir) {
  const filePath = pidFilePath(stateDir);
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8").trim();
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Number.isFinite(data?.pid) || data.pid <= 0) return null;
    return {
      pid: data.pid,
      pgid: Number.isFinite(data.pgid) && data.pgid > 0 ? data.pgid : data.pid,
      port: data.port ?? null,
      bin: data.bin ?? null,
      startedAt: data.startedAt ?? null,
    };
  } catch {
    return null;
  }
}

function removePidFile(stateDir) {
  const filePath = pidFilePath(stateDir);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* ignore */ }
}

/**
 * 通过 kill(pid, 0) 检测进程是否还活着（不发送信号，只做权限检查）。
 * 这是 Unix 标准的 "is process alive" 探针。
 */
function isProcessAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e?.code === "EPERM";
  }
}

/**
 * 杀掉整个进程组。detached:true 启动的子进程 pgid === pid。
 * kill(-pgid) 会向该组内所有进程发信号——包括子进程的子进程。
 */
function killProcessGroup(pgid, signal = "SIGTERM") {
  if (!Number.isFinite(pgid) || pgid <= 0) return false;
  try {
    process.kill(-pgid, signal);
    return true;
  } catch {
    return false;
  }
}

/**
 * 标准停止序列：SIGTERM → 等待 → SIGKILL → 删 PID 文件。
 * @returns {Promise<boolean>} 进程组是否已退出
 */
async function killByPidFile(stateDir, { waitMs = 3000 } = {}) {
  const info = readPidFile(stateDir);
  if (!info) return true;

  const { pid, pgid } = info;
  if (!isProcessAlive(pid)) {
    removePidFile(stateDir);
    return true;
  }

  killProcessGroup(pgid, "SIGTERM");

  const step = 200;
  for (let elapsed = 0; elapsed < waitMs; elapsed += step) {
    await new Promise((r) => setTimeout(r, step));
    if (!isProcessAlive(pid)) {
      removePidFile(stateDir);
      return true;
    }
  }

  killProcessGroup(pgid, "SIGKILL");
  try { process.kill(pid, "SIGKILL"); } catch { /* already dead */ }

  await new Promise((r) => setTimeout(r, 500));
  const dead = !isProcessAlive(pid);
  if (dead) removePidFile(stateDir);
  return dead;
}

module.exports = {
  pidFilePath,
  writePidFile,
  readPidFile,
  removePidFile,
  isProcessAlive,
  killProcessGroup,
  killByPidFile,
};
