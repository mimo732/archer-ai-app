/**
 * ARCHER AI — Windows command executors (pure Node.js).
 * Used by the Electron desktop runtime (packaged via extraFiles) and the
 * test harness. Every function resolves with a short human-readable result
 * or throws with an error message.
 */
const { spawn } = require("child_process");
const os = require("os");

/** well-known Windows apps → launch targets (App Paths / aliases) */
const APP_MAP = {
  notepad: "notepad.exe",
  calculator: "calc.exe",
  calc: "calc.exe",
  paint: "mspaint.exe",
  explorer: "explorer.exe",
  "file explorer": "explorer.exe",
  files: "explorer.exe",
  cmd: "cmd.exe",
  terminal: "wt.exe",
  powershell: "powershell.exe",
  chrome: "chrome.exe",
  edge: "msedge.exe",
  "microsoft edge": "msedge.exe",
  firefox: "firefox.exe",
  brave: "brave.exe",
  vscode: "code",
  "visual studio code": "code",
  code: "code",
  word: "winword.exe",
  excel: "excel.exe",
  powerpoint: "powerpnt.exe",
  outlook: "outlook.exe",
  spotify: "spotify.exe",
  discord: "discord.exe",
  telegram: "telegram.exe",
  whatsapp: "whatsapp.exe",
  steam: "steam.exe",
  taskmanager: "taskmgr.exe",
  "task manager": "taskmgr.exe",
  settings: "ms-settings:",
  camera: "microsoft.windows.camera:",
  calendar: "outlookcal:",
  mail: "outlookmail:",
};

function resolveApp(name) {
  const key = String(name || "").toLowerCase().trim();
  if (APP_MAP[key]) return APP_MAP[key];
  // "example.com" style names are websites — fall back to https URLs
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(key)) return `https://${key}`;
  return null;
}

function start(target) {
  return new Promise((resolve, reject) => {
    try {
      const child = spawn("cmd.exe", ["/c", "start", "", target], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.on("error", reject);
      child.unref();
      // `start` fires and forgets — give the shell a beat, then assume success
      setTimeout(() => resolve(`launched ${target}`), 250);
    } catch (e) {
      reject(e);
    }
  });
}

async function openApp({ name, query }) {
  const key = String(name || "").toLowerCase().trim();
  if (!key) throw new Error("no app name given");

  // youtube (+ optional search) opens the site/app in the default browser
  if (key === "youtube" || key === "yt") {
    const url = query
      ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
      : "https://www.youtube.com";
    return openUrl({ url });
  }
  if (key === "google") return openUrl({ url: "https://www.google.com" });
  if (key === "gmail") return openUrl({ url: "https://mail.google.com" });
  if (key === "maps") return openUrl({ url: "https://maps.google.com" });
  if (key === "facebook") return openUrl({ url: "https://www.facebook.com" });
  if (key === "instagram") return openUrl({ url: "https://www.instagram.com" });
  if (key === "twitter" || key === "x") return openUrl({ url: "https://x.com" });
  if (key === "whatsapp") return openUrl({ url: "https://web.whatsapp.com" });
  if (key === "chatgpt") return openUrl({ url: "https://chatgpt.com" });
  if (key === "github") return openUrl({ url: "https://github.com" });
  if (key === "tiktok") return openUrl({ url: "https://www.tiktok.com" });

  const target = resolveApp(key);
  if (!target) throw new Error(`I could not find "${name}" on this PC`);
  return start(target);
}

async function openUrl({ url }) {
  const u = String(url || "");
  if (!/^https?:\/\//i.test(u) && !/^(ms-[a-z]+|outlookcal|outlookmail|microsoft\.windows)/i.test(u)) {
    throw new Error("unsupported url");
  }
  return start(u);
}

/**
 * Real Windows toast via PowerShell (Win10/11). The Electron runtime swaps
 * this for a native Notification — this fallback keeps the module pure Node.
 */
async function notify({ title, body }) {
  const t = String(title || "ARCHER AI").replace(/'/g, "''");
  const b = String(body || "").replace(/'/g, "''");
  const script =
    `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null;` +
    `$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);` +
    `$t.GetElementsByTagName('text').Item(0).AppendChild($t.CreateTextNode('${t}')) | Out-Null;` +
    `$t.GetElementsByTagName('text').Item(1).AppendChild($t.CreateTextNode('${b}')) | Out-Null;` +
    `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('ARCHER AI').Show([Windows.UI.Notifications.ToastNotification]::new($t))`;
  return new Promise((resolve) => {
    try {
      const child = spawn("powershell.exe", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", script], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.on("error", () => resolve("notification skipped"));
      child.unref();
      setTimeout(() => resolve("notification sent"), 400);
    } catch {
      resolve("notification skipped");
    }
  });
}

async function sysInfo() {
  return {
    host: os.hostname(),
    platform: "windows",
    os: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    cpu: `${os.cpus().length} cores`,
    cpuModel: (os.cpus()[0] && os.cpus()[0].model) || "unknown",
    ramTotalGB: +(os.totalmem() / 1024 ** 3).toFixed(1),
    ramFreeGB: +(os.freemem() / 1024 ** 3).toFixed(1),
    uptimeHours: +(os.uptime() / 3600).toFixed(1),
    user: os.userInfo().username,
  };
}

module.exports = { APP_MAP, resolveApp, openApp, openUrl, notify, sysInfo, start };
