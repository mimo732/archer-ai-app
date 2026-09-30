import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const ALLOWED_ACTIONS = new Set([
  "open_app",
  "open_url",
  "search_web",
  "play_youtube",
  "notify",
  "sys_info",
  "ping",
]);

/**
 * Website → device. Queue a command for one device or broadcast to
 * every online device. Body: { deviceId | target:"all", action, payload }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action ?? "").trim();
    if (!ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json({ error: `unsupported action: ${action}` }, { status: 400 });
    }
    const payload = JSON.stringify(body.payload ?? {});

    const target = body.deviceId ? String(body.deviceId) : body.target === "all" ? "all" : "";
    if (!target) {
      return NextResponse.json({ error: "deviceId or target:'all' required" }, { status: 400 });
    }

    if (target === "all") {
      const devices = await db.device.findMany();
      const live = devices.filter(
        (d) => Date.now() - new Date(d.lastSeen).getTime() < 70_000
      );
      await db.deviceCommand.createMany({
        data: live.map((d) => ({ deviceId: d.id, action, payload })),
      });
      return NextResponse.json({ ok: true, queued: live.length });
    }

    const device = await db.device.findUnique({ where: { id: target } });
    if (!device) return NextResponse.json({ error: "device not found" }, { status: 404 });

    const cmd = await db.deviceCommand.create({
      data: { deviceId: target, action, payload },
    });
    return NextResponse.json({ ok: true, queued: 1, commandId: cmd.id });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}

/**
 * Device → website. Fetch my pending commands (oldest first).
 * The device dedupes by id and acks each one after execution.
 */
export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("deviceId");
  if (!deviceId) return NextResponse.json({ error: "deviceId required" }, { status: 400 });

  // treat the poll itself as a heartbeat
  await db.device.updateMany({
    where: { id: deviceId },
    data: { lastSeen: new Date() },
  });

  const rows = await db.deviceCommand.findMany({
    where: { deviceId, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  return NextResponse.json({
    commands: rows.map((r) => ({
      id: r.id,
      action: r.action,
      payload: JSON.parse(r.payload || "{}"),
    })),
  });
}
