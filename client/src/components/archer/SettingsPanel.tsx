"use client";

import { useEffect, useState } from "react";
import { Settings2, User, Volume2, Repeat, Gauge, Languages, Trash2, AudioLines, Download, Mic } from "lucide-react";
import HUDPanel from "./HUDPanel";
import DeviceSyncSection from "./DeviceSyncSection";
import DownloadAppsSection from "./DownloadAppsSection";

export interface ArcherSettings {
  soul: string;
  userName: string;
  voiceEnabled: string;
  autoListen: string;
  speechRate: string;
  voiceGender: string;
  language?: string;
  volume?: string;
  /** explicit TTS voice picked in Settings (empty = auto, best quality) */
  voiceName?: string;
  /** GitHub "owner/repo" that publishes the auto-built .exe/.apk releases */
  githubRepo?: string;
  /** active command target device ("" = this browser only, "all" = every online device) */
  deviceTarget?: string;
  deviceTargetName?: string;
}

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  settings: ArcherSettings;
  onSaved: (s: ArcherSettings) => void;
  onTestVoice?: () => void;
  installAvailable?: boolean;
  isIOSDevice?: boolean;
  onInstall?: () => void;
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-12 h-7 rounded-full relative transition-colors border ${
        on ? "bg-emerald-400/25 border-emerald-400/60" : "bg-white/5 border-white/20"
      }`}
      role="switch"
      aria-checked={on}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${
          on ? "left-6 bg-emerald-300 shadow-[0_0_8px_#6ee7b7]" : "left-0.5 bg-white/40"
        }`}
      />
    </button>
  );
}

export default function SettingsPanel({
  open,
  onClose,
  settings,
  onSaved,
  onTestVoice,
  installAvailable = false,
  isIOSDevice = false,
  onInstall,
}: SettingsPanelProps) {
  const [local, setLocal] = useState<ArcherSettings>(settings);
  const [busy, setBusy] = useState(false);
  const [wiped, setWiped] = useState(false);
  const [voices, setVoices] = useState<{ name: string; lang: string }[]>([]);

  // live voice list (engines load async — voiceschanged may fire late)
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () =>
      setVoices(
        window.speechSynthesis
          .getVoices()
          .map((v) => ({ name: v.name, lang: v.lang }))
          .sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name))
      );
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", load);
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(local),
      });
      onSaved(local);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const clearMemory = async () => {
    await fetch("/api/memory?id=all", { method: "DELETE" }).catch(() => {});
    setWiped(true);
    setTimeout(() => setWiped(false), 2000);
  };

  return (
    <HUDPanel open={open} onClose={onClose} title="Systems Config" accent="#4ade80">
      <div className="space-y-5">
        {/* user name */}
        <div>
          <label className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-emerald-300/90 archer-font mb-2">
            <User className="w-3.5 h-3.5" /> Your Name
          </label>
          <input
            value={local.userName}
            onChange={(e) => setLocal({ ...local, userName: e.target.value })}
            placeholder="e.g. Archer"
            className="w-full bg-black/50 rounded-lg px-3 py-2.5 text-sm text-emerald-50 placeholder:text-white/25 outline-none border border-emerald-400/25 focus:border-emerald-400/60 transition-colors"
          />
        </div>

        {/* voice enabled */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-white/80">
            <Volume2 className="w-4 h-4 text-emerald-300/80" /> Voice Replies
          </span>
          <Toggle on={local.voiceEnabled !== "false"} onChange={(v) => setLocal({ ...local, voiceEnabled: String(v) })} />
        </div>

        {/* auto listen */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-white/80">
            <Repeat className="w-4 h-4 text-emerald-300/80" /> Continuous Conversation
          </span>
          <Toggle on={local.autoListen !== "false"} onChange={(v) => setLocal({ ...local, autoListen: String(v) })} />
        </div>

        {/* output volume (system config) — max 100%, default 50% */}
        <div>
          <label className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-emerald-300/90 archer-font mb-2">
            <Volume2 className="w-3.5 h-3.5" /> Output Volume — {Math.round(Number(local.volume) || 50)}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={Number(local.volume) || 50}
            onChange={(e) => setLocal({ ...local, volume: e.target.value })}
            className="w-full accent-emerald-400"
            aria-label="Output volume percentage"
          />
          <div className="flex justify-between text-[10px] text-white/30 mt-1">
            <span>0%</span>
            <span>DEFAULT 50%</span>
            <span>100%</span>
          </div>
          {onTestVoice && (
            <button
              onClick={onTestVoice}
              className="mt-2.5 h-9 px-4 rounded-lg flex items-center gap-2 border border-emerald-400/40 bg-emerald-400/10 hover:bg-emerald-400/20 transition-colors text-[11px] uppercase tracking-[0.2em] archer-font text-emerald-200"
            >
              <AudioLines className="w-3.5 h-3.5" /> Test Voice
            </button>
          )}
        </div>

        {/* speech rate */}
        <div>
          <label className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-emerald-300/90 archer-font mb-2">
            <Gauge className="w-3.5 h-3.5" /> Speech Rate — {(Number(local.speechRate) || 1).toFixed(1)}x
          </label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={Number(local.speechRate) || 1}
            onChange={(e) => setLocal({ ...local, speechRate: e.target.value })}
            className="w-full accent-emerald-400"
          />
        </div>

        {/* voice gender */}
        <div>
          <label className="block text-xs tracking-[0.2em] uppercase text-emerald-300/90 archer-font mb-2">Voice Style</label>
          <div className="grid grid-cols-2 gap-2">
            {["male", "female"].map((g) => (
              <button
                key={g}
                onClick={() => setLocal({ ...local, voiceGender: g })}
                className={`h-10 rounded-lg text-xs uppercase tracking-widest archer-font border transition-all ${
                  (local.voiceGender || "male") === g
                    ? "border-emerald-400/70 bg-emerald-400/20 text-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.25)]"
                    : "border-white/15 bg-white/5 text-white/50 hover:border-white/30"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* voice engine — explicit voice pick for maximum clarity */}
        <div>
          <label className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-emerald-300/90 archer-font mb-2">
            <Mic className="w-3.5 h-3.5" /> Voice Engine
          </label>
          <select
            value={local.voiceName || ""}
            onChange={(e) => setLocal({ ...local, voiceName: e.target.value })}
            className="w-full h-11 bg-black/50 rounded-lg px-3 text-sm text-emerald-50 outline-none border border-emerald-400/25 focus:border-emerald-400/60 transition-colors"
            aria-label="Speech synthesis voice"
          >
            <option value="">AUTO — Best quality (recommended)</option>
            {voices.map((v) => (
              <option key={`${v.lang}-${v.name}`} value={v.name}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
          <p className="text-[10px] text-white/35 mt-1.5 leading-relaxed">
            AUTO picks the clearest voice for Bangla &amp; English (Google/network voices first).
            If speech still sounds unclear, try a “Google” voice here.
          </p>
        </div>

        {/* language */}
        <div>
          <label className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-emerald-300/90 archer-font mb-2">
            <Languages className="w-3.5 h-3.5" /> Recognition Language
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { code: "en-US", label: "English" },
              { code: "bn-BD", label: "বাংলা" },
              { code: "hi-IN", label: "हिन्दी" },
            ].map((l) => (
              <button
                key={l.code}
                onClick={() => setLocal({ ...local, language: l.code })}
                className={`h-10 rounded-lg text-xs border transition-all ${
                  (local.language || "en-US") === l.code
                    ? "border-emerald-400/70 bg-emerald-400/20 text-emerald-200"
                    : "border-white/15 bg-white/5 text-white/50 hover:border-white/30"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* install as system app */}
        <div className="rounded-lg border border-cyan-400/25 bg-cyan-400/5 p-3">
          <div className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-cyan-300/90 archer-font mb-1.5">
            <Download className="w-3.5 h-3.5" /> Install as System App
          </div>
          {installAvailable ? (
            <button
              onClick={onInstall}
              className="w-full h-10 rounded-lg border border-cyan-400/50 bg-cyan-400/15 hover:bg-cyan-400/25 transition-colors text-[11px] uppercase tracking-[0.2em] archer-font text-cyan-100"
            >
              Install ARCHER on this device
            </button>
          ) : isIOSDevice ? (
            <p className="text-[11px] text-cyan-100/70 leading-relaxed">
              On iPhone/iPad: tap the <b>Share</b> button in Safari, then choose
              <b> “Add to Home Screen”</b> — ARCHER will launch fullscreen like a real system app.
            </p>
          ) : (
            <p className="text-[11px] text-cyan-100/60 leading-relaxed">
              Open the browser menu (⋮) and tap <b>“Add to Home screen” / “Install app”</b> to run
              ARCHER fullscreen without the browser bar.
            </p>
          )}
          <p className="text-[10px] text-white/30 mt-1.5">
            Saying “open youtube” etc. now launches the real app via deep link (Android/iOS) and only
            falls back to the browser if the app is not installed.
          </p>
        </div>

        {/* linked systems — devices running the installed ARCHER apps */}
        <DeviceSyncSection
          deviceTarget={local.deviceTarget || ""}
          onSetTarget={(id, name) => {
            const next = { ...local, deviceTarget: id, deviceTargetName: name };
            setLocal(next);
            // persist immediately — this is a routing switch, not a form field
            fetch("/api/settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ deviceTarget: id, deviceTargetName: name }),
            }).catch(() => {});
            onSaved(next);
          }}
        />

        {/* download the native apps (auto-built on GitHub Actions) */}
        <DownloadAppsSection
          githubRepo={local.githubRepo || ""}
          onRepoChange={(v) => setLocal({ ...local, githubRepo: v })}
        />

        {/* danger zone */}
        <button
          onClick={clearMemory}
          className="w-full h-11 rounded-lg flex items-center justify-center gap-2 border border-red-400/30 text-red-300/90 hover:bg-red-400/10 transition-colors text-sm"
        >
          <Trash2 className="w-4 h-4" /> {wiped ? "Memories Wiped" : "Wipe All Memories"}
        </button>

        {/* save */}
        <button
          onClick={save}
          disabled={busy}
          className="w-full h-12 rounded-lg flex items-center justify-center gap-2 archer-font text-xs tracking-[0.3em] uppercase text-black bg-emerald-400 hover:bg-emerald-300 transition-colors disabled:opacity-40 shadow-[0_0_20px_rgba(52,211,153,0.35)]"
        >
          <Settings2 className="w-4 h-4" />
          {busy ? "Applying..." : "Save Configuration"}
        </button>
      </div>
    </HUDPanel>
  );
}
