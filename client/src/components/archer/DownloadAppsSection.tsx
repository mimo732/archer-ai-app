"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MonitorDown, Smartphone, Github, DownloadCloud, CheckCircle2, Loader2 } from "lucide-react";

interface DownloadAppsSectionProps {
  /** GitHub repo in "owner/repo" form — optional CI fallback via build-release.yml */
  githubRepo: string;
  onRepoChange: (value: string) => void;
}

interface TargetStatus {
  available: boolean;
  source: "local" | "github" | null;
  name: string;
  sizeBytes: number | null;
}

interface AppsStatus {
  windows: TargetStatus;
  android: TargetStatus;
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

/**
 * GET THE ARCHER APPS — one-tap DIRECT download.
 * The /api/apps/download route streams the real installer/app from this very
 * website (local build first, GitHub-Actions artifact proxied as fallback) —
 * the user NEVER gets bounced to github.com.
 */
export default function DownloadAppsSection({ githubRepo, onRepoChange }: DownloadAppsSectionProps) {
  const [status, setStatus] = useState<AppsStatus | null>(null);
  const [busy, setBusy] = useState<"windows" | "android" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const repo = githubRepo.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/, "");
  const releasesPage = repo ? `https://github.com/${repo}/releases` : "";

  const refresh = useCallback(() => {
    fetch("/api/apps/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: AppsStatus) => setStatus(j))
      .catch(() => {
        /* keep last known status */
      });
  }, []);

  useEffect(() => {
    refresh();
    pollRef.current = window.setInterval(refresh, 30000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const download = (target: "windows" | "android") => {
    setBusy(target);
    setNotice(null);
    try {
      // same-origin attachment → browser downloads the file, page stays put
      const a = document.createElement("a");
      a.href = `/api/apps/download?target=${target}`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // refresh status shortly after in case a CI artifact just appeared
      window.setTimeout(refresh, 4000);
    } finally {
      window.setTimeout(() => setBusy(null), 2500);
    }
  };

  const go = (target: "windows" | "android") => {
    const st = status?.[target];
    if (st?.available) {
      download(target);
    } else {
      setNotice(
        target === "windows"
          ? "Windows build is not ready yet — it is produced automatically. See the note below."
          : "Android build is not ready yet — it is produced automatically. See the note below."
      );
    }
  };

  const btn = (target: "windows" | "android") => {
    const st = status?.[target];
    const ready = !!st?.available;
    const isWin = target === "windows";
    const color = isWin ? "cyan" : "lime";
    return (
      <button
        onClick={() => go(target)}
        title={ready ? `Download ${st?.name} directly from this website` : "Build queued — produced automatically"}
        className={`h-14 rounded-lg flex flex-col items-center justify-center gap-0.5 border transition-colors ${
          ready
            ? isWin
              ? "border-cyan-400/60 bg-cyan-400/15 hover:bg-cyan-400/25"
              : "border-lime-400/60 bg-lime-400/15 hover:bg-lime-400/25"
            : "border-white/15 bg-white/5 hover:bg-white/10"
        }`}
      >
        <span
          className={`flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] archer-font ${
            ready ? (isWin ? "text-cyan-100" : "text-lime-100") : "text-white/50"
          }`}
        >
          {busy === target ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : ready ? (
            <DownloadCloud className="w-3.5 h-3.5" />
          ) : isWin ? (
            <MonitorDown className="w-3.5 h-3.5" />
          ) : (
            <Smartphone className="w-3.5 h-3.5" />
          )}
          {isWin ? "Windows" : "Android"}
        </span>
        {ready ? (
          <span className={`flex items-center gap-1 text-[9px] ${isWin ? "text-cyan-200/80" : "text-lime-200/80"}`}>
            <CheckCircle2 className="w-2.5 h-2.5" /> READY · {fmtSize(st?.sizeBytes ?? null)}
          </span>
        ) : (
          <span className="text-[9px] text-white/35">{busy === target ? "downloading…" : "build queued"}</span>
        )}
      </button>
    );
  };

  return (
    <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/5 p-3">
      <div className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-emerald-300/90 archer-font mb-1.5">
        <MonitorDown className="w-3.5 h-3.5" /> Get the ARCHER Apps
      </div>
      <p className="text-[10px] text-white/40 mb-2.5 leading-relaxed">
        Same ARCHER brain on every device — the installed apps link back to this website automatically
        and appear under LINKED SYSTEMS.
      </p>

      <div className="grid grid-cols-2 gap-2">{btn("windows")}{btn("android")}</div>

      {notice && (
        <p className="text-[10px] text-amber-200/80 mt-2 leading-relaxed">
          {notice} Tip: on THIS device you can already install ARCHER as a home-screen app with the
          <b> Install App</b> button in SETTING (PWA).
        </p>
      )}

      <div className="mt-2.5">
        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] archer-font text-white/45 mb-1.5">
          <Github className="w-3 h-3" /> GitHub Repo — optional auto-build (owner/repo)
        </label>
        <input
          value={githubRepo}
          onChange={(e) => onRepoChange(e.target.value)}
          placeholder="e.g. yourname/archer-ai"
          className="w-full h-9 bg-black/50 rounded-lg px-3 text-xs text-emerald-50 placeholder:text-white/25 outline-none border border-emerald-400/25 focus:border-emerald-400/60 transition-colors"
          aria-label="GitHub repository for CI auto-builds"
        />
        <p className="text-[10px] text-white/35 mt-1.5 leading-relaxed">
          {repo ? (
            <>
              Pushing this project there triggers Actions (<b>build-release.yml</b>) to auto-build both
              apps; once published they appear above and download straight from here.{" "}
              <a
                href={releasesPage}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-300 underline decoration-emerald-400/40 inline-flex items-center gap-0.5"
              >
                releases <Github className="w-2.5 h-2.5 inline" />
              </a>
            </>
          ) : (
            <>
              Downloads above are served directly by this website. You can also connect a GitHub repo
              (see <b>README.md</b>) so Actions rebuild the .exe & .apk on every push — saved with
              “Save Configuration”.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
