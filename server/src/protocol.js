/**
 * ARCHER AI — Device Link Protocol
 * --------------------------------
 * The contract between the ARCHER brain (the website) and every installed
 * ARCHER app (Windows desktop, Android). The brain exposes:
 *
 *   POST /api/devices            register / heartbeat  { deviceId, name, platform, version }
 *   GET  /api/devices            list all linked devices (website UI)
 *   DEL  /api/devices?deviceId=  unlink a device
 *   POST /api/commands           queue a command { deviceId | target:"all", action, payload }
 *   GET  /api/commands?deviceId= fetch my pending commands (device)
 *   POST /api/commands/ack       report result { commandId, status, result }
 */

const ENDPOINTS = Object.freeze({
  register: "/api/devices",
  commands: "/api/commands",
  ack: "/api/commands/ack",
});

const ACTIONS = Object.freeze([
  "open_app", // { name, query? }  → launch an app on the device
  "open_url", // { url }           → open a URL in the default browser
  "search_web", // { query }        → google search
  "play_youtube", // { query }      → youtube app/search
  "notify", // { title, body }     → system notification
  "sys_info", // {}                → returns device info as the result
  "ping", // {}                    → returns "pong" (liveness test)
]);

const HEARTBEAT_MS = 25_000;
const POLL_MS = 3_000;
/** device counts as online on the website within this window */
const ONLINE_WINDOW_MS = 70_000;

/**
 * A runnable device-side client. Registers, heartbeats, polls and executes
 * commands via the supplied executors (platform-specific). Used by the test
 * harness and available to any Node-based runtime.
 */
class DeviceClient {
  /**
   * @param {object} opts
   * @param {string} opts.serverUrl        brain base URL (e.g. https://archer.example)
   * @param {string} opts.deviceId         stable unique id
   * @param {string} opts.name             human name ("My PC")
   * @param {string} opts.platform         windows | android | web
   * @param {string} [opts.version]
   * @param {object} opts.executors        async { openApp(p), openUrl(p), notify(p), sysInfo(p) }
   * @param {{log?:Function}} [opts.logger]
   */
  constructor(opts) {
    if (!opts || !opts.serverUrl || !opts.deviceId || !opts.executors) {
      throw new Error("serverUrl, deviceId and executors are required");
    }
    this.serverUrl = String(opts.serverUrl).replace(/\/$/, "");
    this.deviceId = opts.deviceId;
    this.name = opts.name || "Unknown device";
    this.platform = opts.platform || "web";
    this.version = opts.version || "1.0.0";
    this.executors = opts.executors;
    this.log = (opts.logger && opts.logger.log) || (() => {});
    this.seen = new Set();
    this.timers = [];
    this.stopped = false;
  }

  async #post(path, body) {
    const res = await fetch(this.serverUrl + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
    return res.json();
  }

  async register() {
    const out = await this.#post(ENDPOINTS.register, {
      deviceId: this.deviceId,
      name: this.name,
      platform: this.platform,
      version: this.version,
    });
    this.log(`registered — ${out.pending ?? 0} pending command(s)`);
    return out;
  }

  async poll() {
    const res = await fetch(
      `${this.serverUrl}${ENDPOINTS.commands}?deviceId=${encodeURIComponent(this.deviceId)}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status} while polling`);
    const data = await res.json();
    for (const cmd of data.commands || []) {
      if (this.seen.has(cmd.id)) continue;
      this.seen.add(cmd.id);
      this.execute(cmd);
    }
  }

  async execute(cmd) {
    const p = cmd.payload || {};
    this.log(`executing ${cmd.action} ${JSON.stringify(p).slice(0, 120)}`);
    try {
      let result;
      switch (cmd.action) {
        case "ping":
          result = "pong";
          break;
        case "open_app":
          result = await this.executors.openApp(p);
          break;
        case "open_url":
          result = await this.executors.openUrl(p);
          break;
        case "search_web":
          result = await this.executors.openUrl({
            url: "https://www.google.com/search?q=" + encodeURIComponent(p.query || ""),
          });
          break;
        case "play_youtube":
          result = await this.executors.openApp({ name: "youtube", query: p.query || "" });
          break;
        case "notify":
          result = await this.executors.notify(p);
          break;
        case "sys_info":
          result = await this.executors.sysInfo(p);
          break;
        default:
          throw new Error(`unknown action: ${cmd.action}`);
      }
      const text =
        result && typeof result === "object" ? JSON.stringify(result).slice(0, 480) : String(result ?? "ok");
      await this.#post(ENDPOINTS.ack, { commandId: cmd.id, status: "done", result: text });
      this.log(`done → ${text.slice(0, 80)}`);
    } catch (err) {
      await this.#post(ENDPOINTS.ack, { commandId: cmd.id, status: "failed", result: err.message });
      this.log(`failed → ${err.message}`);
    }
  }

  start() {
    this.stopped = false;
    const tick = () => {
      if (this.stopped) return;
      this.register()
        .then(() => this.poll())
        .catch((e) => this.log(`sync error: ${e.message}`));
    };
    tick();
    this.timers.push(setInterval(tick, POLL_MS));
    this.timers.push(setInterval(() => this.register().catch(() => {}), HEARTBEAT_MS));
  }

  stop() {
    this.stopped = true;
    this.timers.forEach(clearInterval);
    this.timers = [];
  }
}

module.exports = { ENDPOINTS, ACTIONS, HEARTBEAT_MS, POLL_MS, ONLINE_WINDOW_MS, DeviceClient };
