import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const REMEMBER_KEY = "saarly-merchant-remember-session";

const browserStorage = {
  getItem(key: string) {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window === "undefined") return;
    const remember = window.localStorage.getItem(REMEMBER_KEY) === "1";
    const primary = remember ? window.localStorage : window.sessionStorage;
    const secondary = remember ? window.sessionStorage : window.localStorage;
    secondary.removeItem(key);
    primary.setItem(key, value);
  },
  removeItem(key: string) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export function setMerchantRememberSession(remember: boolean) {
  if (typeof window === "undefined") return;
  if (remember) window.localStorage.setItem(REMEMBER_KEY, "1");
  else window.localStorage.removeItem(REMEMBER_KEY);
}

export function merchantRememberSessionEnabled() {
  return typeof window !== "undefined" && window.localStorage.getItem(REMEMBER_KEY) === "1";
}

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = supabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: browserStorage,
      },
    })
  : null;
