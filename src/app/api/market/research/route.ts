import type { Asset } from "@/server/data/contracts/market-data";
import { isChartCandleInterval } from "@/server/data/services/live-chart-service";
import { loadAssetResearchSnapshot } from "@/server/data/services/public-research-service";
import { requireWiseApiAccount } from "@/server/auth/wise-route-access";

export const dynamic = "force-dynamic";

// Normalized provider data is shared in the service cache, while this
// identity-gated response must never enter a public browser or CDN cache.
const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
} as const;

export async function GET(request: Request): Promise<Response> {
  const authenticationFailure = await requireWiseApiAccount();
  if (authenticationFailure) return authenticationFailure;

  const params = new URL(request.url).searchParams;
  const allowed = new Set(["asset", "interval"]);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) return invalidRequest();
  }
  const asset = parseAsset(params.get("asset"));
  const interval = params.get("interval");
  if (asset === null || !isChartCandleInterval(interval)) return invalidRequest();

  try {
    const snapshot = await loadAssetResearchSnapshot(asset, interval);
    return Response.json(snapshot, { status: 200, headers: responseHeaders });
  } catch {
    return Response.json(
      { error: "research_unavailable", message: "行情研究暂时无法更新，请稍后重试。" },
      { status: 503, headers: responseHeaders },
    );
  }
}

function parseAsset(value: string | null): Asset | null {
  return value === "btc" || value === "eth" ? value : null;
}

function invalidRequest(): Response {
  return Response.json(
    { error: "invalid_request", message: "只支持 btc / eth 与 15m / 1h / 4h / 1d 行情研究请求。" },
    { status: 400, headers: responseHeaders },
  );
}
