"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import {
  DARK_THEME_MEDIA_QUERY,
  DEFAULT_THEME,
  getNextTheme,
  parseThemePreference,
  resolveThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme/theme-preference";

const themeListeners = new Set<() => void>();
let volatilePreference: ThemePreference | null = null;

function readStoredPreference() {
  try {
    return (
      parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY)) ??
      volatilePreference
    );
  } catch {
    return volatilePreference;
  }
}

function prefersDarkTheme() {
  try {
    return window.matchMedia(DARK_THEME_MEDIA_QUERY).matches;
  } catch {
    return false;
  }
}

function resolveClientTheme() {
  return resolveThemePreference(readStoredPreference(), prefersDarkTheme());
}

function getThemeSnapshot() {
  return (
    parseThemePreference(document.documentElement.dataset.theme) ??
    resolveClientTheme()
  );
}

function getServerThemeSnapshot() {
  return DEFAULT_THEME;
}

function publishTheme(theme: ThemePreference) {
  const root = document.documentElement;
  const changed = root.dataset.theme !== theme;

  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  if (changed) {
    themeListeners.forEach((listener) => listener());
  }
}

function subscribeToTheme(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(DARK_THEME_MEDIA_QUERY);

  themeListeners.add(onStoreChange);

  const handleMediaChange = (event: MediaQueryListEvent) => {
    if (readStoredPreference() === null) {
      publishTheme(event.matches ? "dark" : "light");
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) {
      return;
    }

    volatilePreference = parseThemePreference(event.newValue);
    publishTheme(
      resolveThemePreference(volatilePreference, mediaQuery.matches),
    );
  };

  mediaQuery.addEventListener("change", handleMediaChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    themeListeners.delete(onStoreChange);
    mediaQuery.removeEventListener("change", handleMediaChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  // React Strict Mode can restore the server's <html> attributes in development.
  // Re-applying here keeps development behavior aligned with the pre-paint script.
  useLayoutEffect(() => {
    publishTheme(resolveClientTheme());
  }, []);

  const nextThemeLabel =
    theme === "dark" ? "切换到浅色模式" : "切换到深色模式";

  function toggleTheme() {
    const nextTheme = getNextTheme(getThemeSnapshot());
    volatilePreference = nextTheme;

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The current page can still honor the choice when storage is unavailable.
    }

    publishTheme(nextTheme);
  }

  return (
    <button
      type="button"
      className="site-header__theme-toggle"
      aria-label={nextThemeLabel}
      aria-pressed={theme === "dark"}
      title={nextThemeLabel}
      onClick={toggleTheme}
    >
      <svg
        className="site-header__theme-icon site-header__theme-icon--moon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M20.2 15.1A8.4 8.4 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z" />
      </svg>
      <svg
        className="site-header__theme-icon site-header__theme-icon--sun"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2.25v2M12 19.75v2M21.75 12h-2M4.25 12h-2M18.9 5.1l-1.4 1.4M6.5 17.5l-1.4 1.4M18.9 18.9l-1.4-1.4M6.5 6.5 5.1 5.1" />
      </svg>
    </button>
  );
}
