import type { NextRequest } from "next/server";
import { wiseAuthHandlers } from "@/auth";
import { isWiseAuthConfigured } from "@/server/auth/wise-auth-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isWiseAuthConfigured()) return authUnavailable();
  return wiseAuthHandlers.GET(request);
}

export async function POST(request: NextRequest) {
  if (!isWiseAuthConfigured()) return authUnavailable();
  return wiseAuthHandlers.POST(request);
}

function authUnavailable(): Response {
  return Response.json(
    { error: "wise_auth_unavailable" },
    {
      status: 503,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
