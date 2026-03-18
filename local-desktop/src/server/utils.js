const { spawn } = require("child_process");
const axios = require("axios");

function detectPlatform() {
  const p = process.platform;
  if (p === "win32") return "windows";
  if (p === "darwin") return "macos";
  return "linux";
}

function execWithOutput(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      shell: false,
      windowsHide: true,
      ...opts,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += String(d)));
    child.stderr?.on("data", (d) => (stderr += String(d)));
    child.on("close", (code) => resolve({ code: typeof code === "number" ? code : 1, stdout, stderr }));
    child.on("error", (e) => resolve({ code: 1, stdout, stderr: String(e?.message || e) }));
  });
}

async function hasCommand(cmd) {
  const platform = detectPlatform();
  if (platform === "windows") {
    const r = await execWithOutput("cmd.exe", ["/c", "where", cmd]);
    return r.code === 0 && !!r.stdout.trim();
  }
  const r = await execWithOutput("sh", ["-lc", `command -v ${cmd} >/dev/null 2>&1 && echo ok`]);
  return r.code === 0 && r.stdout.includes("ok");
}

async function checkUrlReachable(url) {
  try {
    const res = await axios.get(url, { timeout: 1200, validateStatus: () => true });
    return res.status >= 200 && res.status < 500;
  } catch {
    return false;
  }
}

module.exports = {
  detectPlatform,
  execWithOutput,
  hasCommand,
  checkUrlReachable,
};
