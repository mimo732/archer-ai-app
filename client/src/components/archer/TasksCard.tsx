"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Circle, CheckCircle2, Plus, Flame } from "lucide-react";
interface Task {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
}

interface TasksCardProps {
  open: boolean;
  onOpen: () => void;
  refreshKey: number;
  onChanged?: () => void;
}

export default function TasksCard({ open, onOpen, refreshKey, onChanged }: TasksCardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");

  const reload = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tasks");
        const data = await res.json();
        if (!cancelled) setTasks(data.tasks ?? []);
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const pending = tasks.filter((t) => !t.done).length;
  const doneCount = tasks.filter((t) => t.done).length;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const visible = open ? tasks.slice(0, 6) : tasks.slice(0, 3);

  const toggle = async (t: Task) => {
    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, done: !t.done }),
      });
      await reload();
      onChanged?.();
    } catch {
      /* noop */
    }
  };

  const add = async () => {
    if (!newTask.trim()) return;
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTask.trim() }),
      });
      setNewTask("");
      await reload();
      onChanged?.();
    } catch {
      /* noop */
    }
  };

  return (
    <div
      className="rounded-xl border border-white/15 bg-[#0b100c]/80 backdrop-blur-sm px-3.5 py-3 w-full"
      style={{ boxShadow: "0 0 18px rgba(0,0,0,0.5)" }}
    >
      <button onClick={onOpen} className="flex items-center gap-1.5 w-full text-left group" aria-label="Open tasks panel">
        <span className="archer-font text-[11px] sm:text-xs font-bold tracking-wide text-white uppercase">
          Today Tasks
        </span>
        <span className="text-[10px] text-white/50 flex items-center gap-1">
          {pending} left {pending > 0 && <Flame className="w-3 h-3 text-orange-400" />}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-white/50 group-hover:text-white transition-colors ml-auto" />
      </button>

      {/* progress */}
      <div className="mt-2.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-cyan-400 transition-all duration-500"
          style={{ width: `${pct}%`, boxShadow: "0 0 10px #22d3ee" }}
        />
      </div>

      {/* task list */}
      <ul className="mt-2.5 space-y-1.5">
        {visible.length === 0 && (
          <li className="text-[11px] text-white/35 py-1">No tasks. All clear, Sir.</li>
        )}
        {visible.map((t) => (
          <li key={t.id}>
            <button onClick={() => toggle(t)} className="flex items-start gap-2 w-full text-left group">
              {t.done ? (
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 mt-0.5 text-cyan-300/80 shrink-0 group-hover:text-cyan-200" />
              )}
              <span
                className={`text-[11px] sm:text-xs leading-snug truncate ${
                  t.done ? "text-white/30 line-through" : "text-white/85"
                }`}
              >
                {t.title}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* add task */}
      {open && (
        <div className="mt-3 flex gap-1.5">
          <input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="New task..."
            className="flex-1 min-w-0 bg-black/40 rounded-md px-2.5 py-1.5 text-[11px] text-white/90 placeholder:text-white/25 outline-none border border-white/15 focus:border-cyan-400/50 transition-colors"
          />
          <button
            onClick={add}
            className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center border border-cyan-400/40 bg-cyan-400/10 hover:bg-cyan-400/20 transition-colors"
            aria-label="Add task"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-300" />
          </button>
        </div>
      )}
    </div>
  );
}
