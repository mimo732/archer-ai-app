import { NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "fs";
import { Readable } from "stream";
import path from "path";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * DIRECT app downloads — no GitHub page navigation, ever.
 *   1. locally built artifact (built in-repo)  → streamed straight away
 *   2. GitHub Actions release asset (if the user configured their repo)
 *      → proxied through this server so the user still just gets a file
 *   3. nothing built yet                        → 404 + friendly hint JSON
 */

type Target = "windows" | "android";

const LOCAL: Record<Target, { file: string; name: string; type: string }> = {
  windows: {
    file: "ARCHER-Windows.zip",
    name: "ARCHER-Windows.zip",
    type: "application/zip",
  },
  android: {
    file: "ARCHER.apk",
    name: "ARCHER.apk",
    type: "application/vnd.android.package-archive",
  },
};

function findLocal(target: Target): string | null {
  // dev server runs from client/ ; be defensive about cwd anyway
  const candidates = [
    path.join(process.cwd(), "public", "downloads", LOCAL[target].file),
    path.join(process.cwd(), "client", "public", "downloads", LOCAL[target].file),
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p) && statSync(p).isFile() && statSync(p).size > 0) return p;
    } catch {
      /* try next */
    }
  }
  return null;
}

function headersFor(target: Target, sizeBytes?: number, source = "local") {
  const h: Record<string, string> = {
    "Content-Type": LOCAL[target].type,
    "Content-Disposition": `attachment; filename="${LOCAL[target].name}"`,
    "Cache-Control": "no-store",
    "X-Archer-Source": source,
  };
  if (sizeBytes) h["Content-Length"] = String(sizeBytes);
  return h;
}

async function githubAssetUrl(
  target: Target
): Promise<{ url: string; size: number; tag: string } | null> {
  try {
    const rows = await db.setting.findMany();
    const repo = (rows.find((r) => r.key === "githubRepo")?.value ?? "")
      .trim()
      .replace(/^https?:\/\/github\.com\//i, "")
      .replace(/\.git$/, "");
    if (!repo || !/^[^/\s]+\/[^/\s]+$/.test(repo)) return null;

    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "ARCHER-AI-website" },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      tag_name?: string;
      assets?: { name: string; size: number; browser_download_url: string }[];
    };
    const ext = target === "windows" ? ".zip" : ".apk";
    const asset = (j.assets ?? []).find((a) => a.name.toLowerCase().endsWith(ext));
    if (!asset) return null;
    return { url: asset.browser_download_url, size: asset.size, tag: j.tag_name ?? "" };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const target: Target =
    new URL(req.url).searchParams.get("target") === "android" ? "android" : "windows";

  // 1. local artifact — instant, served from this very website
  const p = findLocal(target);
  if (p) {
    const size = statSync(p).size;
    const stream = Readable.toWeb(createReadStream(p)) as unknown as ReadableStream;
    return new Response(stream, { headers: headersFor(target, size, "local") });
  }

  // 2. CI-built artifact on the user's GitHub Releases — proxied, still no GitHub page
  const gh = await githubAssetUrl(target);
  if (gh) {
    try {
      const upstream = await fetch(gh.url, {
        redirect: "follow",
        signal: AbortSignal.timeout(120000),
        headers: { "User-Agent": "ARCHER-AI-website" },
      });
      if (upstream.ok && upstream.body) {
        return new Response(upstream.body, {
          headers: headersFor(target, gh.size, "github"),
        });
      }
    } catch {
      /* fall through */
    }
  }

  return NextResponse.json(
    {
      error: "not_built_yet",
      message:
        "The ARCHER app for this platform is not built yet. It is produced automatically " +
        "(locally or by GitHub Actions when the project is pushed). Try again in a moment.",
      target,
    },
    { status: 404, headers: { "Cache-Control": "no-store" } }
  );
}
