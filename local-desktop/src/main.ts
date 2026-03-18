import { app, BrowserWindow } from "electron";
import path from "path";

let mainWindow: BrowserWindow | null = null;

async function startLocalProxyIfPossible() {
  try {
    // 优先尝试使用已经构建好的 local-proxy（dist），否则回退到 src（开发模式）
    let startServer: (() => Promise<void>) | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require("../../local-proxy/dist/index.js");
      startServer = mod.startServer;
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require("../../local-proxy/src/index.ts");
      startServer = mod.startServer;
    }
    if (startServer) {
      await startServer();
    }
  } catch (e) {
    // 本地代理启动失败时，仅在控制台提示，不阻塞桌面应用启动
    // eslint-disable-next-line no-console
    console.error("Failed to start embedded local proxy:", e);
  }
}

async function createWindow() {
  await startLocalProxyIfPossible();

  mainWindow = new BrowserWindow({
    width: 1024,
    height: 720,
    webPreferences: {
      contextIsolation: true,
    },
    title: "ClawHeart 本地客户端",
  });

  const isDev = process.env.ELECTRON_DEV === "true";

  // 始终加载打包好的前端静态文件（简化开发流程）
  const indexHtml = path.join(__dirname, "../frontend/dist/index.html");
  await mainWindow.loadFile(indexHtml);

  // 开发模式下自动打开开发者工具
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    void createWindow();
  }
});

