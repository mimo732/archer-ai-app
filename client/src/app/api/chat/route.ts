import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  | { type: "get_date" }
  | null;

interface BrainResponse {
  reply: string;
  speak: string;
  action?: AgentAction;
}

const SYSTEM_PROMPT = `You are ARCHER AI — a personal Jarvis-style AI assistant (like Iron Man's JARVIS) living on the user's device.
You are powerful, loyal, witty and slightly formal like JARVIS. You address the user respectfully with "Sir".

Current date/time will be provided in each request context.

# CAPABILITIES (actions):
You can perform actions by including an "action" object in your JSON response:
- {"type":"open_app","target":"youtube|instagram|facebook|whatsapp|twitter|google|maps|gmail|spotify|github|chatgpt"} — open an app/site
- {"type":"search_youtube","query":"..."} — search something on YouTube
- {"type":"play_music","query":"song name"} — play a song (opens YouTube search for it)
- {"type":"web_search","query":"..."} — search the web on Google
- {"type":"add_task","title":"..."} — add a task to today's task list
- {"type":"complete_task","title":"..."} — mark a matching task as done
- {"type":"save_memory","content":"..."} — remember something permanently about the user
- {"type":"get_news"} — fetch today's headlines (you can combine with reply)
- {"type":"get_time"} / {"type":"get_date"} — you already know time from context; use only if user explicitly asks
- null — no action, just conversation

# RULES:
1. ALWAYS respond with ONLY a valid JSON object, no markdown, no code fences:
{"reply":"<concise reply shown on screen>","speak":"<natural spoken version, short 1-2 sentences>","action":<action or null>}
2. "reply" is short (max 2-3 sentences) — it shows on the HUD. "speak" is what gets spoken aloud — natural, friendly, brief.
3. If the user asks to open/search/play something, set the action AND confirm in your reply (e.g. "Opening YouTube, Sir.").
4. If the user asks to play a song, use play_music with the song name.
5. If the user states a personal fact ("my name is X", "remember that I..."), use save_memory.
6. If the user asks for news/headlines, use get_news.
7. If user asks to add a reminder/task, use add_task.
8. For normal questions, action = null and just answer. You may answer simple factual questions directly (math, general knowledge).
9. Keep JARVIS personality: calm, clever, loyal. Occasionally call the user "Sir". Never be verbose.
10. The user may write in Bangla/Banglish or English — respond in the language the user uses, but keep it natural.`;

function extractJson(text: string): BrainResponse | null {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(t.slice(start, end + 1)) as BrainResponse;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message: string = (body.message ?? "").toString().slice(0, 2000);
    if (!message.trim()) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    const [memories, tasks, soulSetting, nameSetting, history] = await Promise.all([
      db.memoryItem.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
      db.task.findMany({ where: { done: false }, orderBy: { createdAt: "desc" }, take: 10 }),
      db.setting.findUnique({ where: { key: "soul" } }),
      db.setting.findUnique({ where: { key: "userName" } }),
      db.chatMessage.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    ]);

    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const dateStr = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const soul = soulSetting?.value || "loyal, witty, calm, slightly formal like JARVIS from Iron Man";
    const userName = nameSetting?.value || "Sir";

    const historyMsgs = history
      .reverse()
      .map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }));

    const contextBlock = [
      `Current date: ${dateStr}`,
      `Current time: ${timeStr}`,
      `User name: ${userName}`,
      `Your personality: ${soul}`,
      memories.length ? `Memories about the user:\n- ${memories.map((m) => m.content).join("\n- ")}` : "No memories yet.",
      tasks.length
        ? `Pending tasks:\n- ${tasks.map((t) => `${t.done ? "[x]" : "[ ]"} ${t.title}`).join("\n- ")}`
        : "No pending tasks.",
    ].join("\n\n");

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n\n# CONTEXT:\n${contextBlock}` },
        ...historyMsgs,
        { role: "user", content: message },
      ],
      thinking: { type: "disabled" },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed = extractJson(raw);
    if (!parsed || typeof parsed.reply !== "string") {
      parsed = {
        reply: raw.trim().slice(0, 500) || "I could not process that, Sir.",
        speak: raw.trim().slice(0, 300) || "I could not process that, Sir.",
        action: null,
      };
    }

    await Promise.all([
      db.chatMessage.create({ data: { role: "user", content: message } }),
      db.chatMessage.create({
        data: { role: "assistant", content: typeof parsed.reply === "string" ? parsed.reply : JSON.stringify(parsed.reply) },
      }),
    ]);

    const action =
      parsed.action && typeof parsed.action === "object" && "type" in parsed.action
        ? (parsed.action as AgentAction)
        : null;

    return NextResponse.json({
      reply: parsed.reply,
      speak: typeof parsed.speak === "string" && parsed.speak ? parsed.speak : parsed.reply,
      action,
    });
  } catch (err) {
    console.error("chat error:", err);
    return NextResponse.json(
      {
        reply: "My systems encountered an error, Sir. Please try again.",
        speak: "My systems encountered an error, Sir. Please try again.",
        action: null,
      },
      { status: 200 }
    );
  }
}
