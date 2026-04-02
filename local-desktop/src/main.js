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

function getAppIconPath() {
  if (app.isPackaged) {
    const p = path.join(app.getAppPath(), "build", "icon.png");
    if (fs.existsSync(p)) return p;
  }
  const dev = path.join(__dirname, "..", "build", "icon.png");
  if (fs.existsSync(dev)) return dev;
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

app.whenReady().then(() => createWindow().catch(logFatal));

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
