import "server-only";

import type { IdentityAdapter } from "@/server/access/resolve-user-access";
import { resolveWiseAccount } from "@/server/auth/wise-session";

export const wiseIdentityAdapter: IdentityAdapter = Object.freeze({
  async resolveIdentity() {
    return (await resolveWiseAccount())?.principal ?? null;
  },
});
