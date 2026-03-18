const { app, BrowserWindow } = require("electron");
const { startServer } = require("./server");

let mainWindow = null;

async function createWindow() {
  await startServer();

  mainWindow = new BrowserWindow({
    width: 1024,
    height: 720,
    backgroundColor: "#020617",
    webPreferences: {
      contextIsolation: true,
    },
    title: "ClawHeart 本地客户端",
  });

  // 开发阶段：加载 local-desktop 自己的 Vite dev server（端口 5199）
  await mainWindow.loadURL("http://localhost:5199");

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

