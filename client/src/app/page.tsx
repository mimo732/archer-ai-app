"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  History,
  Square,
  Volume2,
  Mic,
  SendHorizonal,
  Cog,
  MemoryStick,
  MessageSquare,
  Heart,
  Settings2,
  ListTodo,
} from "lucide-react";
import ParticleOrb, { OrbState } from "@/components/archer/ParticleOrb";
import Wires from "@/components/archer/Wires";
import MemoryPanel from "@/components/archer/MemoryPanel";
import ChatPanel from "@/components/archer/ChatPanel";
import SoulPanel from "@/components/archer/SoulPanel";
import SettingsPanel, { ArcherSettings } from "@/components/archer/SettingsPanel";
import TasksCard from "@/components/archer/TasksCard";
import HeadlinesSection from "@/components/archer/HeadlinesSection";
import { useVoice } from "@/hooks/use-voice";

const DEFAULT_SETTINGS: ArcherSettings = {
  soul: "loyal, witty, calm, slightly formal like JARVIS from Iron Man.",
  userName: "",
  voiceEnabled: "true",
  autoListen: "true",
  speechRate: "1",
  voiceGender: "male",
  language: "en-US",
  volume: "50",
  voiceName: "",
  githubRepo: "",
  deviceTarget: "",
  deviceTargetName: "",
};

interface AppLink {
  web: string;
  /** Android intent:// URL — opens the native app, Chrome falls back to the web URL automatically when the app is missing */
  androidIntent?: string;
  /** iOS custom URL scheme — opens the native app when installed */
  iosScheme?: string;
}

/**
 * Native app deep links. A plain https:// URL can only ever open ANOTHER
 * BROWSER TAB — that is why ARCHER used to "always open the browser".
 * Android: intent:// with S.browser_fallback_url (Chrome-native fallback).
 * iOS: custom scheme first, web fallback after a short timeout.
 */
const APP_LINKS: Record<string, AppLink> = {
  youtube: {
    web: "https://www.youtube.com",
    androidIntent: `intent://www.youtube.com/#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${encodeURIComponent("https://www.youtube.com")};end`,
    iosScheme: "youtube://",
  },
  instagram: {
    web: "https://www.instagram.com",
    androidIntent: `intent://instagram.com/#Intent;scheme=https;package=com.instagram.android;S.browser_fallback_url=${encodeURIComponent("https://www.instagram.com")};end`,
    iosScheme: "instagram://app",
  },
  facebook: {
    web: "https://www.facebook.com",
    androidIntent: `intent://www.facebook.com/#Intent;scheme=https;package=com.facebook.katana;S.browser_fallback_url=${encodeURIComponent("https://www.facebook.com")};end`,
    iosScheme: "fb://",
  },
  whatsapp: {
    web: "https://web.whatsapp.com",
    androidIntent: `intent://send/#Intent;scheme=whatsapp;package=com.whatsapp;S.browser_fallback_url=${encodeURIComponent("https://web.whatsapp.com")};end`,
    iosScheme: "whatsapp://",
  },
  twitter: {
    web: "https://x.com",
    androidIntent: `intent://x.com/#Intent;scheme=https;package=com.twitter.android;S.browser_fallback_url=${encodeURIComponent("https://x.com")};end`,
    iosScheme: "twitter://",
  },
  x: {
    web: "https://x.com",
    androidIntent: `intent://x.com/#Intent;scheme=https;package=com.twitter.android;S.browser_fallback_url=${encodeURIComponent("https://x.com")};end`,
    iosScheme: "twitter://",
  },
  google: {
    web: "https://www.google.com",
    androidIntent: `intent://www.google.com/#Intent;scheme=https;package=com.google.android.googlequicksearchbox;S.browser_fallback_url=${encodeURIComponent("https://www.google.com")};end`,
    iosScheme: "google://",
  },
  maps: {
    web: "https://maps.google.com",
    androidIntent: `intent://maps.google.com/#Intent;scheme=https;package=com.google.android.apps.maps;S.browser_fallback_url=${encodeURIComponent("https://maps.google.com")};end`,
    iosScheme: "comgooglemaps://",
  },
  gmail: {
    web: "https://mail.google.com",
    androidIntent: `intent://mail.google.com/#Intent;scheme=https;package=com.google.android.gm;S.browser_fallback_url=${encodeURIComponent("https://mail.google.com")};end`,
    iosScheme: "googlegmail://",
  },
  spotify: {
    web: "https://open.spotify.com",
    androidIntent: `intent://open.spotify.com/#Intent;scheme=https;package=com.spotify.music;S.browser_fallback_url=${encodeURIComponent("https://open.spotify.com")};end`,
    iosScheme: "spotify://",
  },
  github: {
    web: "https://github.com",
    androidIntent: `intent://github.com/#Intent;scheme=https;package=com.github.android;S.browser_fallback_url=${encodeURIComponent("https://github.com")};end`,
    iosScheme: "github://",
  },
  chatgpt: {
    web: "https://chatgpt.com",
    androidIntent: `intent://chatgpt.com/#Intent;scheme=https;package=com.openai.chatgpt;S.browser_fallback_url=${encodeURIComponent("https://chatgpt.com")};end`,
    iosScheme: "chatgpt://",
  },
  tiktok: {
    web: "https://www.tiktok.com",
    androidIntent: `intent://www.tiktok.com/#Intent;scheme=https;package=com.zhiliaoapp.musically;S.browser_fallback_url=${encodeURIComponent("https://www.tiktok.com")};end`,
    iosScheme: "snssdk1233://",
  },
};

/** true on iPhone/iPad (also iPadOS 13+ masquerading as Mac) */
function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
}

/**
 * Open an app via native deep link when possible (Android intent:// /
 * iOS scheme), falling back to the web URL — inside a new tab ONLY when
 * we had to fall back to the web, so the native app is always preferred.
 */
function openAppLink(link: AppLink | undefined, webFallback?: string) {
  const web = webFallback ?? link?.web ?? "https://www.google.com";
  if (typeof window === "undefined") return;
  const ua = navigator.userAgent;
  const isAndroid = /android/i.test(ua);
  if (isAndroid && link?.androidIntent) {
    // top-level navigation — Chrome opens the app, or the fallback URL if not installed
    try {
      window.location.href = link.androidIntent;
      return;
    } catch {
      /* fall through to web */
    }
  }
  if (isIOSDevice() && link?.iosScheme) {
    try {
      window.location.href = link.iosScheme;
      // if the app did not take over (not installed) → open the web version in a new tab
      window.setTimeout(() => {
        try {
          window.open(web, "_blank", "noopener");
        } catch {
          /* noop */
        }
      }, 1500);
      return;
    } catch {
      /* fall through to web */
    }
  }
  try {
    window.open(web, "_blank", "noopener");
  } catch {
    /* noop */
  }
}

type AgentAction =
  | { type: "open_app"; target: string }
  | { type: "search_youtube"; query: string }
  | { type: "play_music"; query: string }
  | { type: "web_search"; query: string }
  | { type: "add_task"; title: string }
  | { type: "complete_task"; title: string }
  | { type: "save_memory"; content: string }
  | { type: "get_news" }
  | { type: "get_time" }
  | { type: "get_date" };

/**
 * Forward a command to the active linked device (Settings → Linked Systems →
 * “Set Target”). Returns a spoken confirmation, or null when no target is set
 * (the command then runs locally as before).
 */
async function sendToDevice(
  target: string,
  action: string,
  payload: Record<string, unknown>,
  humanLabel: string,
  deviceName: string
): Promise<string | null> {
  try {
    const body = target === "all" ? { target: "all", action, payload } : { deviceId: target, action, payload };
    const res = await fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return `I could not reach ${deviceName || "the linked device"}, Sir.`;
    return `${humanLabel} on ${deviceName || "your linked device"}, Sir.`;
  } catch {
    return "The command link seems to be down, Sir.";
  }
}

export default function ArcherAI() {
  const [settings, setSettings] = useState<ArcherSettings>(DEFAULT_SETTINGS);
  const [subtitle, setSubtitle] = useState("ARCHER AI online. All systems nominal.");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [memoryOpen, setMemoryOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [soulOpen, setSoulOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [headlinesOpen, setHeadlinesOpen] = useState(false);

  const wireContainerRef = useRef<HTMLDivElement | null>(null);
  const stoppedRef = useRef(false);
  const settingsRef = useRef(settings);
  const submitRef = useRef<(t: string) => void>(() => {});

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // ---- action executor ----
  const handleAction = useCallback(async (action: AgentAction | null): Promise<string | null> => {
    if (!action || !action.type) return null;
    // when a linked device is the active target, remote commands run there
    const t = settingsRef.current;
    const devTarget = t.deviceTarget || "";
    const devName = t.deviceTargetName || "";
    if (devTarget) {
      switch (action.type) {
        case "open_app":
          return await sendToDevice(devTarget, "open_app", { name: action.target }, `Opening ${action.target}`, devName);
        case "search_youtube":
          return await sendToDevice(devTarget, "play_youtube", { query: action.query }, `Searching YouTube for ${action.query}`, devName);
        case "play_music":
          return await sendToDevice(devTarget, "play_youtube", { query: action.query }, `Playing ${action.query}`, devName);
        case "web_search":
          return await sendToDevice(devTarget, "search_web", { query: action.query }, `Searching the web for ${action.query}`, devName);
        default:
          break; // local-only actions (tasks, memory, news…) still run here
      }
    }
    switch (action.type) {
      case "open_app": {
        const key = action.target?.toLowerCase().trim();
        if (key && APP_LINKS[key]) {
          openAppLink(APP_LINKS[key]);
        } else {
          // unknown app → web search for it (best possible reach from a web app)
          openAppLink(undefined, `https://www.google.com/search?q=${encodeURIComponent(action.target)}`);
        }
        return null;
      }
      case "search_youtube": {
        openAppLink(APP_LINKS.youtube, `https://www.youtube.com/results?search_query=${encodeURIComponent(action.query)}`);
        return null;
      }
      case "play_music": {
        openAppLink(APP_LINKS.youtube, `https://www.youtube.com/results?search_query=${encodeURIComponent(action.query)}`);
        return null;
      }
      case "web_search": {
        openAppLink(APP_LINKS.google, `https://www.google.com/search?q=${encodeURIComponent(action.query)}`);
        return null;
      }
      case "add_task": {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: action.title }),
        });
        setRefreshKey((k) => k + 1);
        return null;
      }
      case "complete_task": {
        try {
          const res = await fetch("/api/tasks");
          const data = await res.json();
          const match = (data.tasks as { id: string; title: string; done: boolean }[]).find(
            (t) => !t.done && t.title.toLowerCase().includes((action.title || "").toLowerCase().slice(0, 20))
          );
          if (match) {
            await fetch("/api/tasks", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: match.id, done: true }),
            });
            setRefreshKey((k) => k + 1);
          }
        } catch {
          /* noop */
        }
        return null;
      }
      case "save_memory": {
        await fetch("/api/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: action.content }),
        });
        return null;
      }
      case "get_news": {
        try {
          const res = await fetch("/api/headlines");
          const data = await res.json();
          const hs = (data.headlines ?? []) as { title: string }[];
          setRefreshKey((k) => k + 1);
          if (hs.length) {
            const brief = hs
              .slice(0, 3)
              .map((h, i) => `${i + 1}. ${h.title}`)
              .join(". ");
            return `Here are today's headlines, Sir. ${brief}`;
          }
          return "I could not find any headlines right now, Sir.";
        } catch {
          return "The news uplink seems to be down, Sir.";
        }
      }
      default:
        return null;
    }
  }, []);

  // ---- voice (defined before submit to avoid circular deps) ----
  const voice = useVoice({
    onFinalTranscript: (text) => submitRef.current(text),
    language: settings.language || "en-US",
    rate: Number(settings.speechRate) || 1,
    volume: (Number(settings.volume) || 50) / 100,
    voiceGender: (settings.voiceGender as "male" | "female") || "male",
    voiceName: settings.voiceName || "",
  });

  const {
    setState: voiceStateSetter,
    speak: speakFn,
    startListening: listenFn,
    stopListening: muteMic,
    primeVoice,
  } = voice;

  // fresh mirror of the voice state for use inside async callbacks
  const voiceStateRef = useRef(voice.state);
  useEffect(() => {
    voiceStateRef.current = voice.state;
  }, [voice.state]);

  // unlock TTS on the very first user gesture (required by iOS Safari & Android)
  useEffect(() => {
    const prime = () => primeVoice();
    const opts = { once: true } as AddEventListenerOptions;
    window.addEventListener("pointerdown", prime, opts);
    window.addEventListener("keydown", prime, opts);
    window.addEventListener("touchstart", prime, opts);
    window.addEventListener("touchend", prime, opts);
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
      window.removeEventListener("touchstart", prime);
      window.removeEventListener("touchend", prime);
    };
  }, [primeVoice]);

  // ---- local slash commands (typed with “/”) ----
  const runSlashCommand = useCallback(
    async (raw: string): Promise<boolean> => {
      const t = raw.trim();
      if (!t.startsWith("/")) return false;
      const [cmdRaw, ...rest] = t.slice(1).split(/\s+/);
      const cmd = (cmdRaw || "").toLowerCase();
      const arg = rest.join(" ").trim();
      const voiceOn = settingsRef.current.voiceEnabled !== "false";

      const finish = (msg: string) => {
        setSubtitle(msg);
        setBusy(false);
        if (voiceOn) {
          speakFn(msg, () => setBusy(false));
        } else {
          voiceStateSetter("idle");
        }
      };

      switch (cmd) {
        case "open": {
          const target = arg || "google";
          const link = APP_LINKS[target.toLowerCase()];
          openAppLink(link, link ? undefined : `https://www.google.com/search?q=${encodeURIComponent(target)}`);
          finish(`Opening ${target}, Sir.`);
          return true;
        }
        case "play": {
          if (!arg) {
            finish("Which song should I play, Sir?");
            return true;
          }
          openAppLink(
            APP_LINKS.youtube,
            `https://www.youtube.com/results?search_query=${encodeURIComponent(arg)}`
          );
          finish(`Playing ${arg} on YouTube, Sir.`);
          return true;
        }
        case "search": {
          if (!arg) {
            finish("What should I search, Sir?");
            return true;
          }
          openAppLink(
            APP_LINKS.google,
            `https://www.google.com/search?q=${encodeURIComponent(arg)}`
          );
          finish(`Searching the web for ${arg}, Sir.`);
          return true;
        }
        case "task": {
          if (!arg) {
            finish("What task should I add, Sir?");
            return true;
          }
          await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: arg }),
          }).catch(() => {});
          setRefreshKey((k) => k + 1);
          finish(`Task added, Sir: ${arg}`);
          return true;
        }
        case "news": {
          const brief = await handleAction({ type: "get_news" } as AgentAction);
          setRefreshKey((k) => k + 1);
          finish(brief ?? "The news uplink seems to be down, Sir.");
          return true;
        }
        case "help": {
          finish("Commands: /open app, /play song, /search topic, /task title, /news, /device, /help.");
          return true;
        }
        case "device": {
          // /device            → list linked systems
          // /device open <app> → run on the active target device
          // /device say <text> → push a notification to the target device
          const argLower = arg.toLowerCase().trim();
          if (!argLower || argLower === "list") {
            try {
              const res = await fetch("/api/devices");
              const data = await res.json();
              const list: { name: string; online: boolean; platform: string }[] = data.devices ?? [];
              if (!list.length) {
                finish("No systems are linked yet, Sir. Install the ARCHER app from Settings.");
              } else {
                finish(
                  `${list.length} system${list.length > 1 ? "s" : ""} linked: ` +
                    list.map((d) => `${d.name} (${d.online ? "online" : "offline"})`).join(", ") +
                    "."
                );
              }
            } catch {
              finish("I could not scan the device network, Sir.");
            }
            return true;
          }
          const target = settingsRef.current.deviceTarget || "";
          if (!target) {
            finish("No active target, Sir. Pick one in Settings under Linked Systems.");
            return true;
          }
          const devName = settingsRef.current.deviceTargetName || "your device";
          const openMatch = argLower.match(/^(?:open|launch|start)\s+(.+)$/);
          const sayMatch = argLower.match(/^(?:say|notify|alert)\s+(.+)$/);
          try {
            if (openMatch) {
              await fetch("/api/commands", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deviceId: target, action: "open_app", payload: { name: openMatch[1].trim() } }),
              });
              finish(`Opening ${openMatch[1].trim()} on ${devName}, Sir.`);
            } else if (sayMatch) {
              await fetch("/api/commands", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  deviceId: target,
                  action: "notify",
                  payload: { title: "ARCHER AI", body: sayMatch[1].trim() },
                }),
              });
              finish(`Notification sent to ${devName}, Sir.`);
            } else {
              finish("Try: /device open youtube, or /device say text, Sir.");
            }
          } catch {
            finish("The command link seems to be down, Sir.");
          }
          return true;
        }
        default:
          return false;
      }
    },
    [handleAction, speakFn, voiceStateSetter]
  );

  // ---- main submit flow ----
  const submit = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return;
      stoppedRef.current = false;
      setBusy(true);
      primeVoice(); // sync TTS unlock inside the user gesture (iOS belt & braces)
      // remember whether this turn started from the mic — only then should
      // the mic auto-resume after the reply (typed turns keep the mic off)
      const micTurn = voiceStateRef.current === "listening";
      muteMic(); // keep the mic off while ARCHER thinks & speaks (no feedback loop)
      setSubtitle(`“${text}”`);

      const s = settingsRef.current;
      const wantVoice = s.voiceEnabled !== "false";

      try {
        voiceStateSetter("thinking");
        const handled = await runSlashCommand(text);
        if (handled) return;
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        const data = await res.json();
        const reply: string = data.reply ?? "…";
        // ?? won't catch an empty string — guard so we never speak silence
        const speakText: string = (data.speak || reply || "Done, Sir.").toString();
        setSubtitle(reply);

        let finalSpeak = speakText;
        const newsOverride = await handleAction((data.action ?? null) as AgentAction | null);
        if (newsOverride) finalSpeak = newsOverride;
        setRefreshKey((k) => k + 1);

        if (wantVoice) {
          speakFn(finalSpeak, () => {
            setBusy(false);
            if (
              micTurn &&
              settingsRef.current.autoListen !== "false" &&
              !stoppedRef.current
            ) {
              setTimeout(() => listenFn(), 350);
            }
          });
        } else {
          voiceStateSetter("idle");
          setBusy(false);
          // voice replies off — but a voice-initiated turn must still resume
          // the mic, otherwise continuous conversation dies after one exchange
          if (
            micTurn &&
            settingsRef.current.autoListen !== "false" &&
            !stoppedRef.current
          ) {
            setTimeout(() => listenFn(), 350);
          }
        }
      } catch {
        setSubtitle("Connection error, Sir.");
        voiceStateSetter("idle");
        setBusy(false);
      }
    },
    [busy, handleAction, runSlashCommand, muteMic, voiceStateSetter, speakFn, listenFn, primeVoice]
  );

  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  // load settings
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setSettings({ ...DEFAULT_SETTINGS, ...(d.settings ?? {}) }))
      .catch(() => {});
  }, []);

  const handleCoreTap = () => {
    if (voice.state === "listening") {
      stoppedRef.current = true;
      voice.stopAll();
    } else if (voice.state === "speaking" || voice.state === "thinking") {
      stoppedRef.current = true;
      voice.stopAll();
    } else if (!busy) {
      stoppedRef.current = false;
      voice.startListening();
    }
  };

  const stopAll = () => {
    stoppedRef.current = true;
    voice.stopAll();
    setBusy(false);
    voice.setState("idle");
  };

  const statusLabel =
    voice.state === "listening"
      ? "LISTENING"
      : voice.state === "speaking"
        ? "SPEAKING"
        : voice.state === "thinking" || busy
          ? "THINKING"
          : "STANDBY";

  const statusColor =
    statusLabel === "LISTENING"
      ? "#22d3ee"
      : statusLabel === "SPEAKING"
        ? "#4ade80"
        : statusLabel === "THINKING"
          ? "#fbbf24"
          : "#5eead4";

  const [orbSize, setOrbSize] = useState(250);

  // ---- PWA install (make ARCHER a home-screen system app) ----
  const [installEvt, setInstallEvt] = useState<{ prompt: () => Promise<void> } | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve(); // async — avoids sync setState in effect
      if (!cancelled) setIsIOS(isIOSDevice());
    })();
    const onBip = (e: Event) => {
      e.preventDefault();
      const evt = e as Event & { prompt: () => Promise<void> };
      setInstallEvt({ prompt: () => evt.prompt() });
    };
    window.addEventListener("beforeinstallprompt", onBip);
    // minimal service worker registration — required for Android "Install app"
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onBip);
    };
  }, []);
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const byWidth = w < 420 ? w * 0.62 : 290;
      const byHeight = Math.max(h * 0.38, 180);
      setOrbSize(Math.round(Math.max(190, Math.min(byWidth, byHeight, 300))));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  const menuItems = [
    { label: "MEMORY", icon: MemoryStick, color: "#22d3ee", onClick: () => setMemoryOpen(true) },
    { label: "CHAT", icon: MessageSquare, color: "#fb923c", onClick: () => setChatOpen(true) },
    { label: "SOUL", icon: Heart, color: "#e2e8f0", onClick: () => setSoulOpen(true) },
    { label: "SETTING", icon: Settings2, color: "#4ade80", onClick: () => setSettingsOpen(true) },
  ];

  return (
    <main className="min-h-dvh archer-bg text-white flex flex-col overflow-hidden">
      {/* ================= HEADER ================= */}
      <header className="archer-header flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 z-20">
        <button
          onClick={() => setChatOpen(true)}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-emerald-400/80 hover:text-emerald-300 transition-colors"
          aria-label="Chat history"
        >
          <History className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-emerald-400/90" />
          <h1 className="archer-font text-sm sm:text-base font-bold tracking-[0.35em] text-white archer-text-glow">
            ARCHER AI
          </h1>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 transition-colors shadow-[0_0_16px_rgba(34,197,94,0.5)]"
          aria-label="Open settings"
        >
          <Cog className="w-5 h-5 text-black/80" />
        </button>
      </header>

      {/* ================= CORE AREA ================= */}
      <section className="relative flex-1 flex flex-col justify-center px-3 sm:px-5" aria-label="AI core">
        <div ref={wireContainerRef} className="relative flex items-center gap-1 sm:gap-3 mx-auto w-full max-w-md">
          {/* menu buttons */}
          <div className="flex flex-col gap-3.5 sm:gap-5 z-10 shrink-0">
            {menuItems.map((item) => (
              <button
                key={item.label}
                data-wire-node
                onClick={item.onClick}
                className="archer-menu-btn flex items-center gap-2 rounded-full pl-2.5 pr-4 py-2 sm:py-2.5 archer-font text-[10px] sm:text-[11px] font-bold tracking-[0.18em] uppercase transition-transform hover:scale-[1.04] active:scale-95"
                style={{
                  color: item.color,
                  border: `1px solid ${item.color}99`,
                  background: "linear-gradient(135deg, rgba(2,6,3,0.92), rgba(6,12,8,0.85))",
                  boxShadow: `0 0 12px ${item.color}55, inset 0 0 10px ${item.color}22`,
                  textShadow: `0 0 8px ${item.color}aa`,
                }}
              >
                <item.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {item.label}
              </button>
            ))}
          </div>

          {/* orb + status */}
          <div className="flex-1 flex flex-col items-center min-w-0">
            <ParticleOrb state={voice.state as OrbState} size={orbSize} onClick={handleCoreTap} />
            <div
              className="archer-font text-[11px] sm:text-sm tracking-[0.45em] uppercase -mt-1 sm:-mt-2"
              style={{ color: statusColor, textShadow: `0 0 14px ${statusColor}` }}
              aria-live="polite"
            >
              • {statusLabel} •
            </div>
          </div>

          {/* wires overlay */}
          <Wires containerRef={wireContainerRef} colors={menuItems.map((m) => m.color)} />
        </div>

        {/* subtitle / reply area */}
        <div className="mx-auto w-full max-w-md px-2 mt-3 sm:mt-4 min-h-[44px]">
          <p className="text-center text-[13px] sm:text-sm text-cyan-100/85 leading-snug line-clamp-2 archer-subtitle">
            {voice.state === "listening" && voice.transcript
              ? `“${voice.transcript}”`
              : subtitle}
          </p>
        </div>

        {/* stop + sound */}
        <div className="mx-auto flex items-center gap-3 mt-3 sm:mt-4">
          <button
            onClick={stopAll}
            className="archer-font flex items-center gap-2 rounded-full px-5 py-2 text-[11px] font-bold tracking-[0.25em] uppercase text-white border border-rose-400/60 bg-rose-500/10 hover:bg-rose-500/20 transition-colors shadow-[0_0_14px_rgba(251,113,133,0.35)]"
          >
            <Square className="w-3 h-3 fill-rose-400 text-rose-400" /> Stop
          </button>
          <button
            onClick={() => {
              stoppedRef.current = false;
              voice.startListening();
            }}
            disabled={busy || voice.state !== "idle"}
            className="w-9 h-9 rounded-lg flex items-center justify-center border border-teal-400/50 bg-teal-400/10 hover:bg-teal-400/20 transition-colors disabled:opacity-30 shadow-[0_0_12px_rgba(45,212,191,0.3)]"
            aria-label="Start listening"
          >
            <Volume2 className="w-4 h-4 text-teal-300" />
          </button>
        </div>

        {(!voice.supported || voice.micDenied) && (
          <p className="text-center text-[10px] text-amber-300/70 mt-2">
            {voice.micDenied
              ? "Microphone blocked — allow mic access in browser settings, or use the text input."
              : "Voice input not supported in this browser — use the text input below."}
          </p>
        )}
      </section>

      {/* ================= BOTTOM WIDGETS ================= */}
      <section className="px-3 sm:px-5 pb-2 z-10" aria-label="Dashboard">
        <div className="mx-auto max-w-md flex gap-3 items-start">
          <div className="flex-1 min-w-0 pt-2">
            <HeadlinesSection
              panelOpen={headlinesOpen}
              onPanelClose={() => setHeadlinesOpen(false)}
              refreshKey={refreshKey}
            />
          </div>
          <div className="w-[56%] max-w-[240px] shrink-0">
            <TasksCard open={tasksOpen} onOpen={() => setTasksOpen(true)} refreshKey={refreshKey} />
          </div>
        </div>
      </section>

      {/* ================= INPUT BAR ================= */}
      <section className="px-3 sm:px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 z-10">
        <form
          className="mx-auto max-w-md flex items-center gap-2 rounded-full px-3 py-1.5 border border-cyan-400/25 bg-black/60 backdrop-blur-md focus-within:border-cyan-400/60 transition-colors"
          style={{ boxShadow: "0 0 20px rgba(34,211,238,0.12)" }}
          onSubmit={(e) => {
            e.preventDefault();
            const input = (e.currentTarget.elements.namedItem("q") as HTMLInputElement);
            if (input.value.trim()) {
              submit(input.value.trim());
              input.value = "";
            }
          }}
        >
          <button
            type="button"
            onClick={handleCoreTap}
            disabled={busy}
            className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 ${
              voice.state === "listening"
                ? "bg-cyan-400/30 shadow-[0_0_16px_rgba(34,211,238,0.6)] animate-pulse"
                : "hover:bg-white/10"
            }`}
            aria-label="Voice input"
          >
            <Mic className={`w-4 h-4 ${voice.state === "listening" ? "text-cyan-200" : "text-cyan-300/80"}`} />
          </button>
          <input
            name="q"
            autoComplete="off"
            placeholder="Ask anything — /open /play /task /news /help"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-cyan-50 placeholder:text-white/30 py-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-40"
            aria-label="Send message"
          >
            <SendHorizonal className="w-4 h-4 text-cyan-300" />
          </button>
        </form>
      </section>

      {/* ================= PANELS ================= */}
      <MemoryPanel open={memoryOpen} onClose={() => setMemoryOpen(false)} />
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onSend={(t) => submit(t)}
        onChanged={() => setRefreshKey((k) => k + 1)}
      />
      {soulOpen && (
        <SoulPanel
          open
          onClose={() => setSoulOpen(false)}
          initialSoul={settings.soul}
          onSaved={() => {
            fetch("/api/settings")
              .then((r) => r.json())
              .then((d) => setSettings({ ...DEFAULT_SETTINGS, ...(d.settings ?? {}) }))
              .catch(() => {});
          }}
        />
      )}
      {settingsOpen && (
        <SettingsPanel
          open
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onSaved={setSettings}
          installAvailable={!!installEvt}
          isIOSDevice={isIOS}
          onInstall={() => {
            installEvt?.prompt().then(() => setInstallEvt(null)).catch(() => {});
          }}
          onTestVoice={() => {
            stoppedRef.current = true; // don't auto-listen after the test
            primeVoice();
            muteMic();
            speakFn("Voice systems online, Sir.", () => voice.setState("idle"));
          }}
        />
      )}

      {/* tasks full panel */}
      {tasksOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center archer-fade-in" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setTasksOpen(false)} />
          <div className="relative w-full sm:max-w-md max-h-[82vh] flex flex-col rounded-t-2xl sm:rounded-2xl archer-slide-up border border-cyan-400/40 bg-[#050a06]/97" style={{ boxShadow: "0 0 30px rgba(34,211,238,0.2)" }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10">
              <h2 className="archer-font text-sm tracking-[0.3em] uppercase text-cyan-300 flex items-center gap-2">
                <ListTodo className="w-4 h-4" /> Today Tasks
              </h2>
              <button onClick={() => setTasksOpen(false)} className="text-white/50 hover:text-white text-xl leading-none px-2" aria-label="Close">×</button>
            </div>
            <div className="overflow-y-auto archer-scroll px-5 py-4">
              <TasksCard open onOpen={() => {}} refreshKey={refreshKey} onChanged={() => setRefreshKey((k) => k + 1)} />
              <button
                onClick={async () => {
                  // ?id=all → route deletes only COMPLETED tasks (pending ones are kept)
                  await fetch("/api/tasks?id=all", { method: "DELETE" }).catch(() => {});
                  setRefreshKey((k) => k + 1);
                  setTasksOpen(false);
                }}
                className="mt-4 w-full h-10 rounded-lg border border-red-400/30 text-red-300/90 text-sm hover:bg-red-400/10 transition-colors"
              >
                Clear Completed
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
