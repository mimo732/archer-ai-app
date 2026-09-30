/**
 * ARCHER AI — Windows desktop (Electron) main process
 * ---------------------------------------------------
 * A lean, secure shell around the ARCHER website brain:
 *   • loads the same ARCHER UI used on the web (single source of truth)
 *   • exposes a minimal, context-isolated bridge (window.archerBridge) that
 *     the site's universal agent (/agent-client.js) uses to register this
 *     PC with the brain and execute its commands on Windows
 *   • lives in the tray so commands keep arriving while the window is closed
 */
const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, shell } = require("electron");
const path = require("path");
const fs = require("fs");

// ---- server-core (device executors, pure Node) ----------------------------
// dev:  <repo>/server/src      packaged: <resources>/server-core/src
const serverCore = app.isPackaged
  ? require(path.join(process.resourcesPath, "server-core", "src", "index.js"))
  : require(path.join(__dirname, "..", "server", "src"));
const winExec = serverCore.executors.windows;

// ---- configuration ---------------------------------------------------------
const BAKED_SERVER_URL = "https://preview-8cd85ce6-1016-48b5-a387-d12748b3dc31.space-z.ai";

function readConfig() {
  let cfg = { serverUrl: BAKED_SERVER_URL };
  // 1. build-time baked value (GitHub Actions rewrites config.default.json)
  try {
    const baked = JSON.parse(fs.readFileSync(path.join(__dirname, "config.default.json"), "utf8"));
    if (baked.serverUrl) cfg.serverUrl = baked.serverUrl;
  } catch {
    /* keep default */
  }
  // 2. per-user override
  try {
    const user = JSON.parse(
      fs.readFileSync(path.join(app.getPath("userData"), "config.json"), "utf8")
    );
    if (user.serverUrl) cfg = { ...cfg, ...user };
  } catch {
    /* no user override */
  }
  // 3. CLI flag
  const argIdx = process.argv.indexOf("--server");
  if (argIdx !== -1 && process.argv[argIdx + 1]) cfg.serverUrl = process.argv[argIdx + 1];
  return cfg;
}

let cfg = null;
let win = null;
let tray = null;
let quitting = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      win.show();
      win.focus();
    }
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 440,
    height: 920,
    minWidth: 360,
    minHeight: 640,
    backgroundColor: "#030603",
    title: "ARCHER AI",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload needs require() for the bridge
      devTools: !app.isPackaged,
    },
  });

  win.loadURL(cfg.serverUrl);
  win.once("ready-to-show", () => win.show());

  // closing the window hides to tray (agent keeps receiving commands);
  // real quit lives in the tray menu / CmdOrCtrl+Q
  win.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });

  // external links open in the real browser, never hijack the app window
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function createTray() {
  const iconPath = path.join(__dirname, "build", "icon.png");
  const img = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(img.isEmpty() ? iconPath : img);
  tray.setToolTip("ARCHER AI — online");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show ARCHER", click: () => (win ? (win.show(), win.focus()) : createWindow()) },
      { type: "separator" },
      {
        label: "Open Website Brain",
        click: () => shell.openExternal(cfg.serverUrl),
      },
      { type: "separator" },
      {
        label: "Quit ARCHER",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on("double-click", () => (win ? (win.show(), win.focus()) : createWindow()));
}

// ---- IPC bridge (executors run here, in the trusted main process) ----------
ipcMain.handle("archer:device-info", () => ({
  deviceId: `win-${machineId()}`,
  name: `Windows PC — ${require("os").hostname()}`,
  platform: "windows",
  version: app.getVersion(),
}));
ipcMain.handle("archer:open-app", (_e, payload) => winExec.openApp(payload || {}));
ipcMain.handle("archer:open-url", (_e, payload) => winExec.openUrl(payload || {}));
ipcMain.handle("archer:sys-info", () => winExec.sysInfo());
ipcMain.handle("archer:notify", (_e, { title, body }) => {
  try {
    if (Notification.isSupported()) {
      new Notification({ title: String(title || "ARCHER AI"), body: String(body || ""), silent: false }).show();
      return "notification sent";
    }
    return winExec.notify({ title, body });
  } catch {
    return "notification skipped";
  }
});

/** stable per-machine id (registry machine guid w/o extra deps) */
function machineId() {
  try {
    const { execSync } = require("child_process");
    const out = execSync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
      { windowsHide: true }
    )
      .toString()
      .trim();
    const m = out.match(/([a-f0-9-]{36})/i);
    if (m) return m[1];
  } catch {
    /* fall through */
  }
  return `fallback-${require("os").hostname()}`;
}

app.whenReady().then(() => {
  cfg = readConfig();
  createWindow();
  createTray();
});

app.on("before-quit", () => {
  quitting = true;
});

app.on("window-all-closed", () => {
  // stay alive in tray — the brain must be able to reach this PC
});
