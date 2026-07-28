"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Locale } from "@/lib/site-content";

type ThemeMode = "light" | "dark" | "system";
type Preferences = {
  locale: Locale;
  theme: ThemeMode;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemeMode) => void;
};

const noop = () => undefined;
const fallbackPreferences: Preferences = { locale: "ar", theme: "system", setLocale: noop, setTheme: noop };
const Context = createContext<Preferences>(fallbackPreferences);

function apply(locale: Locale, theme: ThemeMode) {
  const root = document.documentElement;
  root.lang = locale;
  root.dir = locale === "ar" ? "rtl" : "ltr";
  root.dataset.theme = theme;
  root.style.colorScheme = theme === "system" ? "light dark" : theme;
}

function readStoredPreferences(): { locale: Locale; theme: ThemeMode } {
  if (typeof window === "undefined") return { locale: "ar", theme: "system" };
  const locale: Locale = window.localStorage.getItem("saarly-locale") === "en" ? "en" : "ar";
  const storedTheme = window.localStorage.getItem("saarly-theme");
  const theme: ThemeMode = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "system";
  return { locale, theme };
}

export function SitePreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ar");
  const [theme, setThemeState] = useState<ThemeMode>("system");

  useEffect(() => {
    const stored = readStoredPreferences();
    setLocaleState(stored.locale);
    setThemeState(stored.theme);
    apply(stored.locale, stored.theme);
  }, []);

  function setLocale(next: Locale) {
    localStorage.setItem("saarly-locale", next);
    setLocaleState(next);
    apply(next, theme);
  }

  function setTheme(next: ThemeMode) {
    localStorage.setItem("saarly-theme", next);
    setThemeState(next);
    apply(locale, next);
  }

  const value = useMemo(() => ({ locale, theme, setLocale, setTheme }), [locale, theme]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSitePreferences() {
  return useContext(Context);
}
