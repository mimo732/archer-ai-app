/**
 * ARCHER AI — Electron preload
 * Exposes the minimal device bridge (window.archerBridge) that the website's
 * universal agent (/agent-client.js) detects. No Node primitives leak into
 * the renderer: contextIsolation stays on, only these methods are exposed.
 */
const { contextBridge, ipcRenderer } = require("electron");

const call = (channel, payload) => ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld("archerBridge", {
  platform: "windows",
  deviceInfo: () => call("archer:device-info"),
  openApp: (payload) => call("archer:open-app", payload),
  openUrl: (payload) => call("archer:open-url", payload),
  notify: (payload) => call("archer:notify", payload),
  sysInfo: () => call("archer:sys-info"),
});
