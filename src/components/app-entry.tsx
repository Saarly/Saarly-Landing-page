"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
import { humanError } from "@/components/merchant/portal-utils";
import { useSitePreferences } from "@/components/site-preferences";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type Status = "loading" | "signed-out" | "routing" | "blocked";

export function AppEntry() {
  const { locale, setLocale, theme, setTheme } = useSitePreferences();
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function routeUser() {
      if (!supabaseConfigured || !supabase) {
        if (mounted) {
          setStatus("blocked");
          setError("supabase_not_configured");
        }
        return;
      }
      const sessionResult = await supabase.auth.getSession();
      const token = sessionResult.data.session?.access_token;
      if (!token) {
        if (mounted) setStatus("signed-out");
        return;
      }
      if (mounted) setStatus("routing");
      const headers = { Authorization: `Bearer ${token}` };
      const merchant = await fetch("/api/merchant/portal?section=overview", { headers });
      if (merchant.ok) {
        window.location.replace("/merchant");
        return;
      }
      const buyer = await fetch("/api/buyer/portal?section=home", { headers });
      if (buyer.ok) {
        window.location.replace("/buyer");
        return;
      }
      const [merchantBody, buyerBody] = await Promise.all([
        merchant.json().catch(() => ({})),
        buyer.json().catch(() => ({})),
      ]);
      const code = String(buyerBody.error || merchantBody.error || "profile_incomplete");
      if (["profile_incomplete", "buyer_access_required"].includes(code)) {
        window.location.replace("/login");
        return;
      }
      if (["merchant_account_required", "merchant_pending_approval", "merchant_registration_rejected"].includes(code)) {
        window.location.replace("/merchant-register");
        return;
      }
      if (mounted) {
        setStatus("blocked");
        setError(code);
      }
    }
    void routeUser();
    return () => {
      mounted = false;
    };
  }, []);

  const title = status === "signed-out"
    ? (locale === "ar" ? "اختار طريقة الدخول" : "Choose how to sign in")
    : status === "blocked"
      ? (locale === "ar" ? "تعذر فتح التطبيق" : "Could not open the app")
      : (locale === "ar" ? "جاري فتح سعرلي" : "Opening Saarly");
  const body = status === "signed-out"
    ? (locale === "ar" ? "استخدم نفس حساب التطبيق كمشتري أو متجر." : "Use the same app account as a buyer or merchant.")
    : status === "blocked"
      ? humanError(error, locale)
      : (locale === "ar" ? "بنراجع حسابك ونفتح المكان المناسب." : "Checking your account and opening the right area.");

  return (
    <main className="portal-state">
      <div className="auth-top app-entry-top">
        <Brand locale={locale} />
        <div>
          <button className="icon-button" type="button" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>
            <Icon name="globe" />
            <span>{locale === "ar" ? "الإنجليزية" : "Arabic"}</span>
          </button>
          <button className="icon-button" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
        </div>
      </div>
      <section className="portal-state-card">
        {status === "loading" || status === "routing" ? <span className="spinner" /> : <span className="page-icon"><Icon name="globe" /></span>}
        <h1>{title}</h1>
        <p>{body}</p>
        {status === "signed-out" ? (
          <div className="state-actions">
            <Link className="button primary" href="/login">{locale === "ar" ? "دخول المشتري" : "Buyer login"}</Link>
            <Link className="button secondary" href="/merchant-login">{locale === "ar" ? "دخول المتجر" : "Merchant login"}</Link>
          </div>
        ) : null}
        {status === "blocked" ? (
          <div className="state-actions">
            <button className="button primary" type="button" onClick={() => window.location.reload()}>{locale === "ar" ? "إعادة المحاولة" : "Try again"}</button>
            <Link className="button secondary" href="/support">{locale === "ar" ? "الدعم" : "Support"}</Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
