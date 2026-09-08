import { describe, expect, it } from "vitest";
import { isPrivateStudioPath } from "@/components/layout/public-chrome-boundary";

describe("public chrome route boundary", () => {
  it.each(["/studio", "/studio/strategies", "/studio/strategies/history"])(
    "hides public navigation from private path %s",
    (pathname) => {
      expect(isPrivateStudioPath(pathname)).toBe(true);
    },
  );

  it.each(["/", "/btc", "/eth", "/tools", "/studio-fake"])(
    "keeps public navigation on %s",
    (pathname) => {
      expect(isPrivateStudioPath(pathname)).toBe(false);
    },
  );
});
