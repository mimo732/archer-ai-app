"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Newspaper, RefreshCw, ExternalLink } from "lucide-react";
import HUDPanel from "./HUDPanel";

interface Headline {
  id: string;
  title: string;
  source: string;
  url: string;
}

interface HeadlinesSectionProps {
  panelOpen: boolean;
  onPanelClose: () => void;
  refreshKey: number;
  onChanged?: () => void;
}

export default function HeadlinesSection({ panelOpen, onPanelClose, refreshKey, onChanged }: HeadlinesSectionProps) {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = async (force = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(force ? "/api/headlines?force=1" : "/api/headlines");
      const data = await res.json();
      setHeadlines(data.headlines ?? []);
      onChanged?.();
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/headlines");
        const data = await res.json();
        if (!cancelled) {
          setHeadlines(data.headlines ?? []);
          onChanged?.();
        }
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <>
      <div className="min-w-0">
        <button
          onClick={() => reload(true)}
          className="flex items-center gap-1.5 group"
          aria-label="Refresh headlines"
        >
          <span className="archer-font text-[11px] sm:text-xs font-bold tracking-wide text-white uppercase">
            Today Headlines
          </span>
          {loading ? (
            <RefreshCw className="w-3.5 h-3.5 text-cyan-300 animate-spin" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-cyan-300/80 group-hover:text-cyan-200 transition-colors" />
          )}
        </button>
        <div className="mt-2 space-y-1.5">
          {headlines.length === 0 ? (
            <p className="text-[11px] text-white/35">No headlines yet</p>
          ) : (
            headlines.slice(0, 2).map((h) => (
              <a
                key={h.id}
                href={h.url}
                target="_blank"
                rel="noreferrer"
                className="block text-[11px] text-white/60 hover:text-cyan-200 transition-colors leading-snug line-clamp-2"
              >
                • {h.title}
              </a>
            ))
          )}
        </div>
      </div>

      <HUDPanel open={panelOpen} onClose={onPanelClose} title="News Uplink" accent="#67e8f9">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-white/50">Live headlines from around the world.</p>
          <button
            onClick={() => reload(true)}
            className="flex items-center gap-1.5 text-xs text-cyan-300/90 hover:text-cyan-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
        {headlines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Newspaper className="w-10 h-10 text-cyan-400/40 mb-3" />
            <p className="text-sm text-white/40">No headlines yet, Sir.</p>
            <p className="text-xs text-white/25 mt-1">Say &quot;news&quot; or tap refresh.</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {headlines.map((h, i) => (
              <li key={h.id}>
                <a
                  href={h.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex gap-3 rounded-lg px-3 py-2.5 border border-cyan-400/15 bg-cyan-400/5 hover:border-cyan-400/40 transition-colors"
                >
                  <span className="archer-font text-[10px] text-cyan-300/70 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-white/90 leading-snug">{h.title}</span>
                    <span className="mt-1 flex items-center gap-1 text-[10px] text-cyan-300/60 uppercase tracking-wider">
                      <ExternalLink className="w-3 h-3" /> {h.source}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </HUDPanel>
    </>
  );
}
