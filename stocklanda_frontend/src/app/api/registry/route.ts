import { NextResponse } from "next/server";
import { readRegistry } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serve the chain registry to the client. The registry lives at REGISTRY_PATH
 * (e.g. /data/registry.json in Docker) and isn't part of the public bundle, so
 * the client can't fetch "/registry.json" directly.
 */
export async function GET() {
  const registry = readRegistry();
  if (!registry) {
    return NextResponse.json(
      { error: "registry not configured" },
      { status: 404 }
    );
  }
  return NextResponse.json(registry);
}
