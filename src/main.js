
const {
  app,
  BrowserWindow,
  ipcMain,
  dialog
} = require("electron");

const path = require("path");

let mainWindow = null;

function isTrustedWindow(event) {
  return (
    mainWindow !== null &&
    !mainWindow.isDestroyed() &&
    event.sender === mainWindow.webContents
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 850,
    minWidth: 1000,
    minHeight: 650,
    backgroundColor: "#070708",
    title: "DramaTV",
    frame: false,
    autoHideMenuBar: true,
    show: false,

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.on("did-fail-load", (event, code, description, url, isMainFrame) => {
    if (!isMainFrame) return;

    console.error("DramaTV load error:", {
      code,
      description,
      url
    });
  });

  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

/* WINDOW CONTROLS */

ipcMain.on("window-minimize", event => {
  if (!isTrustedWindow(event)) return;

  mainWindow.minimize();
});

ipcMain.on("window-maximize", event => {
  if (!isTrustedWindow(event)) return;

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on("window-close", event => {
  if (!isTrustedWindow(event)) return;

  mainWindow.close();
});

/* APPLICATION */

app.whenReady().then(() => {
  app.setAppUserModelId("com.dramatv.desktop");

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("render-process-gone", (event, webContents, details) => {
  console.error("DramaTV renderer stopped:", details);
});
