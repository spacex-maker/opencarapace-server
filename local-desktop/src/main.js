const { app, BrowserWindow } = require("electron");
const { startServer } = require("./server");
const path = require("path");

let mainWindow = null;

async function createWindow() {
  await startServer();

  mainWindow = new BrowserWindow({
    width: 1024,
    height: 720,
    backgroundColor: "#020617",
    webPreferences: {
      contextIsolation: true,
      webSecurity: false, // 允许加载本地 iframe（OpenClaw）
    },
    title: "ClawHeart 本地客户端",
  });

  const isDev = process.env.ELECTRON_DEV === "true";

  if (isDev) {
    // 开发模式：加载 Vite dev server，实现热更新
    const devUrl = process.env.ELECTRON_RENDERER_URL || "http://localhost:5199";
    await mainWindow.loadURL(devUrl);
  } else {
    // 生产模式：加载打包好的前端静态文件
    const indexHtml = path.join(__dirname, "../frontend/dist/index.html");
    await mainWindow.loadFile(indexHtml);
  }

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

