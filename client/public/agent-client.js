/*
 * ARCHER AI — Universal Device Agent
 * ----------------------------------
 * This script ships inside the ARCHER website. It only activates when the
 * site is running inside an installed ARCHER app (Electron on Windows or
 * Capacitor on Android). A plain browser tab never registers anything.
 *
 * What it does:
 *   1. Registers this device with the ARCHER brain (the website API)
 *   2. Sends a heartbeat every 25s so the website shows it as ONLINE
 *   3. Polls for commands (open youtube, notify, sys info ...) every 3s
 *   4. Executes them through the platform bridge and reports the result
 *
 * Bridges:
 *   Electron (preload):  window.archerBridge  { platform, deviceInfo, openApp, openUrl, notify, sysInfo }
 *   Android (Capacitor): window.Capacitor.Plugins.ArcherBridge { deviceInfo, openApp, openUrl, notify, sysInfo }
 */
(function () {
  "use strict";
  if (window.__ARCHER_AGENT__) return;
  window.__ARCHER_AGENT__ = true;

  // ---- 1. locate the platform bridge -------------------------------------
  var api = null;
  var platform = "web";

  if (window.archerBridge && typeof window.archerBridge.openUrl === "function") {
    api = window.archerBridge; // Electron preload bridge
    platform = "windows";
  } else if (
    window.Capacitor &&
    window.Capacitor.Plugins &&
    window.Capacitor.Plugins.ArcherBridge &&
    typeof window.Capacitor.Plugins.ArcherBridge.openUrl === "function"
  ) {
    api = window.Capacitor.Plugins.ArcherBridge; // Android Capacitor bridge
    platform = "android";
  }
  if (!api) return; // plain browser — nothing to do

  // Capacitor plugin methods are promise-like but need .call() style safety
  function callBridge(method, args) {
    try {
      var fn = api[method];
      if (typeof fn !== "function") return Promise.reject(new Error("bridge." + method + " missing"));
      var res = fn.call(api, args || {});
      return Promise.resolve(res);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  // ---- 2. device identity --------------------------------------------------
  var LS_ID = "archer.deviceId";
  var LS_SEEN = "archer.seenCmds";

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "dev-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function loadSeen() {
    try {
      return JSON.parse(localStorage.getItem(LS_SEEN) || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveSeen(arr) {
    try {
      localStorage.setItem(LS_SEEN, JSON.stringify(arr.slice(-200)));
    } catch (e) {
      /* private mode — ignore */
    }
  }

  var seen = {};
  loadSeen().forEach(function (id) {
    seen[id] = true;
  });

  var deviceId = null;
  var deviceName = platform === "windows" ? "Windows PC" : "Android Device";
  var appVersion = "1.0.0";

  callBridge("deviceInfo")
    .then(function (info) {
      info = info && (info.value || info); // Capacitor wraps plugin results in {value}
      deviceId = (info && info.deviceId) || localStorage.getItem(LS_ID) || uuid();
      deviceName = (info && info.name) || deviceName;
      platform = (info && info.platform) || platform;
      appVersion = (info && info.version) || appVersion;
      try {
        localStorage.setItem(LS_ID, deviceId);
      } catch (e) {
        /* ignore */
      }
      start();
    })
    .catch(function () {
      try {
        deviceId = localStorage.getItem(LS_ID) || uuid();
        localStorage.setItem(LS_ID, deviceId);
      } catch (e) {
        deviceId = uuid();
      }
      start();
    });

  // ---- 3. brain connection -------------------------------------------------
  var SERVER = window.location.origin;
  var registered = false;

  function post(path, body) {
    return fetch(SERVER + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function register() {
    return post("/api/devices", {
      deviceId: deviceId,
      name: deviceName,
      platform: platform,
      version: appVersion,
    })
      .then(function () {
        registered = true;
      })
      .catch(function () {
        /* retry on next tick */
      });
  }

  function poll() {
    return fetch(SERVER + "/api/commands?deviceId=" + encodeURIComponent(deviceId))
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        (data.commands || []).forEach(function (cmd) {
          if (seen[cmd.id]) return; // dedupe across reloads
          seen[cmd.id] = true;
          saveSeen(Object.keys(seen));
          execute(cmd);
        });
      })
      .catch(function () {
        /* offline — try again next tick */
      });
  }

  function ack(commandId, status, result) {
    return post("/api/commands/ack", { commandId: commandId, status: status, result: result || "" }).catch(
      function () {
        /* ignore */
      }
    );
  }

  // ---- 4. command execution -------------------------------------------------
  function openYouTubeSearch(query) {
    var url = query
      ? "https://www.youtube.com/results?search_query=" + encodeURIComponent(query)
      : "https://www.youtube.com";
    return callBridge("openUrl", { url: url });
  }

  function execute(cmd) {
    var p = cmd.payload || {};
    var work;

    switch (cmd.action) {
      case "ping":
        work = Promise.resolve("pong");
        break;
      case "open_app":
        work = callBridge("openApp", { name: p.name || p.target || "", query: p.query || "" });
        break;
      case "open_url":
        work = callBridge("openUrl", { url: p.url || "https://www.google.com" });
        break;
      case "search_web":
        work = callBridge("openUrl", {
          url: "https://www.google.com/search?q=" + encodeURIComponent(p.query || ""),
        });
        break;
      case "play_youtube":
        work =
          cmd.action === "play_youtube" && platform === "android"
            ? callBridge("openApp", { name: "youtube", query: p.query || "" }).catch(function () {
                return openYouTubeSearch(p.query);
              })
            : openYouTubeSearch(p.query);
        break;
      case "notify":
        work = callBridge("notify", { title: p.title || "ARCHER AI", body: p.body || "" });
        break;
      case "sys_info":
        work = callBridge("sysInfo", {});
        break;
      default:
        work = Promise.reject(new Error("unknown action " + cmd.action));
    }

    work
      .then(function (result) {
        var out = result && (result.value || result);
        var text =
          out && typeof out === "object"
            ? JSON.stringify(out).slice(0, 480)
            : String(out == null ? "ok" : out).slice(0, 480);
        ack(cmd.id, "done", text);
      })
      .catch(function (err) {
        ack(cmd.id, "failed", (err && err.message) || "failed");
      });
  }

  // ---- 5. loops --------------------------------------------------------------
  var HEARTBEAT_MS = 25_000;
  var POLL_MS = 3_000;

  function start() {
    register().then(function () {
      poll(); // fast first poll
      setInterval(function () {
        if (registered) poll();
        else register();
      }, POLL_MS);
      setInterval(register, HEARTBEAT_MS);
      // re-register when the app comes back to the foreground
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") register();
      });
    });
    // eslint-disable-next-line no-console
    console.info("[ARCHER agent] linked device ready —", deviceName, "(" + deviceId + ")");
  }

  // debug handle
  window.ARCHER_AGENT = {
    get id() {
      return deviceId;
    },
    get platform() {
      return platform;
    },
  };
})();
