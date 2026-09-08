import type { DefaultSession } from "next-auth";
import type { WiseMembershipTier } from "@/lib/auth/wise-membership";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id?: string;
      membershipTier?: WiseMembershipTier;
    };
  }

  interface User {
    membershipTier?: WiseMembershipTier;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    wiseIdentityExpiresAt?: number;
    wiseMembershipTier?: WiseMembershipTier;
    wiseSubject?: string;
  }
}

export {};
