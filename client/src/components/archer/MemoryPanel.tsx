"use client";

import { useEffect, useState } from "react";
import { Brain, Plus, Trash2 } from "lucide-react";
import HUDPanel from "./HUDPanel";

interface MemoryItem {
  id: string;
  content: string;
  createdAt: string;
}

interface MemoryPanelProps {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

export default function MemoryPanel({ open, onClose, onChanged }: MemoryPanelProps) {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    try {
      const res = await fetch("/api/memory");
      const data = await res.json();
      setMemories(data.memories ?? []);
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/memory");
        const data = await res.json();
        if (!cancelled) setMemories(data.memories ?? []);
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const add = async () => {
    if (!input.trim() || busy) return;
    setBusy(true);
    try {
      await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.trim() }),
      });
      setInput("");
      await reload();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/memory?id=${id}`, { method: "DELETE" });
      await reload();
      onChanged?.();
    } catch {
      /* noop */
    }
  };

  return (
    <HUDPanel open={open} onClose={onClose} title="Memory Core" accent="#22d3ee">
      <p className="text-xs text-white/50 mb-3 leading-relaxed">
        Things ARCHER AI permanently remembers about you. It reads these before every reply.
      </p>
      <div className="flex gap-2 mb-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="e.g. My favourite song is Sunflower"
          className="flex-1 bg-black/50 rounded-lg px-3 py-2.5 text-sm text-cyan-100 placeholder:text-white/25 outline-none border border-cyan-400/25 focus:border-cyan-400/60 transition-colors"
        />
        <button
          onClick={add}
          disabled={busy}
          className="w-11 h-11 rounded-lg flex items-center justify-center border border-cyan-400/40 bg-cyan-400/10 hover:bg-cyan-400/20 transition-colors disabled:opacity-40"
          aria-label="Add memory"
        >
          <Plus className="w-4 h-4 text-cyan-300" />
        </button>
      </div>

      {memories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Brain className="w-10 h-10 text-cyan-400/40 mb-3" />
          <p className="text-sm text-white/40">Memory core is empty, Sir.</p>
          <p className="text-xs text-white/25 mt-1">Say &quot;remember that...&quot; and I will store it.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {memories.map((m) => (
            <li
              key={m.id}
              className="group flex items-start gap-3 rounded-lg px-3 py-2.5 border border-cyan-400/15 bg-cyan-400/5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 mt-1.5 shrink-0 shadow-[0_0_6px_#22d3ee]" />
              <span className="flex-1 text-sm text-cyan-50/90 leading-snug">{m.content}</span>
              <button
                onClick={() => remove(m.id)}
                className="opacity-40 group-hover:opacity-100 text-red-400 transition-opacity"
                aria-label="Delete memory"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </HUDPanel>
  );
}
