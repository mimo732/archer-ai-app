import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const tasks = await db.task.findMany({ orderBy: [{ done: "asc" }, { createdAt: "desc" }] });
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const title = (body.title ?? "").toString().trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const task = await db.task.create({ data: { title: title.slice(0, 200) } });
  return NextResponse.json({ task });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = (body.id ?? "").toString();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    const task = await db.task.update({ where: { id }, data: { done: !!body.done } });
    return NextResponse.json({ task });
  } catch {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    if (id === "all") {
      // "Clear Completed" — remove only finished tasks, keep pending ones
      const res = await db.task.deleteMany({ where: { done: true } });
      return NextResponse.json({ ok: true, deleted: res.count });
    }
    await db.task.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }
}
