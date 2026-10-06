import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

const ThemeContext = createContext(null);

const STORAGE_KEY = "arthaleads_theme";

function paint(theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem(STORAGE_KEY) || "light");
  const current = useRef(theme);

  useEffect(() => {
    current.current = theme;
    paint(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Switching used to fade every element on the page for 350ms (a global CSS
  // transition on colours and shadows), which with this many blurred panels
  // made the switch crawl. Now the page flips at once and the browser
  // cross-fades a single snapshot of it, which costs almost nothing. Browsers
  // without that API, and people who ask for reduced motion, get a plain flip.
  const setTheme = useCallback((next) => {
    if (next === current.current) return;
    const apply = () => { paint(next); flushSync(() => setThemeState(next)); };
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (document.startViewTransition && !reduce) document.startViewTransition(apply);
    else apply();
  }, []);

  const value = useMemo(() => ({
    theme,
    setTheme,
    toggleTheme: () => setTheme(current.current === "dark" ? "light" : "dark"),
    isDark: theme === "dark",
  }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
