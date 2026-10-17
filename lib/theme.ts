/**
 * Light / dark theme for the staff app and portal. Light is the default;
 * the choice is kept per browser in localStorage and applied as
 * <html data-theme="dark"> (app/globals.css redefines the tokens there).
 */
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "hok-theme";

/** Runs in <head> before the first paint. Tiny and dependency-free on purpose. */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

export function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Applies and remembers a theme. Storage can be blocked (private mode); the switch still works for the visit. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "dark") root.dataset.theme = "dark";
  else delete root.dataset.theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore: the theme just won't be remembered
  }
}
