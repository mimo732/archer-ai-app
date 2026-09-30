/**
 * Keep a fake Windows device alive for UI testing (heartbeat + command exec).
 * Usage: node scripts/ui-test-device.js [seconds]
 */
const { DeviceClient } = require("/home/z/my-project/server/src/protocol");
const SERVER = "http://localhost:3000";
const secs = Number(process.argv[2] || 180);

const agent = new DeviceClient({
  serverUrl: SERVER,
  deviceId: "ui-win-001",
  name: "Rakib's PC (Windows)",
  platform: "windows",
  version: "1.0.0",
  executors: {
    openApp: async (p) => `SIMULATED: opened ${p.name}${p.query ? " (" + p.query + ")" : ""}`,
    openUrl: async (p) => `SIMULATED: opened ${p.url}`,
    notify: async (p) => `SIMULATED: toast "${p.title}: ${p.body}"`,
    sysInfo: async () => ({ host: "RAKIB-PC", platform: "windows", ramTotalGB: 16, cpu: "8 cores" }),
  },
  logger: { log: (m) => console.log(`[UI-DEVICE] ${m}`) },
});

agent.start();
setTimeout(() => {
  agent.stop();
  console.log("[UI-DEVICE] done, exiting");
  process.exit(0);
}, secs * 1000);
