"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, SendHorizonal, Trash2 } from "lucide-react";
import HUDPanel from "./HUDPanel";

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  onSend?: (text: string) => void;
  onChanged?: () => void;
}

export default function ChatPanel({ open, onClose, onSend, onChanged }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/messages");
        const data = await res.json();
        if (cancelled) return;
        setMessages(data.messages ?? []);
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
        });
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const send = () => {
    if (!input.trim()) return;
    onSend?.(input.trim());
    setInput("");
    onClose();
  };

  const reload = async () => {
    try {
      const res = await fetch("/api/messages");
      const data = await res.json();
      setMessages(data.messages ?? []);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    } catch {
      /* noop */
    }
  };

  const clear = async () => {
    try {
      await fetch("/api/messages", { method: "DELETE" });
      await reload();
      onChanged?.();
    } catch {
      /* noop */
    }
  };

  return (
    <HUDPanel open={open} onClose={onClose} title="Chat Link" accent="#fb923c">
      <div ref={scrollRef} className="max-h-[46vh] overflow-y-auto archer-scroll space-y-3 mb-4 pr-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <MessageSquare className="w-10 h-10 text-orange-400/40 mb-3" />
            <p className="text-sm text-white/40">No conversation yet.</p>
            <p className="text-xs text-white/25 mt-1">Talk to me or type below.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-snug ${
                  m.role === "user"
                    ? "bg-orange-400/15 border border-orange-400/30 text-orange-50 rounded-br-sm"
                    : "bg-white/5 border border-white/10 text-white/90 rounded-bl-sm"
                }`}
              >
                {m.role !== "user" && (
                  <span className="block text-[10px] tracking-[0.2em] text-cyan-300/80 uppercase mb-1 archer-font">Archer</span>
                )}
                {m.content}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={clear}
          className="w-11 h-11 shrink-0 rounded-lg flex items-center justify-center border border-red-400/30 text-red-400/80 hover:text-red-300 hover:border-red-400/60 transition-colors"
          aria-label="Clear chat history"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message..."
          className="flex-1 bg-black/50 rounded-lg px-3 py-2.5 text-sm text-orange-50 placeholder:text-white/25 outline-none border border-orange-400/25 focus:border-orange-400/60 transition-colors"
        />
        <button
          onClick={send}
          className="w-11 h-11 shrink-0 rounded-lg flex items-center justify-center border border-orange-400/40 bg-orange-400/10 hover:bg-orange-400/20 transition-colors"
          aria-label="Send message"
        >
          <SendHorizonal className="w-4 h-4 text-orange-300" />
        </button>
      </div>
    </HUDPanel>
  );
}
