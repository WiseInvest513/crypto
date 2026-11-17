import { describe, expect, it } from "vitest";
import {
  mainSiteAuthorizationParams,
  sanitizeAttributionPath,
  withMainSiteAttribution,
} from "@/lib/auth/main-site-attribution";

describe("main site attribution helper", () => {
  it("appends the short Crypto site code and a sanitized path", () => {
    expect(sanitizeAttributionPath("/btc?tab=spot#top")).toBe("/btc?tab=spot");
    expect(sanitizeAttributionPath("javascript:alert(1)")).toBe("/");
    expect(withMainSiteAttribution("https://www.wise-invest.org/account", "/btc")).toBe(
      "https://www.wise-invest.org/account?utm_source=cry&utm_campaign=%2Fbtc",
    );
    expect(withMainSiteAttribution("https://chain.wise-invest.org/", "/btc")).toBe(
      "https://chain.wise-invest.org/",
    );
    expect(mainSiteAuthorizationParams("/exchanges")).toEqual({
      utm_source: "cry",
      utm_campaign: "/exchanges",
    });
  });
});
