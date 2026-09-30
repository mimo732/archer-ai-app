import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Device → website: report the result of an executed command. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const commandId = String(body.commandId ?? "");
    if (!commandId) return NextResponse.json({ error: "commandId required" }, { status: 400 });

    const status = body.status === "failed" ? "failed" : "done";
    const result = String(body.result ?? "").slice(0, 500);

    await db.deviceCommand.update({
      where: { id: commandId },
      data: { status, result },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
