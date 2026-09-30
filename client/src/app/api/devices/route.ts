import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** A device is "online" if it checked in within this window (ms). */
export const ONLINE_WINDOW_MS = 70_000;

function serialize(d: { id: string; name: string; platform: string; version: string; lastSeen: Date }) {
  const online = Date.now() - new Date(d.lastSeen).getTime() < ONLINE_WINDOW_MS;
  return {
    id: d.id,
    name: d.name,
    platform: d.platform,
    version: d.version,
    lastSeen: d.lastSeen,
    online,
  };
}

/** List every linked device with live online status. */
export async function GET() {
  const devices = await db.device.findMany({ orderBy: { lastSeen: "desc" } });
  return NextResponse.json({ devices: devices.map(serialize) });
}

/**
 * Register or heartbeat a device. Installed ARCHER apps (Electron on
 * Windows, Capacitor on Android) call this with their identity; the
 * same endpoint doubles as the keep-alive heartbeat.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = String(body.deviceId ?? "").trim();
    if (!id) return NextResponse.json({ error: "deviceId required" }, { status: 400 });

    const name = String(body.name ?? "Unknown device").slice(0, 80);
    const platform = String(body.platform ?? "web").slice(0, 20);
    const version = String(body.version ?? "").slice(0, 20);

    await db.device.upsert({
      where: { id },
      update: { name, platform, version, lastSeen: new Date() },
      create: { id, name, platform, version },
    });

    const pending = await db.deviceCommand.count({ where: { deviceId: id, status: "pending" } });
    return NextResponse.json({ ok: true, serverTime: new Date().toISOString(), pending });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}

/** Unlink a device (also deletes its queued commands via cascade). */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("deviceId");
  if (!id) return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  await db.device.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
