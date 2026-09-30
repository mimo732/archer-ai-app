"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MonitorSmartphone,
  Laptop,
  Smartphone,
  Youtube,
  Bell,
  Send,
  Target,
  Unlink,
  RefreshCw,
} from "lucide-react";

interface DeviceRow {
  id: string;
  name: string;
  platform: string;
  version: string;
  lastSeen: string;
  online: boolean;
}

interface DeviceSyncSectionProps {
  /** currently active command target ("" = this browser/tab only) */
  deviceTarget: string;
  onSetTarget: (id: string, name: string) => void;
}

/**
 * LINKED SYSTEMS — live view of every device running the installed ARCHER
 * apps, with one-tap commands. Polls /api/devices every 5s while mounted.
 */
export default function DeviceSyncSection({ deviceTarget, onSetTarget }: DeviceSyncSectionProps) {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [flash, setFlash] = useState<string>("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/devices", { cache: "no-store" });
      const data = await res.json();
      setDevices(data.devices ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 5000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  const send = async (deviceId: string, action: string, payload: Record<string, unknown>, label: string) => {
    try {
      await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, action, payload }),
      });
      setFlash(`${label} → ${devices.find((d) => d.id === deviceId)?.name ?? deviceId}`);
      setTimeout(() => setFlash(""), 2500);
    } catch {
      /* ignore */
    }
  };

  const unlink = async (deviceId: string) => {
    await fetch(`/api/devices?deviceId=${encodeURIComponent(deviceId)}`, { method: "DELETE" }).catch(() => {});
    load();
  };

  const iconFor = (platform: string) =>
    platform === "android" ? Smartphone : platform === "windows" ? Laptop : MonitorSmartphone;

  return (
    <div className="rounded-lg border border-violet-400/25 bg-violet-400/5 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-violet-300/90 archer-font">
          <MonitorSmartphone className="w-3.5 h-3.5" /> Linked Systems
        </div>
        <button
          onClick={load}
          className="text-violet-300/60 hover:text-violet-200 transition-colors"
          aria-label="Refresh device list"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {!loaded ? (
        <p className="text-[11px] text-white/35">Scanning for linked systems…</p>
      ) : devices.length === 0 ? (
        <p className="text-[11px] text-white/45 leading-relaxed">
          No devices linked yet. Install the ARCHER app on your PC or phone (download buttons below) —
          it will appear here automatically, and you can control it from this website.
        </p>
      ) : (
        <div className="space-y-2.5">
          {devices.map((d) => {
            const Icon = iconFor(d.platform);
            const isTarget = deviceTarget === d.id;
            return (
              <div
                key={d.id}
                className={`rounded-lg border p-2.5 transition-colors ${
                  isTarget ? "border-violet-400/60 bg-violet-400/10" : "border-white/10 bg-black/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-violet-200/90 shrink-0" />
                  <span className="text-sm text-white/90 truncate flex-1 min-w-0">{d.name}</span>
                  <span
                    className={`text-[9px] uppercase tracking-[0.15em] archer-font px-1.5 py-0.5 rounded border ${
                      d.online
                        ? "text-emerald-300 border-emerald-400/50 bg-emerald-400/10"
                        : "text-white/35 border-white/15"
                    }`}
                  >
                    {d.online ? "online" : "offline"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <button
                    onClick={() => send(d.id, "open_app", { name: "youtube" }, "YouTube")}
                    className="h-7 px-2.5 rounded-md flex items-center gap-1 text-[10px] border border-red-400/30 text-red-200/90 hover:bg-red-400/10 transition-colors"
                  >
                    <Youtube className="w-3 h-3" /> YouTube
                  </button>
                  <button
                    onClick={() =>
                      send(d.id, "notify", { title: "ARCHER AI", body: "Command link verified, Sir." }, "Notify")
                    }
                    className="h-7 px-2.5 rounded-md flex items-center gap-1 text-[10px] border border-amber-400/30 text-amber-200/90 hover:bg-amber-400/10 transition-colors"
                  >
                    <Bell className="w-3 h-3" /> Notify
                  </button>
                  <button
                    onClick={() => send(d.id, "ping", {}, "Ping")}
                    className="h-7 px-2.5 rounded-md flex items-center gap-1 text-[10px] border border-cyan-400/30 text-cyan-200/90 hover:bg-cyan-400/10 transition-colors"
                  >
                    <Send className="w-3 h-3" /> Ping
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={() => onSetTarget(isTarget ? "" : d.id, isTarget ? "" : d.name)}
                    title="Make this device the command target — “open youtube” in chat will run there"
                    className={`h-7 px-2.5 rounded-md flex items-center gap-1 text-[10px] border transition-colors ${
                      isTarget
                        ? "border-violet-400/70 bg-violet-400/20 text-violet-100"
                        : "border-white/15 text-white/50 hover:border-white/35"
                    }`}
                  >
                    <Target className="w-3 h-3" /> {isTarget ? "ACTIVE TARGET" : "Set Target"}
                  </button>
                  <button
                    onClick={() => unlink(d.id)}
                    title="Unlink this device"
                    className="h-7 w-7 rounded-md flex items-center justify-center border border-red-400/25 text-red-300/70 hover:bg-red-400/10 transition-colors"
                  >
                    <Unlink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-white/35 mt-2 leading-relaxed">
        {deviceTarget
          ? `Chat commands like “open youtube” now run on ${deviceTargetNameLabel(devices, deviceTarget)}.`
          : "Tip: tap “Set Target” on a device to run your chat commands there (e.g. “open youtube” on your PC)."}
      </p>
      {flash && <p className="text-[10px] text-violet-300 mt-1.5 archer-font uppercase tracking-widest">▸ {flash}</p>}
    </div>
  );
}

function deviceTargetNameLabel(devices: DeviceRow[], id: string): string {
  const d = devices.find((x) => x.id === id);
  return d ? d.name : "the linked device";
}
