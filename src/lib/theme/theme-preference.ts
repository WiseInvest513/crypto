export const THEME_STORAGE_KEY = "wise-crypto.theme.v1";
export const DARK_THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export const DEFAULT_THEME = "light";

export type ThemePreference = "light" | "dark";

export function parseThemePreference(value: unknown): ThemePreference | null {
  return value === "light" || value === "dark" ? value : null;
}

export function resolveThemePreference(
  storedPreference: unknown,
  prefersDark: boolean,
): ThemePreference {
  return (
    parseThemePreference(storedPreference) ??
    (prefersDark ? "dark" : DEFAULT_THEME)
  );
}

export function getNextTheme(theme: unknown): ThemePreference {
  return parseThemePreference(theme) === "dark" ? "light" : "dark";
}

const serializedStorageKey = JSON.stringify(THEME_STORAGE_KEY);
const serializedMediaQuery = JSON.stringify(DARK_THEME_MEDIA_QUERY);

/**
 * Runs synchronously in the document head so the first painted frame already
 * uses the persisted theme, or the operating-system preference when none was
 * explicitly stored.
 */
export const THEME_INITIALIZATION_SCRIPT =
  `(function(){var stored=null;try{stored=window.localStorage.getItem(${serializedStorageKey});}catch(error){}` +
  `var theme=stored==="light"||stored==="dark"?stored:"light";` +
  `if(stored!=="light"&&stored!=="dark"){try{theme=window.matchMedia&&window.matchMedia(${serializedMediaQuery}).matches?"dark":"light";}catch(error){theme="light";}}` +
  `var root=document.documentElement;root.dataset.theme=theme;root.style.colorScheme=theme;})();`;
