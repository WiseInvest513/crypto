import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  getNextTheme,
  parseThemePreference,
  resolveThemePreference,
  THEME_INITIALIZATION_SCRIPT,
  THEME_STORAGE_KEY,
} from "@/lib/theme/theme-preference";

type InitializerOptions = {
  stored?: string | null;
  prefersDark?: boolean;
  storageThrows?: boolean;
};

function runThemeInitializer({
  stored = null,
  prefersDark = false,
  storageThrows = false,
}: InitializerOptions = {}) {
  const root = {
    dataset: {} as Record<string, string>,
    style: {} as Record<string, string>,
  };

  runInNewContext(THEME_INITIALIZATION_SCRIPT, {
    document: { documentElement: root },
    window: {
      localStorage: {
        getItem(key: string) {
          expect(key).toBe(THEME_STORAGE_KEY);
          if (storageThrows) {
            throw new Error("storage unavailable");
          }
          return stored;
        },
      },
      matchMedia(query: string) {
        expect(query).toBe("(prefers-color-scheme: dark)");
        return { matches: prefersDark };
      },
    },
  });

  return root;
}

describe("theme preference foundation", () => {
  it("uses a versioned storage key and accepts only supported values", () => {
    expect(THEME_STORAGE_KEY).toMatch(/v\d+$/);
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("system")).toBeNull();
    expect(parseThemePreference(null)).toBeNull();
  });

  it("prefers an explicit selection and otherwise follows the operating system", () => {
    expect(resolveThemePreference("light", true)).toBe("light");
    expect(resolveThemePreference("dark", false)).toBe("dark");
    expect(resolveThemePreference(null, true)).toBe("dark");
    expect(resolveThemePreference(null, false)).toBe("light");
    expect(getNextTheme("light")).toBe("dark");
    expect(getNextTheme("dark")).toBe("light");
  });

  it("initializes the document from stored light/dark values before paint", () => {
    expect(runThemeInitializer({ stored: "dark" })).toEqual({
      dataset: { theme: "dark" },
      style: { colorScheme: "dark" },
    });
    expect(
      runThemeInitializer({ stored: "light", prefersDark: true }),
    ).toEqual({
      dataset: { theme: "light" },
      style: { colorScheme: "light" },
    });
  });

  it("falls back to the system preference for missing, invalid, or blocked storage", () => {
    expect(runThemeInitializer({ prefersDark: true }).dataset.theme).toBe(
      "dark",
    );
    expect(
      runThemeInitializer({ stored: "sepia", prefersDark: false }).dataset
        .theme,
    ).toBe("light");
    expect(
      runThemeInitializer({ storageThrows: true, prefersDark: true }).dataset
        .theme,
    ).toBe("dark");
  });
});
