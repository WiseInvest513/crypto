import { getWiseAuthConfigurationStatus } from "@/server/auth/wise-auth-config";
import { resolveWiseAccountState } from "@/server/auth/wise-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const configurationStatus = getWiseAuthConfigurationStatus();
  if (configurationStatus === "disabled") {
    return accountResponse({ status: "disabled" });
  }
  if (configurationStatus === "misconfigured") {
    return accountResponse({ status: "error" }, 503);
  }

  const result = await resolveWiseAccountState();
  if (result.status === "error") {
    return accountResponse({ status: "error" }, 503);
  }
  if (result.status !== "authenticated") {
    return accountResponse({ status: result.status });
  }

  const { account } = result;

  return accountResponse({
    status: "authenticated",
    displayName: account.displayName,
    email: account.email,
    emailVerified: account.emailVerified,
    imageUrl: account.imageUrl,
    label: account.label,
    membershipTier: account.membershipTier,
    tier: account.principal.tier,
    wiseId: account.wiseId,
  });
}

function accountResponse(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Cookie",
    },
  });
}
