/** Keep theme controls usable even when a browser denies localStorage access. */
export type Theme = "dark" | "light";

const key = "rookline-theme";
let inMemoryTheme: Theme = "dark";

export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(key);
    if (saved === "dark" || saved === "light") {
      inMemoryTheme = saved;
      return saved;
    }
  } catch { /* Browser storage may be blocked or unavailable. */ }
  return inMemoryTheme;
}

export function writeTheme(theme: Theme): boolean {
  inMemoryTheme = theme;
  try {
    localStorage.setItem(key, theme);
    return true;
  } catch { return false; }
}
