import type { Asset } from "@/server/data/contracts/market-data";
import { loadAssetLiveChartDatum } from "@/server/data/services/market-data-service";
import {
  isChartCandleInterval,
  isLiveChartMode,
} from "@/server/data/services/live-chart-service";
import { requireWiseApiAccount } from "@/server/auth/wise-route-access";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
} as const;

export async function GET(request: Request): Promise<Response> {
  const authenticationFailure = await requireWiseApiAccount();
  if (authenticationFailure) return authenticationFailure;

  const url = new URL(request.url);
  if (hasUnexpectedOrRepeatedParameters(url.searchParams)) {
    return invalidRequest();
  }

  const asset = parseAsset(url.searchParams.get("asset"));
  const interval = url.searchParams.get("interval");
  const mode = url.searchParams.get("mode") ?? "tail";
  if (
    asset === null ||
    !isChartCandleInterval(interval) ||
    !isLiveChartMode(mode)
  ) {
    return invalidRequest();
  }

  const datum = await loadAssetLiveChartDatum(asset, interval, mode);
  return Response.json(datum, { status: 200, headers: responseHeaders });
}

function parseAsset(value: string | null): Asset | null {
  return value === "btc" || value === "eth" ? value : null;
}

function hasUnexpectedOrRepeatedParameters(params: URLSearchParams): boolean {
  const allowed = new Set(["asset", "interval", "mode"]);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) {
      return true;
    }
  }
  return false;
}

function invalidRequest(): Response {
  return Response.json(
    {
      error: "invalid_request",
      message: "只支持 btc / eth 与 15m / 1h / 4h / 1d K 线请求。",
    },
    { status: 400, headers: responseHeaders },
  );
}
