import { NextResponse } from "next/server";
import { WISE_INVEST_CRYPTO_PERKS_URL } from "@/config/site";

export function proxy() {
  return NextResponse.redirect(WISE_INVEST_CRYPTO_PERKS_URL, 308);
}

export const config = {
  matcher: "/products/:path*",
};
