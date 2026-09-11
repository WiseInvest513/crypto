import { getWiseAuthConfigurationStatus } from "@/server/auth/wise-auth-config";
import { resolveWiseAccountState } from "@/server/auth/wise-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const result = await resolveWiseAccountState();
  if (result.status === "authenticated") {
    const { account } = result;

    return accountResponse({
      status: "authenticated",
      authenticationSource: account.authenticationSource,
      displayName: account.displayName,
      email: account.email,
      emailVerified: account.emailVerified,
      imageUrl: account.imageUrl,
      label: account.label,
      membershipAccessFresh: account.membershipAccessFresh,
      membershipTier: account.membershipTier,
      tier: account.principal.tier,
      wiseId: account.wiseId,
    });
  }

  const configurationStatus = getWiseAuthConfigurationStatus();
  if (configurationStatus === "misconfigured" || result.status === "error") {
    return accountResponse({ status: "error" }, 503);
  }
  if (configurationStatus === "disabled") {
    return accountResponse({ status: "disabled" });
  }

  return accountResponse({ status: result.status });
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
