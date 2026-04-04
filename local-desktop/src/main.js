const { app, BrowserWindow, dialog, nativeImage } = require("electron");
const { startServer } = require("./server");
const path = require("path");
const fs = require("fs");

let mainWindow = null;

function getRendererIndexPath() {
  if (process.env.ELECTRON_DEV === "true") {
    return null;
  }
  if (app.isPackaged) {
    const p = path.join(app.getAppPath(), "frontend", "dist", "index.html");
    if (fs.existsSync(p)) return p;
  }
  return path.join(__dirname, "..", "frontend", "dist", "index.html");
}

function getPackagedUnpackedRoot() {
  if (!app.isPackaged) return null;
  const ap = app.getAppPath();
  return ap.toLowerCase().endsWith(".asar") ? `${ap}.unpacked` : ap;
}

function getWindowsAppUserModelId() {
  const devRoot = path.join(__dirname, "..");
  const candidates = [];
  if (app.isPackaged) {
    const up = getPackagedUnpackedRoot();
    if (up) candidates.push(path.join(up, "build", "electron-brand.json"));
    candidates.push(path.join(app.getAppPath(), "build", "electron-brand.json"));
  } else {
    candidates.push(path.join(devRoot, "build", "electron-brand.json"));
  }
  for (const meta of candidates) {
    try {
      if (fs.existsSync(meta)) {
        const j = JSON.parse(fs.readFileSync(meta, "utf8"));
        if (j.appUserModelId) return j.appUserModelId;
      }
    } catch {
      /* ignore */
    }
  }
  try {
    return require(path.join(devRoot, "package.json")).build?.appId || "com.clawheart.desktop";
  } catch {
    return "com.clawheart.desktop";
  }
}

/** 窗口图标：build/icon.ico（Windows 优先）与 build/icon.png 同源 */
function getAppIconPath() {
  const devRoot = path.join(__dirname, "..");
  const winFirst = process.platform === "win32";
  const rels = winFirst
    ? [["build", "icon.ico"], ["build", "icon.png"]]
    : [["build", "icon.png"], ["build", "icon.ico"]];

  if (!app.isPackaged) {
    for (const segs of rels) {
      const p = path.join(devRoot, ...segs);
      if (fs.existsSync(p)) return p;
    }
    return undefined;
  }

  const unpacked = getPackagedUnpackedRoot();
  const roots = [];
  if (unpacked) roots.push(unpacked);
  roots.push(app.getAppPath());
  for (const root of roots) {
    for (const segs of rels) {
      const p = path.join(root, ...segs);
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

function logFatal(err) {
  const msg = err && (err.stack || err.message || String(err));
  console.error(msg);
  try {
    const dir = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "startup.log"), `[${new Date().toISOString()}]\n${msg}\n\n`);
  } catch {
    // ignore
  }
  try {
    dialog.showErrorBox(
      "ClawHeart Desktop 启动失败",
      `无法启动应用。可能原因：原生模块未针对本版本 Electron 编译、或前端资源缺失。\n\n日志：${path.join(
        app.getPath("userData"),
        "logs",
        "startup.log"
      )}\n\n${String(msg).slice(0, 900)}`
    );
  } catch {
    // ignore
  }
}

async function createWindow() {
  await startServer();

  const iconPath = getAppIconPath();
  let icon;
  if (iconPath) {
    try {
      icon = nativeImage.createFromPath(iconPath);
      if (icon.isEmpty()) icon = undefined;
    } catch {
      icon = undefined;
    }
  }

  mainWindow = new BrowserWindow({
    width: 1024,
    height: 720,
    backgroundColor: "#020617",
    ...(icon ? { icon } : {}),
    webPreferences: {
      contextIsolation: true,
      webSecurity: false, // 允许加载本地 iframe（OpenClaw）
    },
    title: "ClawHeart 本地客户端",
  });

  const isDev = process.env.ELECTRON_DEV === "true";

  if (isDev) {
    const devUrl = process.env.ELECTRON_RENDERER_URL || "http://localhost:5199";
    await mainWindow.loadURL(devUrl);
  } else {
    const indexHtml = getRendererIndexPath();
    if (!indexHtml || !fs.existsSync(indexHtml)) {
      throw new Error(`找不到前端页面: ${indexHtml || "(null)"}`);
    }
    await mainWindow.loadFile(indexHtml);
  }

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId(getWindowsAppUserModelId());
  }
  return createWindow();
}).catch(logFatal);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    void createWindow().catch(logFatal);
  }
});
