import type { DefaultSession } from "next-auth";
import type { WiseMembershipTier } from "@/lib/auth/wise-membership";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id?: string;
      membershipTier?: WiseMembershipTier;
      wiseEmailVerified?: boolean | null;
      wiseId?: string;
      wiseIdentityExpiresAt?: number;
    };
  }

  interface User {
    membershipTier?: WiseMembershipTier;
    wiseEmailVerified?: boolean | null;
    wiseId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    wiseDisplayName?: string | null;
    wiseEmail?: string | null;
    wiseEmailVerified?: boolean | null;
    wiseIdentityExpiresAt?: number;
    wiseSessionExpiresAt?: number;
    wiseImage?: string | null;
    wiseMembershipTier?: WiseMembershipTier;
    wiseSubject?: string;
    wiseUserId?: string;
  }
}

export {};
