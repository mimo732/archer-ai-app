import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface SearchResult {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
  date: string;
}

async function searchNews() {
  const zai = await ZAI.create();
  const results = (await zai.functions.invoke("web_search", {
    query: "top news headlines today world",
    num: 8,
    recency_days: 1,
  })) as SearchResult[];

  return results;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "1";

    // check cache: if headlines fetched in last 30 min, reuse
    const latest = await db.headline.findFirst({ orderBy: { createdAt: "desc" } });
    if (!force && latest && Date.now() - latest.createdAt.getTime() < 30 * 60 * 1000) {
      const cached = await db.headline.findMany({ orderBy: { createdAt: "desc" }, take: 8 });
      return NextResponse.json({ headlines: cached, cached: true });
    }

    const results = await searchNews();
    if (!results || results.length === 0) {
      return NextResponse.json({ headlines: [], cached: false });
    }

    // refresh cache
    await db.headline.deleteMany({});
    const created = await Promise.all(
      results.slice(0, 8).map((r) =>
        db.headline.create({
          data: {
            title: r.name.slice(0, 300),
            source: r.host_name.slice(0, 100),
            url: r.url,
          },
        })
      )
    );

    return NextResponse.json({ headlines: created, cached: false });
  } catch (err) {
    console.error("headlines error:", err);
    const cached = await db.headline.findMany({ orderBy: { createdAt: "desc" }, take: 8 }).catch(() => []);
    return NextResponse.json({ headlines: cached, error: "fetch_failed" });
  }
}
