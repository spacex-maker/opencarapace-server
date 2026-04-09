const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const { spawn } = require("child_process");
const { detectPlatform, execWithOutput, execWithOutputStream, sanitizeInstallEnv } = require("./utils.js");

/** 仅当为真实磁盘目录且不在 app.asar 内时用作 spawn cwd，否则 npm/node 会报 spawn ENOTDIR */
function resolveSpawnCwd(preferred) {
  const fb = os.tmpdir();
  if (!preferred || typeof preferred !== "string") return fb;
  try {
    const normalized = path.normalize(preferred);
    if (/\.asar([/\\]|$)/i.test(normalized)) return fb;
    if (!fs.existsSync(preferred)) return fb;
    if (!fs.statSync(preferred).isDirectory()) return fb;
    return preferred;
  } catch {
    return fb;
  }
}

// Node.js 版本配置（须满足 openclaw 包要求：当前为 >=22.16.0）
const NODE_VERSION = "22.16.0";
const NODE_DOWNLOAD_BASE = "https://nodejs.org/dist";

/** @typedef {"bundled" | "external"} NodeRuntimeProfile */
/** 内置 Gateway：~/.opencarapace/embedded-node；外置专用：~/.opencarapace/external-gateway-node */

function normalizeNodeRuntimeProfile(profile) {
  return profile === "external" ? "external" : "bundled";
}

function getNodeRuntimeBaseDir(profile) {
  const userDataPath = process.env.APPDATA || process.env.HOME || process.cwd();
  const sub = normalizeNodeRuntimeProfile(profile) === "external" ? "external-gateway-node" : "embedded-node";
  return path.join(userDataPath, ".opencarapace", sub);
}

/**
 * 获取按配置下载的 Node.js 目录（内置卡 bundled / 外置卡专用 external）
 * @param {NodeRuntimeProfile} [profile]
 */
function getEmbeddedNodePath(profile) {
  const p = normalizeNodeRuntimeProfile(profile);
  const platform = detectPlatform();
  const baseDir = getNodeRuntimeBaseDir(p);
  
  if (platform === "windows") {
    return {
      dir: path.join(baseDir, `node-v${NODE_VERSION}-win-x64`),
      npm: path.join(baseDir, `node-v${NODE_VERSION}-win-x64`, "npm.cmd"),
      node: path.join(baseDir, `node-v${NODE_VERSION}-win-x64`, "node.exe"),
    };
  } else if (platform === "macos") {
    const variants = [
      `node-v${NODE_VERSION}-darwin-arm64`,
      `node-v${NODE_VERSION}-darwin-x64`,
    ];
    for (const name of variants) {
      const dir = path.join(baseDir, name);
      const node = path.join(dir, "bin", "node");
      const npm = path.join(dir, "bin", "npm");
      if (fs.existsSync(node) && fs.existsSync(npm)) {
        return { dir, npm, node };
      }
    }
    const name = `node-v${NODE_VERSION}-darwin-x64`;
    return {
      dir: path.join(baseDir, name),
      npm: path.join(baseDir, name, "bin", "npm"),
      node: path.join(baseDir, name, "bin", "node"),
    };
  } else {
    return {
      dir: path.join(baseDir, `node-v${NODE_VERSION}-linux-x64`),
      npm: path.join(baseDir, `node-v${NODE_VERSION}-linux-x64`, "bin", "npm"),
      node: path.join(baseDir, `node-v${NODE_VERSION}-linux-x64`, "bin", "node"),
    };
  }
}

/**
 * 检查指定 profile 的已下载 Node 是否存在（路径须为可执行文件，目录冒充会触发 spawn ENOTDIR）
 * @param {NodeRuntimeProfile} [profile] 默认 bundled（兼容旧调用）
 */
function hasEmbeddedNode(profile) {
  const paths = getEmbeddedNodePath(profile);
  try {
    if (!fs.existsSync(paths.npm) || !fs.existsSync(paths.node)) return false;
    const ns = fs.statSync(paths.node);
    const ms = fs.statSync(paths.npm);
    if (!ns.isFile() || !ms.isFile()) return false;
  } catch {
    return false;
  }
  return true;
}

/**
 * 获取 Node.js 下载 URL
 */
function getNodeDownloadUrl() {
  const platform = detectPlatform();
  let filename;
  
  if (platform === "windows") {
    filename = `node-v${NODE_VERSION}-win-x64.zip`;
  } else if (platform === "macos") {
    const arch = process.arch === "arm64" ? "arm64" : "x64";
    filename = `node-v${NODE_VERSION}-darwin-${arch}.tar.gz`;
  } else {
    filename = `node-v${NODE_VERSION}-linux-x64.tar.xz`;
  }
  
  return `${NODE_DOWNLOAD_BASE}/v${NODE_VERSION}/${filename}`;
}

/**
 * 下载文件
 */
function downloadFile(url, destPath, onProgress) {
  console.log(`[node-manager] 开始下载: ${url}`);
  console.log(`[node-manager] 目标路径: ${destPath}`);
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    const request = https.get(url, (response) => {
      console.log(`[node-manager] HTTP 状态码: ${response.statusCode}`);
      
      if (response.statusCode === 302 || response.statusCode === 301) {
        // 处理重定向
        console.log(`[node-manager] 重定向到: ${response.headers.location}`);
        file.close();
        try {
          fs.unlinkSync(destPath);
        } catch (e) {
          // ignore
        }
        return downloadFile(response.headers.location, destPath, onProgress).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        try {
          fs.unlinkSync(destPath);
        } catch (e) {
          // ignore
        }
        return reject(new Error(`下载失败: HTTP ${response.statusCode}`));
      }
      
      const totalSize = parseInt(response.headers["content-length"], 10);
      let downloadedSize = 0;
      /** 避免每个 chunk 都回调同一 floor 百分比（例如长时间停在 downloading: 99%） */
      let lastReportedPercent = -1;
      console.log(`[node-manager] 文件大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
      
      response.on("data", (chunk) => {
        downloadedSize += chunk.length;
        if (onProgress && totalSize) {
          const percent = Math.floor((downloadedSize / totalSize) * 100);
          if (percent !== lastReportedPercent) {
            lastReportedPercent = percent;
            onProgress({ downloaded: downloadedSize, total: totalSize, percent });
          }
        }
      });
      
      response.pipe(file);
      
      file.on("finish", () => {
        console.log(`[node-manager] 下载完成`);
        file.close();
        resolve();
      });
      
      file.on("error", (err) => {
        console.error(`[node-manager] 文件写入错误:`, err);
        file.close();
        try {
          fs.unlinkSync(destPath);
        } catch (e) {
          // ignore
        }
        reject(err);
      });
    });
    
    request.on("error", (err) => {
      console.error(`[node-manager] 下载请求错误:`, err);
      file.close();
      try {
        fs.unlinkSync(destPath);
      } catch (e) {
        // ignore
      }
      reject(err);
    });
    
    request.setTimeout(30000, () => {
      console.error(`[node-manager] 下载超时`);
      request.destroy();
      file.close();
      try {
        fs.unlinkSync(destPath);
      } catch (e) {
        // ignore
      }
      reject(new Error("下载超时（30秒）"));
    });
  });
}

/**
 * 解压文件
 */
async function extractArchive(archivePath, destDir) {
  const platform = detectPlatform();
  
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  if (platform === "windows") {
    // Windows: 使用 PowerShell 解压 zip
    const result = await execWithOutput("powershell.exe", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force`,
    ], { shell: false });
    
    if (result.code !== 0) {
      throw new Error(`解压失败: ${result.stderr}`);
    }
  } else {
    // Unix: 使用 tar
    const result = await execWithOutput("tar", ["-xf", archivePath, "-C", destDir], { shell: false });
    
    if (result.code !== 0) {
      throw new Error(`解压失败: ${result.stderr}`);
    }
  }
}

/**
 * 删除指定 profile 下已下载的 Node 目录（整棵子树）
 * @param {NodeRuntimeProfile} profile
 */
function removeNodeRuntime(profile) {
  const p = normalizeNodeRuntimeProfile(profile);
  const root = getNodeRuntimeBaseDir(p);
  try {
    if (fs.existsSync(root)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  } catch (e) {
    console.error(`[node-manager] removeNodeRuntime(${p}) failed:`, e);
    throw e;
  }
}

/**
 * 下载并安装 Node.js 到指定 profile 目录
 * @param {(p: { stage?: string; percent?: number }) => void} [onProgress]
 * @param {NodeRuntimeProfile} [profile]
 */
async function downloadAndInstallNode(onProgress, profile) {
  const prof = normalizeNodeRuntimeProfile(profile);
  const label = prof === "external" ? "外置 Gateway 专用 Node" : "内置运行时 Node";
  console.log(`[node-manager] 开始安装 ${label} v${NODE_VERSION}`);

  const paths = getEmbeddedNodePath(prof);
  const baseDir = path.dirname(paths.dir);
  const platform = detectPlatform();
  
  console.log(`[node-manager] 平台: ${platform}`);
  console.log(`[node-manager] 安装目录: ${baseDir}`);
  
  // 创建目录
  if (!fs.existsSync(baseDir)) {
    console.log(`[node-manager] 创建目录: ${baseDir}`);
    fs.mkdirSync(baseDir, { recursive: true });
  }
  
  const url = getNodeDownloadUrl();
  const ext = platform === "windows" ? ".zip" : platform === "macos" ? ".tar.gz" : ".tar.xz";
  const archivePath = path.join(baseDir, `node-v${NODE_VERSION}${ext}`);
  
  console.log(`[node-manager] 下载 URL: ${url}`);
  console.log(`[node-manager] 压缩包路径: ${archivePath}`);
  
  try {
    // 下载
    if (onProgress) onProgress({ stage: "downloading", percent: 0 });
    console.log(`[node-manager] 开始下载...`);
    
    await downloadFile(url, archivePath, (progress) => {
      if (onProgress) {
        const percent = progress.percent || Math.floor((progress.downloaded / progress.total) * 100);
        onProgress({ stage: "downloading", percent });
      }
    });
    
    console.log(`[node-manager] 下载完成，开始解压...`);
    
    // 解压
    if (onProgress) onProgress({ stage: "extracting", percent: 50 });
    await extractArchive(archivePath, baseDir);
    
    console.log(`[node-manager] 解压完成，清理压缩包...`);
    
    // 清理压缩包
    fs.unlinkSync(archivePath);
    
    console.log(`[node-manager] 验证安装...`);
    
    // 验证
    if (!hasEmbeddedNode(prof)) {
      throw new Error("Node.js 安装验证失败");
    }

    console.log(`[node-manager] 安装成功！`);
    
    if (onProgress) onProgress({ stage: "completed", percent: 100 });
    return true;
  } catch (err) {
    console.error(`[node-manager] 安装失败:`, err);
    // 清理失败的下载
    if (fs.existsSync(archivePath)) {
      try {
        fs.unlinkSync(archivePath);
      } catch (e) {
        // ignore
      }
    }
    throw err;
  }
}

/**
 * macOS/Linux：只通过 login shell 调内置 bin/npm，不 spawn(node, npm-cli.js)。
 * 在 Electron 下对 node 二进制 spawn 仍可能 ENOTDIR；交给 bash 启动 npm 脚本最稳。
 */
function unixEmbeddedNpmLine(paths, args) {
  const esc = (s) => `'${String(s).replace(/'/g, `'\"'\"'`)}'`;
  return `${esc(paths.npm)} ${args.map(esc).join(" ")}`;
}

/**
 * 使用内置 Node.js 执行 npm 命令
 */
async function runEmbeddedNpm(args, opts = {}) {
  const profile = normalizeNodeRuntimeProfile(opts.profile);
  const paths = getEmbeddedNodePath(profile);
  const platform = detectPlatform();
  if (!hasEmbeddedNode(profile)) {
    throw new Error(profile === "external" ? "外置专用 Node 未安装" : "内置 Node.js 未安装");
  }

  const cwd = os.tmpdir();
  const pathPrefix = `${path.dirname(paths.node)}${path.delimiter}${process.env.PATH || ""}`;
  const env = sanitizeInstallEnv({ ...opts.env, PATH: pathPrefix });

  if (platform === "windows") {
    return execWithOutput("cmd.exe", ["/c", paths.npm, ...args], { shell: false, cwd: resolveSpawnCwd(opts.cwd), env });
  }

  const line = unixEmbeddedNpmLine(paths, args);
  const bash = "/bin/bash";
  if (fs.existsSync(bash)) {
    return execWithOutput(bash, ["-lc", line], { shell: false, cwd, env });
  }
  return execWithOutput("/bin/sh", ["-c", line], { shell: false, cwd, env });
}

/**
 * 内置 npm 流式输出（安装 OpenClaw 时写面板日志）
 */
async function runEmbeddedNpmStream(args, opts = {}, onChunk) {
  const profile = normalizeNodeRuntimeProfile(opts.profile);
  const paths = getEmbeddedNodePath(profile);
  const platform = detectPlatform();

  if (!hasEmbeddedNode(profile)) {
    throw new Error(profile === "external" ? "外置专用 Node 未安装" : "内置 Node.js 未安装");
  }

  const cwd = os.tmpdir();
  const pathPrefix = `${path.dirname(paths.node)}${path.delimiter}${process.env.PATH || ""}`;
  const env = sanitizeInstallEnv({ ...opts.env, PATH: pathPrefix });

  if (platform === "windows") {
    return execWithOutputStream(
      "cmd.exe",
      ["/c", paths.npm, ...args],
      { shell: false, cwd: resolveSpawnCwd(opts.cwd), env },
      onChunk
    );
  }

  const line = unixEmbeddedNpmLine(paths, args);
  const bash = "/bin/bash";
  if (fs.existsSync(bash)) {
    return execWithOutputStream(bash, ["-lc", line], { shell: false, cwd, env }, onChunk);
  }
  return execWithOutputStream("/bin/sh", ["-c", line], { shell: false, cwd, env }, onChunk);
}

module.exports = {
  getEmbeddedNodePath,
  hasEmbeddedNode,
  removeNodeRuntime,
  downloadAndInstallNode,
  runEmbeddedNpm,
  runEmbeddedNpmStream,
  NODE_VERSION,
  normalizeNodeRuntimeProfile,
};
