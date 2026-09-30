import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const memories = await db.memoryItem.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ memories });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const content = (body.content ?? "").toString().trim();
  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });
  const memory = await db.memoryItem.create({ data: { content: content.slice(0, 500) } });
  return NextResponse.json({ memory });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (id === "all") {
    await db.memoryItem.deleteMany({});
    return NextResponse.json({ ok: true, wiped: true });
  }
  try {
    await db.memoryItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "memory not found" }, { status: 404 });
  }
}
