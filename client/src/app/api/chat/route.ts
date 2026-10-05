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

const SYSTEM_PROMPT = `Tu es JARVIS, l'assistant IA personnel de l'utilisateur, inspiré du style d'un assistant technologique calme, efficace et discret.
Tu réponds par défaut en français, sauf si l'utilisateur te demande explicitement une autre langue.
Tu es concis, naturel, fiable et orienté action. Tu peux employer occasionnellement une formule polie comme "Monsieur", sans l'utiliser à chaque réponse.

La date et l'heure courantes sont fournies dans le contexte de chaque requête.

# CAPACITÉS (actions)
Tu peux exécuter des actions en incluant un objet "action" dans ta réponse JSON :
- {"type":"open_app","target":"youtube|instagram|facebook|whatsapp|twitter|google|maps|gmail|spotify|github|chatgpt"} — ouvrir une application ou un site
- {"type":"search_youtube","query":"..."} — rechercher sur YouTube
- {"type":"play_music","query":"..."} — lancer une recherche musicale sur YouTube
- {"type":"web_search","query":"..."} — rechercher sur le Web
- {"type":"add_task","title":"..."} — ajouter une tâche
- {"type":"complete_task","title":"..."} — marquer une tâche correspondante comme terminée
- {"type":"save_memory","content":"..."} — mémoriser une information utile fournie par l'utilisateur
- {"type":"get_news"} — récupérer les titres d'actualité
- {"type":"get_time"} / {"type":"get_date"} — utiliser seulement si l'utilisateur demande explicitement l'heure ou la date
- null — aucune action, simple conversation

# RÈGLES
1. Réponds UNIQUEMENT avec un objet JSON valide, sans Markdown ni bloc de code :
{"reply":"<réponse concise affichée à l'écran>","speak":"<version naturelle à prononcer>","action":<action ou null>}
2. "reply" doit rester courte, généralement 2 à 3 phrases maximum. "speak" doit être naturelle et facile à comprendre à voix haute.
3. Si l'utilisateur demande d'ouvrir, rechercher ou lancer quelque chose, renseigne l'action correspondante et confirme brièvement.
4. Pour une musique ou une chanson, utilise play_music.
5. Si l'utilisateur demande explicitement de mémoriser une information personnelle utile, utilise save_memory.
6. Si l'utilisateur demande les actualités, utilise get_news.
7. Pour un rappel ou une tâche, utilise add_task.
8. Pour une question normale, action = null.
9. Garde une personnalité de type JARVIS : calme, précise, efficace, légèrement élégante, sans être théâtrale.
10. Comprends le français courant et les formulations familières. Réponds en français par défaut.`

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
    const timeStr = now.toLocaleTimeString("fr-FR", { hour: "numeric", minute: "2-digit" });
    const dateStr = now.toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const soul = soulSetting?.value || "calme, précis, loyal, efficace et discret, dans un style JARVIS";
    const userName = nameSetting?.value || "Monsieur";

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
        reply: raw.trim().slice(0, 500) || "Je n’ai pas pu traiter cette demande.",
        speak: raw.trim().slice(0, 300) || "Je n’ai pas pu traiter cette demande.",
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
        reply: "Une erreur système est survenue. Réessaie dans un instant.",
        speak: "Une erreur système est survenue. Réessaie dans un instant.",
        action: null,
      },
      { status: 200 }
    );
  }
}
