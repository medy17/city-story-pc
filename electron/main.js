// Electron Main Process — Cross-platform City Story PC desktop shell (Windows / macOS / Linux)
const { app, BrowserWindow, dialog, ipcMain, protocol } = require("electron");
const fs = require("fs");
const path = require("path");
const { extractApk } = require("../scripts/extract_apk");
const { buildCatalog } = require("../scripts/build_catalog");

const ROOT_DIR = path.resolve(__dirname, "..");
const WEB_DIR = path.join(ROOT_DIR, "web");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".ico": "image/x-icon"
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: "citystory",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

function getUserAssetsDir() {
  return path.join(app.getPath("userData"), "assets");
}

function getUserDataDir() {
  return path.join(app.getPath("userData"), "data");
}

function getSavePath() {
  return path.join(app.getPath("userData"), "save.json");
}

// Assets are ready if extracted into userData OR manually extracted into web/ via CLI
function findAssetsRoot() {
  if (fs.existsSync(path.join(getUserAssetsDir(), "sprite_meta.json")) &&
      fs.existsSync(path.join(getUserDataDir(), "catalog.js"))) {
    return app.getPath("userData");
  }
  if (fs.existsSync(path.join(WEB_DIR, "assets", "sprite_meta.json")) &&
      fs.existsSync(path.join(WEB_DIR, "data", "catalog.js"))) {
    return WEB_DIR;
  }
  return null;
}

function resolveIconPath() {
  const root = findAssetsRoot();
  if (!root) return undefined;
  const p = path.join(root, "assets", "ui", "icon.png");
  return fs.existsSync(p) ? p : undefined;
}

let mainWindow = null;

function createWindow() {
  const hasAssets = !!findAssetsRoot();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: "City Story — PC Edition",
    backgroundColor: "#9ebc58",
    icon: resolveIconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(hasAssets ? "citystory://app/index.html" : "citystory://app/setup.html");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Serve bundled web/ code + extracted userData assets seamlessly over citystory://app/...
  protocol.handle("citystory", (request) => {
    const url = new URL(request.url);
    const relPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const safeRel = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");

    let filePath = null;
    const assetsRoot = findAssetsRoot();

    if (safeRel.startsWith("assets/") || safeRel.startsWith("assets\\") || safeRel === "data/catalog.js" || safeRel === "data\\catalog.js") {
      if (assetsRoot) {
        const candidate = path.join(assetsRoot, safeRel);
        if (fs.existsSync(candidate)) filePath = candidate;
      }
    }
    if (!filePath) {
      const webCandidate = path.join(WEB_DIR, safeRel);
      if (fs.existsSync(webCandidate)) filePath = webCandidate;
    }

    if (!filePath || !fs.statSync(filePath).isFile()) {
      return new Response("Not Found", { status: 404 });
    }

    const ext = path.extname(filePath).toLowerCase();
    const data = fs.readFileSync(filePath);
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "no-store"
      }
    });
  });

  // IPC: Save / Load game state
  ipcMain.handle("save:load", () => {
    const p = getSavePath();
    if (!fs.existsSync(p)) return null;
    try {
      return fs.readFileSync(p, "utf8");
    } catch {
      return null;
    }
  });

  ipcMain.handle("save:write", (_ev, json) => {
    if (typeof json !== "string" || !json.length) return false;
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(getSavePath(), json, "utf8");
    return true;
  });

  // IPC: Pick APK file via native OS file dialog
  ipcMain.handle("apk:pick", async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: "Select your City Story APK",
      properties: ["openFile"],
      filters: [{ name: "Android Package (*.apk)", extensions: ["apk"] }]
    });
    if (res.canceled || !res.filePaths.length) return null;
    return res.filePaths[0];
  });

  // IPC: Extract & decode APK into userData, build catalog, then launch game
  ipcMain.handle("apk:import", async (_ev, apkPath) => {
    const sendProgress = (pct, message) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("apk:progress", { pct, message });
      }
    };
    try {
      const assetsDir = getUserAssetsDir();
      const catalogPath = path.join(getUserDataDir(), "catalog.js");
      const stats = extractApk(apkPath, assetsDir, ({ pct, message }) => sendProgress(pct, message));
      sendProgress(95, "Building 275-item City Story catalog...");
      const catStats = buildCatalog(assetsDir, catalogPath);
      sendProgress(100, "All set! Launching City Story...");

      const iconPath = resolveIconPath();
      if (iconPath && mainWindow && process.platform !== "darwin") {
        mainWindow.setIcon(iconPath);
      }
      return { ok: true, stats, catStats };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  });

  ipcMain.handle("app:launchGame", () => {
    if (mainWindow) {
      mainWindow.loadURL("citystory://app/index.html");
    }
  });

  ipcMain.handle("app:openSetup", () => {
    if (mainWindow) {
      mainWindow.loadURL("citystory://app/setup.html");
    }
  });

  ipcMain.handle("app:toggleFullscreen", () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
