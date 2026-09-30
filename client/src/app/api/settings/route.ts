import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEFAULT_SOUL =
  "loyal, witty, calm, slightly formal like JARVIS from Iron Man. Clever and resourceful, always calls the user respectfully.";

export async function GET() {
  const rows = await db.setting.findMany();
  const map: Record<string, string> = {};
  rows.forEach((r) => (map[r.key] = r.value));
  return NextResponse.json({
    settings: {
      soul: map.soul ?? DEFAULT_SOUL,
      userName: map.userName ?? "",
      voiceEnabled: map.voiceEnabled ?? "true",
      autoListen: map.autoListen ?? "true",
      speechRate: map.speechRate ?? "1",
      voiceGender: map.voiceGender ?? "male",
      language: map.language ?? "en-US",
      volume: map.volume ?? "50",
      voiceName: map.voiceName ?? "",
      githubRepo: map.githubRepo ?? "",
      deviceTarget: map.deviceTarget ?? "",
      deviceTargetName: map.deviceTargetName ?? "",
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const entries = Object.entries(body as Record<string, unknown>).filter(
    ([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean"
  );

  for (const [key, value] of entries) {
    await db.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }

  return NextResponse.json({ ok: true });
}
