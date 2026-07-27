import type { Locale } from "@/lib/site-content";

export function t<T extends { ar: string; en: string }>(item: T, locale: Locale) {
  return locale === "ar" ? item.ar : item.en;
}
