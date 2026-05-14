import { createContext, useContext, useState, useEffect } from "react";

const PublicThemeContext = createContext();

export function PublicThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("public_theme") === "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-public-theme", isDark ? "dark" : "light");
    localStorage.setItem("public_theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <PublicThemeContext.Provider value={{ isDark, toggle: () => setIsDark(d => !d) }}>
      {children}
    </PublicThemeContext.Provider>
  );
}

export const usePublicTheme = () => useContext(PublicThemeContext);
