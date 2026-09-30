/**
 * ARCHER server core — offline smoke test (no brain needed).
 * Verifies the Windows executors' logic and the protocol exports.
 */
const assert = require("assert");
const core = require("../src");

assert(Array.isArray(core.ACTIONS) && core.ACTIONS.includes("open_app"), "ACTIONS exported");
assert(typeof core.DeviceClient === "function", "DeviceClient exported");
assert(core.HEARTBEAT_MS === 25_000 && core.POLL_MS === 3_000, "timing constants");

const win = core.executors.windows;
assert(win.resolveApp("notepad") === "notepad.exe", "notepad resolves");
assert(win.resolveApp("calculator") === "calc.exe", "calculator resolves");
assert(win.resolveApp("example.com") === "https://example.com", "domain falls back to https");
assert(win.resolveApp("###nope###") === null, "unknown app → null");
assert(typeof win.sysInfo === "function" && typeof win.notify === "function", "executors present");

// DeviceClient constructor guard
let threw = false;
try {
  new DeviceClient({ serverUrl: "http://x" });
} catch {
  threw = true;
}
assert(threw, "DeviceClient validates options");

console.log("archer-server smoke test: ALL OK");
