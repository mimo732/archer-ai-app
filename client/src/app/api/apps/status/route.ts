import { NextResponse } from "next/server";
import { existsSync, statSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * Live availability of the downloadable ARCHER apps.
 * The SETTING panel polls this so its download buttons are always truthful:
 *   available  → the button downloads the file directly (no GitHub detour)
 *   not yet    → the panel explains the auto-build pipeline inline
 */

type Target = "windows" | "android";

const LOCAL: Record<Target, { file: string }> = {
  windows: { file: "ARCHER-Windows.zip" },
  android: { file: "ARCHER.apk" },
};

function findLocal(target: Target): number | null {
  const candidates = [
    path.join(process.cwd(), "public", "downloads", LOCAL[target].file),
    path.join(process.cwd(), "client", "public", "downloads", LOCAL[target].file),
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p) && statSync(p).isFile() && statSync(p).size > 0) return statSync(p).size;
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function GET() {
  const windowsSize = findLocal("windows");
  const androidSize = findLocal("android");

  return NextResponse.json(
    {
      windows: {
        available: windowsSize !== null,
        source: windowsSize !== null ? "local" : null,
        name: "ARCHER-Windows.zip",
        sizeBytes: windowsSize,
      },
      android: {
        available: androidSize !== null,
        source: androidSize !== null ? "local" : null,
        name: "ARCHER.apk",
        sizeBytes: androidSize,
      },
      // GitHub Actions auto-build kicks in as soon as the user pushes the repo;
      // /api/apps/download then proxies those artifacts transparently.
      autoBuild: { workflow: "build-release.yml", trigger: "push or tag v*" },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
