"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface HUDPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  accent?: string; // glow color
  children: ReactNode;
}

export default function HUDPanel({ open, onClose, title, accent = "#22d3ee", children }: HUDPanelProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center archer-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md max-h-[82vh] sm:max-h-[80vh] flex flex-col rounded-t-2xl sm:rounded-2xl archer-slide-up"
        style={{
          background: "linear-gradient(160deg, rgba(8,14,10,0.97), rgba(4,8,5,0.98))",
          border: `1px solid ${accent}55`,
          boxShadow: `0 0 30px ${accent}33, inset 0 0 40px rgba(0,0,0,0.6)`,
        }}
      >
        {/* corner ticks */}
        <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 rounded-tl-2xl" style={{ borderColor: accent }} />
        <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 rounded-tr-2xl" style={{ borderColor: accent }} />
        <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 rounded-bl-2xl" style={{ borderColor: accent }} />
        <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 rounded-br-2xl" style={{ borderColor: accent }} />

        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b" style={{ borderColor: `${accent}22` }}>
          <h2
            className="archer-font text-sm tracking-[0.3em] uppercase"
            style={{ color: accent, textShadow: `0 0 12px ${accent}88` }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white transition-colors"
            style={{ border: `1px solid ${accent}44` }}
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto archer-scroll px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
