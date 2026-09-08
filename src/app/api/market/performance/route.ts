import { loadAssetPerformanceSnapshot } from "@/server/data/services/price-performance-service";
import { requireWiseApiAccount } from "@/server/auth/wise-route-access";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
} as const;

export async function GET(request: Request): Promise<Response> {
  const authenticationFailure = await requireWiseApiAccount();
  if (authenticationFailure) return authenticationFailure;

  const params = new URL(request.url).searchParams;
  const asset = params.get("asset");
  if ((asset !== "btc" && asset !== "eth") || [...params.keys()].some((key) => key !== "asset" || params.getAll(key).length !== 1)) {
    return Response.json({ error: "invalid_request", message: "只支持 btc / eth 行情涨跌请求。" }, { status: 400, headers });
  }
  try {
    return Response.json(await loadAssetPerformanceSnapshot(asset), { status: 200, headers });
  } catch {
    return Response.json({ error: "performance_unavailable", message: "涨跌数据暂时无法更新，请稍后重试。" }, { status: 503, headers });
  }
}
