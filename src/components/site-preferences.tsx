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

const Context = createContext<Preferences | null>(null);

function apply(locale: Locale, theme: ThemeMode) {
  const root = document.documentElement;
  root.lang = locale;
  root.dir = locale === "ar" ? "rtl" : "ltr";
  root.dataset.theme = theme;
}

export function SitePreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ar");
  const [theme, setThemeState] = useState<ThemeMode>("system");

  useEffect(() => {
    const storedLocale = localStorage.getItem("saarly-locale") === "en" ? "en" : "ar";
    const storedTheme = localStorage.getItem("saarly-theme");
    const nextTheme: ThemeMode = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "system";
    setLocaleState(storedLocale);
    setThemeState(nextTheme);
    apply(storedLocale, nextTheme);
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
  const value = useContext(Context);
  if (!value) throw new Error("SitePreferencesProvider_missing");
  return value;
}

