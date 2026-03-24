const fs = require("fs");
const path = require("path");
const https = require("https");
const { spawn } = require("child_process");
const { detectPlatform, execWithOutput } = require("./utils.js");

// Node.js 版本配置（须满足 openclaw 包要求：当前为 >=22.16.0）
const NODE_VERSION = "22.16.0";
const NODE_DOWNLOAD_BASE = "https://nodejs.org/dist";

/**
 * 获取内置 Node.js 的存储路径
 */
function getEmbeddedNodePath() {
  const platform = detectPlatform();
  const userDataPath = process.env.APPDATA || process.env.HOME || process.cwd();
  const baseDir = path.join(userDataPath, ".opencarapace", "embedded-node");
  
  if (platform === "windows") {
    return {
      dir: path.join(baseDir, `node-v${NODE_VERSION}-win-x64`),
      npm: path.join(baseDir, `node-v${NODE_VERSION}-win-x64`, "npm.cmd"),
      node: path.join(baseDir, `node-v${NODE_VERSION}-win-x64`, "node.exe"),
    };
  } else if (platform === "macos") {
    return {
      dir: path.join(baseDir, `node-v${NODE_VERSION}-darwin-x64`),
      npm: path.join(baseDir, `node-v${NODE_VERSION}-darwin-x64`, "bin", "npm"),
      node: path.join(baseDir, `node-v${NODE_VERSION}-darwin-x64`, "bin", "node"),
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
 * 检查内置 Node.js 是否已存在
 */
function hasEmbeddedNode() {
  const paths = getEmbeddedNodePath();
  return fs.existsSync(paths.npm) && fs.existsSync(paths.node);
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
    filename = `node-v${NODE_VERSION}-darwin-x64.tar.gz`;
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
      console.log(`[node-manager] 文件大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
      
      response.on("data", (chunk) => {
        downloadedSize += chunk.length;
        if (onProgress && totalSize) {
          const percent = Math.floor((downloadedSize / totalSize) * 100);
          onProgress({ downloaded: downloadedSize, total: totalSize, percent });
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
 * 下载并安装内置 Node.js
 */
async function downloadAndInstallNode(onProgress) {
  console.log(`[node-manager] 开始安装内置 Node.js v${NODE_VERSION}`);
  
  const paths = getEmbeddedNodePath();
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
    if (!hasEmbeddedNode()) {
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
 * 使用内置 Node.js 执行 npm 命令
 */
async function runEmbeddedNpm(args, opts = {}) {
  const paths = getEmbeddedNodePath();
  const platform = detectPlatform();
  
  if (!hasEmbeddedNode()) {
    throw new Error("内置 Node.js 未安装");
  }
  
  if (platform === "windows") {
    return execWithOutput("cmd.exe", ["/c", paths.npm, ...args], { shell: false, ...opts });
  } else {
    return execWithOutput(paths.npm, args, { shell: false, ...opts });
  }
}

module.exports = {
  getEmbeddedNodePath,
  hasEmbeddedNode,
  downloadAndInstallNode,
  runEmbeddedNpm,
  NODE_VERSION,
};
