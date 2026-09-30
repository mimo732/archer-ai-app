"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type VoiceState = "idle" | "listening" | "thinking" | "speaking";

interface UseVoiceOptions {
  onFinalTranscript: (text: string) => void;
  language?: string;
  rate?: number;
  /** 0..1 — output volume of speech synthesis (default 0.5) */
  volume?: number;
  voiceGender?: "male" | "female";
  /** explicit voice name chosen in Settings (empty = auto pick best quality) */
  voiceName?: string;
}

/**
 * Split long text into short utterance-sized chunks.
 * Chrome silently cuts utterances longer than ~15s, so we keep each
 * chunk small (scaled by the speech rate) and queue them back-to-back.
 * Includes Bangla sentence marks (। ॥) so Bangla replies get proper
 * sentence-level prosody instead of one long robotic run.
 */
function chunkText(text: string, rate: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const max = Math.max(90, Math.min(220, Math.round(170 * (rate || 1))));
  const sentences = clean.match(/[^.!?…।॥]+[.!?…।॥]+|[^.!?…।॥]+$/g) ?? [clean];
  const chunks: string[] = [];
  let cur = "";
  const pushHardSplit = (piece: string) => {
    let rest = piece;
    while (rest.length > max) {
      let cut = rest.lastIndexOf(" ", max);
      if (cut < max * 0.6) cut = max;
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    return rest;
  };
  for (const s of sentences) {
    const piece = s.trim();
    if (!piece) continue;
    if ((cur ? (cur + " " + piece) : piece).length <= max) {
      cur = cur ? cur + " " + piece : piece;
    } else {
      if (cur) {
        chunks.push(cur);
        cur = "";
      }
      cur = pushHardSplit(piece);
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

// ---- voice quality engine (clean & clear Bangla + English) ----

const BANGLA_CHAR_RE = /[\u0980-\u09FF]/; // Bangla letters & digits

interface ScriptSegment {
  text: string;
  bn: boolean; // true → segment is written in Bangla script
}

/**
 * Split a mixed Bangla/English reply into per-script segments so each
 * segment is read by a voice that can actually pronounce it. This is the
 * #1 cause of "voice not clean": an English voice reading Bangla script
 * (or vice versa) sounds muffled/garbled or skips words entirely.
 */
function splitByScript(text: string): ScriptSegment[] {
  const parts: ScriptSegment[] = [];
  let cur = "";
  let curBn: boolean | null = null;
  for (const ch of text) {
    const isBn = BANGLA_CHAR_RE.test(ch);
    const isLatin = /[A-Za-z]/.test(ch);
    const segBn = isBn ? true : isLatin ? false : null; // null = neutral (space/punct/digit)
    if (curBn === null) {
      cur = ch;
      curBn = segBn === null ? null : segBn;
      continue;
    }
    if (segBn !== null && segBn !== curBn) {
      if (cur.trim()) parts.push({ text: cur.trim(), bn: curBn });
      cur = ch;
      curBn = segBn;
    } else {
      cur += ch;
      if (curBn === null && segBn !== null) curBn = segBn;
    }
  }
  if (cur.trim()) parts.push({ text: cur.trim(), bn: curBn === null ? false : curBn });
  return parts;
}

/** Engines/voices that sound robotic — hard-penalized */
const BAD_VOICE_HINTS = ["espeak", "compact", "eloquence", "pico", "festival", "flite"];

/** Score a voice by how natural it sounds in practice (higher = clearer) */
function scoreVoice(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  let s = 0;
  for (const h of BAD_VOICE_HINTS) if (n.includes(h)) s -= 60;
  if (n.includes("google")) s += 45; // network neural voices — clearest
  if (n.includes("microsoft")) s += 35; // WinRT natural/online voices
  if (n.includes("natural") || n.includes("neural") || n.includes("online")) s += 30;
  if (n.includes("samsung")) s += 25;
  if (n.includes("premium") || n.includes("enhanced") || n.includes("siri")) s += 20;
  if (v.localService === false) s += 8; // network voices usually beat local engines
  return s;
}

const MALE_HINTS = ["male", "daniel", "alex", "fred", "google uk english male", "guy", "david", "rishi", "arthur", "oliver"];
const FEMALE_HINTS = ["female", "samantha", "zira", "google uk english female", "susan", "hazel", "karen", "moira", "ava", "tessa"];

function pickBestVoice(langPrefix: string, gender: "male" | "female"): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  let pool = voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
  if (!pool.length && langPrefix === "bn") {
    // some engines expose Bangla only through the voice name
    pool = voices.filter((v) => /bangla|bengali|bn[-_]/i.test(v.name));
  }
  if (!pool.length && langPrefix !== "en") pool = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  if (!pool.length) pool = voices;
  const sorted = [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  // Gender is a TIEBREAKER inside the top quality tier only — a hint match on
  // a far-worse voice (e.g. Microsoft David over Google network voices) would
  // defeat the whole "clean & clear" goal.
  const bestScore = scoreVoice(sorted[0]);
  const tier = sorted.filter((v) => bestScore - scoreVoice(v) <= 15);
  const hints = gender === "male" ? MALE_HINTS : FEMALE_HINTS;
  return tier.find((v) => hints.some((h) => v.name.toLowerCase().includes(h))) ?? sorted[0];
}

export function useVoice({
  onFinalTranscript,
  language = "en-US",
  rate = 1,
  volume = 0.5,
  voiceGender = "male",
  voiceName = "",
}: UseVoiceOptions) {
  const [supported, setSupported] = useState(true);
  const [micDenied, setMicDenied] = useState(false);
  const [state, setStateRaw] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");

  const recRef = useRef<any>(null);
  const activeRef = useRef(false); // recognition instance currently running
  const wantListenRef = useRef(false); // user wants the mic to stay open
  const noRestartRef = useRef(false); // hard failure (permission/hardware) — never auto-restart
  const restartTimerRef = useRef<number | null>(null);
  const srFailRef = useRef(0); // consecutive recognition drops (silence timeout / network) — drives backoff
  const primedRef = useRef(false);
  const speakingRef = useRef(false); // TTS currently playing
  const speakGenRef = useRef(0); // generation counter — cancels stale utterance callbacks
  const stateRef = useRef<VoiceState>("idle");
  const onFinalRef = useRef(onFinalTranscript);
  const restartFnRef = useRef<() => void>(() => {}); // indirection so onend can re-arm the recognizer

  const langRef = useRef(language);
  const rateRef = useRef(rate);
  const volRef = useRef(volume);
  const genderRef = useRef(voiceGender);
  const voiceNameRef = useRef(voiceName);

  useEffect(() => {
    onFinalRef.current = onFinalTranscript;
    langRef.current = language;
    rateRef.current = rate;
    volRef.current = Math.max(0, Math.min(1, volume));
    genderRef.current = voiceGender;
    voiceNameRef.current = voiceName;
  }, [onFinalTranscript, language, rate, volume, voiceGender, voiceName]);

  const setState = useCallback((s: VoiceState) => {
    stateRef.current = s;
    setStateRaw(s);
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  // ---- speech synthesis helpers ----
  /**
   * Pick the clearest voice for one script segment.
   * - Bangla segment → best Bangla voice (Google network voice preferred)
   * - Latin segment  → best voice for the settings language (English default)
   * - An explicit voiceName from Settings is honored only for segments that
   *   match its own language, so a chosen English voice never garbles Bangla.
   */
  const pickVoice = useCallback((segBn: boolean): SpeechSynthesisVoice | null => {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const wanted = (voiceNameRef.current || "").trim();
    if (wanted) {
      const explicit = window.speechSynthesis.getVoices().find((v) => v.name === wanted);
      if (explicit) {
        const explicitIsBn = BANGLA_CHAR_RE.test(explicit.name) || explicit.lang.toLowerCase().startsWith("bn");
        if (explicitIsBn === segBn) return explicit;
      }
    }
    if (segBn) return pickBestVoice("bn", genderRef.current);
    const langPrefix = (langRef.current || "en-US").slice(0, 2).toLowerCase();
    return pickBestVoice(langPrefix === "bn" ? "en" : langPrefix, genderRef.current);
  }, []);

  /**
   * MUST be called from inside a real user gesture (tap/click/keypress) at least once.
   * iOS Safari and some Android browsers lock speechSynthesis until the first
   * utterance is created inside a gesture — this "unlock" makes every later
   * speak() call work, even when triggered asynchronously by the AI reply.
   */
  const primeVoice = useCallback(() => {
    if (primedRef.current) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      const ss = window.speechSynthesis;
      const genAtPrime = speakGenRef.current;
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      u.rate = 1;
      ss.speak(u);
      // Only clean up the silent utterance if NO real speech was queued during
      // this window — a blind cancel() here used to kill real utterances that
      // were queued right after prime (replies went completely silent).
      window.setTimeout(() => {
        try {
          if (speakGenRef.current === genAtPrime) ss.cancel();
        } catch {
          /* noop */
        }
      }, 150);
      ss.getVoices(); // warm the voice list
      primedRef.current = true;
    } catch {
      /* noop */
    }
  }, []);

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        setState("idle");
        onEnd?.();
        return;
      }
      const ss = window.speechSynthesis;
      const gen = ++speakGenRef.current;
      speakingRef.current = true;
      try {
        ss.cancel();
      } catch {
        /* noop */
      }

      // per-script segments → each read by a voice that can pronounce it
      const segments = splitByScript(text);
      if (!segments.length) {
        speakingRef.current = false;
        setState("idle");
        onEnd?.();
        return;
      }
      const chunks = segments.flatMap((seg) =>
        chunkText(seg.text, rateRef.current).map((chunk) => ({ chunk, bn: seg.bn }))
      );

      let finished = 0;
      let started = false;
      const finish = () => {
        if (gen !== speakGenRef.current) return;
        speakingRef.current = false;
        setState("idle");
        onEnd?.();
      };

      const startPlayback = () => {
        if (gen !== speakGenRef.current) return; // superseded by a newer speak()/cancel
        // Chrome can get stuck in a "paused" state (after cancel(), tab
        // switches, OS audio interruptions) — speak() then queues forever
        // with no sound and no events. resume() unsticks it.
        try {
          ss.resume();
        } catch {
          /* noop */
        }
        chunks.forEach(({ chunk, bn }) => {
          const u = new SpeechSynthesisUtterance(chunk);
          const v = pickVoice(bn);
          if (v) u.voice = v;
          // lang must match the voice actually speaking this segment,
          // otherwise Android engines refuse to vocalize it
          u.lang = v?.lang || (bn ? "bn-BD" : langRef.current);
          u.rate = rateRef.current;
          u.volume = volRef.current;
          // pitch != 1 causes robotic resampling artifacts on several engines —
          // clarity comes from picking a properly gendered voice instead
          u.pitch = 1;
          u.onstart = () => {
            started = true;
          };
          u.onend = () => {
            finished += 1;
            if (finished >= chunks.length) finish();
          };
          u.onerror = (ev: any) => {
            const err = ev?.error;
            if (err && err !== "interrupted" && err !== "canceled") {
              console.warn("speech synthesis error:", err);
            }
            finished += 1;
            if (finished >= chunks.length) finish();
          };
          try {
            ss.speak(u);
          } catch {
            finished += 1;
            if (finished >= chunks.length) finish();
          }
        });
        // optimistic state — onstart is unreliable on some Android builds
        setState("speaking");
      };

      // Watchdog: some browsers queue the utterance but never fire onstart
      // (Chrome paused-bug, voice loading, silent failures). After 3s try
      // resume(); after 6s, if the queue is provably dead, recover the UI.
      window.setTimeout(() => {
        if (gen !== speakGenRef.current || started) return;
        try {
          ss.resume();
        } catch {
          /* noop */
        }
        window.setTimeout(() => {
          if (gen !== speakGenRef.current || started) return;
          let dead = false;
          try {
            // Wedged engines either leave an empty queue (dead) or stay
            // paused even after resume() — both mean the utterance will
            // never fire events, so recover the UI.
            dead = (!ss.speaking && !ss.pending) || ss.paused === true;
          } catch {
            dead = false;
          }
          if (dead) finish();
        }, 3000);
      }, 3000);

      // iOS/Safari: speak() issued in the same tick as cancel() is swallowed — give it a beat
      window.setTimeout(startPlayback, 90);
    },
    [pickVoice, setState]
  );

  const stopSpeaking = useCallback(() => {
    speakGenRef.current += 1; // invalidate queued utterance callbacks
    speakingRef.current = false;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* noop */
      }
    }
    setState("idle");
  }, [setState]);

  // ---- speech recognition (continuous, self-healing) ----
  const createAndStart = useCallback(() => {
    clearRestartTimer();
    const SR =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;
    if (!SR) {
      setSupported(false);
      wantListenRef.current = false;
      return;
    }

    const rec = new SR();
    recRef.current = rec;
    rec.lang = langRef.current;
    rec.continuous = true; // keep listening across phrases
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    activeRef.current = true;
    setTranscript("");
    setState("listening");

    rec.onresult = (e: any) => {
      let final = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interim += res[0].transcript;
      }
      setTranscript(final || interim);
      if (final.trim()) {
        // pause the mic while the brain thinks and ARCHER speaks
        // (prevents the mic from hearing its own voice)
        wantListenRef.current = false;
        activeRef.current = false;
        try {
          rec.stop();
        } catch {
          /* noop */
        }
        onFinalRef.current(final.trim());
      }
    };

    // real audio started — the recognizer is healthy again, reset backoff
    rec.onaudiostart = () => {
      srFailRef.current = 0;
    };

    rec.onerror = (e: any) => {
      const err = e?.error;
      if (err === "not-allowed" || err === "service-not-allowed") {
        noRestartRef.current = true;
        wantListenRef.current = false;
        activeRef.current = false;
        setMicDenied(true);
        setState("idle");
      } else if (err === "audio-capture") {
        noRestartRef.current = true;
        wantListenRef.current = false;
        activeRef.current = false;
        setState("idle");
      }
      // no-speech / network / aborted → onend decides whether to restart
    };

    rec.onend = () => {
      activeRef.current = false;
      recRef.current = null;
      if (!wantListenRef.current || noRestartRef.current) {
        if (stateRef.current === "listening") setState("idle");
        return;
      }
      if (speakingRef.current || stateRef.current === "speaking") return; // autoListen resumes later
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return; // resume on visible
      // silence timeout / service drop — restart to keep the mic alive (JARVIS-style)
      // with a bounded backoff so weak networks don't hammer the SR service
      srFailRef.current += 1;
      const backoff = Math.min(2000, 300 * Math.pow(2, Math.min(3, srFailRef.current - 1)));
      clearRestartTimer();
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null;
        if (wantListenRef.current && !activeRef.current && !speakingRef.current && !noRestartRef.current) {
          try {
            restartFnRef.current();
          } catch {
            setState("idle");
          }
        }
      }, backoff);
    };

    try {
      rec.start();
    } catch {
      // start() can throw InvalidStateError when called right after a stop — retry once
      activeRef.current = false;
      clearRestartTimer();
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null;
        if (wantListenRef.current && !activeRef.current && !speakingRef.current && !noRestartRef.current) {
          try {
            restartFnRef.current();
          } catch {
            wantListenRef.current = false;
            setState("idle");
          }
        }
      }, 400);
    }
  }, [clearRestartTimer, setState]);

  useEffect(() => {
    restartFnRef.current = createAndStart;
  }, [createAndStart]);

  const startListening = useCallback(() => {
    const SR =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;
    if (!SR) {
      setSupported(false);
      return;
    }
    if (activeRef.current) return;
    // user explicitly asked again — maybe permission was just granted
    noRestartRef.current = false;
    setMicDenied(false);
    wantListenRef.current = true;
    restartFnRef.current();
  }, []);

  const stopListening = useCallback(() => {
    wantListenRef.current = false;
    clearRestartTimer();
    const rec = recRef.current;
    activeRef.current = false;
    try {
      rec?.stop();
    } catch {
      /* noop */
    }
    recRef.current = null;
    if (stateRef.current === "listening") setState("idle");
  }, [clearRestartTimer, setState]);

  const stopAll = useCallback(() => {
    stopListening();
    stopSpeaking();
  }, [stopListening, stopSpeaking]);

  // pause/resume the mic with the tab (Android Chrome kills recognition in background)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        try {
          recRef.current?.abort();
        } catch {
          /* noop */
        }
        activeRef.current = false;
        if (stateRef.current === "listening") setState("idle");
      } else if (wantListenRef.current && !activeRef.current && !speakingRef.current && !noRestartRef.current) {
        clearRestartTimer();
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null;
          if (wantListenRef.current && !activeRef.current && !speakingRef.current && !noRestartRef.current) {
            try {
              createAndStart();
            } catch {
              /* noop */
            }
          }
        }, 400);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [clearRestartTimer, createAndStart, setState]);

  // preload voices + cleanup
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* noop */
        }
      }
      try {
        recRef.current?.abort();
      } catch {
        /* noop */
      }
      if (restartTimerRef.current !== null) clearTimeout(restartTimerRef.current);
    };
  }, []);

  return {
    supported,
    micDenied,
    state,
    transcript,
    setState,
    startListening,
    stopListening,
    stopSpeaking,
    stopAll,
    speak,
    primeVoice,
  };
}
