"use client";

import { useState } from "react";
import { Heart, Save } from "lucide-react";
import HUDPanel from "./HUDPanel";

const PRESETS = [
  {
    name: "JARVIS Classic",
    soul: "loyal, witty, calm, slightly formal like JARVIS from Iron Man. Clever and resourceful, always calls the user respectfully 'Sir'.",
  },
  {
    name: "Battle Mode",
    soul: "tactical, sharp, fast, military-precision assistant. Direct orders style, minimal words, maximum efficiency, calls the user 'Commander'.",
  },
  {
    name: "Friendly Buddy",
    soul: "super friendly, casual, funny, uses light humour and emojis-in-speech. Talks like a close tech-savvy friend.",
  },
  {
    name: "Banglish Mode",
    soul: "talks in natural Banglish (Bengali written with English letters), friendly and funny like a Bangladeshi friend, still calls user 'Sir' sometimes.",
  },
];

interface SoulPanelProps {
  open: boolean;
  onClose: () => void;
  initialSoul?: string;
  onSaved?: () => void;
}

export default function SoulPanel({ open, onClose, initialSoul, onSaved }: SoulPanelProps) {
  const [soul, setSoul] = useState(initialSoul ?? "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async (value?: string) => {
    setBusy(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soul: value ?? soul }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onSaved?.();
      if (value !== undefined) setSoul(value);
    } finally {
      setBusy(false);
    }
  };

  return (
    <HUDPanel open={open} onClose={onClose} title="Soul Config" accent="#e2e8f0">
      <p className="text-xs text-white/50 mb-3 leading-relaxed">
        The soul defines ARCHER AI&apos;s personality — how it thinks, talks and treats you.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => save(p.soul)}
            disabled={busy}
            className="rounded-lg px-3 py-2.5 text-left border border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/30 transition-all disabled:opacity-40"
          >
            <span className="block text-xs font-semibold text-white/90 archer-font tracking-wider">{p.name}</span>
            <span className="block text-[10px] text-white/40 mt-0.5 leading-snug line-clamp-2">{p.soul.slice(0, 60)}...</span>
          </button>
        ))}
      </div>

      <textarea
        value={soul}
        onChange={(e) => setSoul(e.target.value)}
        rows={4}
        placeholder="Describe the personality..."
        className="w-full bg-black/50 rounded-lg px-3 py-2.5 text-sm text-white/90 placeholder:text-white/25 outline-none border border-white/20 focus:border-white/50 transition-colors resize-none"
      />

      <button
        onClick={() => save()}
        disabled={busy || !soul.trim()}
        className="mt-3 w-full h-11 rounded-lg flex items-center justify-center gap-2 border border-white/25 bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-40 archer-font text-xs tracking-[0.25em] uppercase text-white"
      >
        <Save className="w-4 h-4" />
        {saved ? "Soul Updated" : busy ? "Saving..." : "Update Soul"}
      </button>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-white/35">
        <Heart className="w-3 h-3 text-emerald-300" />
        Current soul is injected into every conversation automatically.
      </div>
    </HUDPanel>
  );
}
