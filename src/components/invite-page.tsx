"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
import { useSitePreferences } from "@/components/site-preferences";
import { referralCodeFromBrowser, rememberReferralCode } from "@/lib/referrals";

export function InvitePage() {
  const { locale, setLocale, theme, setTheme } = useSitePreferences();
  const [code] = useState(referralCodeFromBrowser);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    rememberReferralCode(code);
  }, [code]);

  const links = useMemo(() => {
    const query = code ? `?code=${encodeURIComponent(code)}` : "";
    const registerQuery = code ? `?ref=${encodeURIComponent(code)}` : "";
    return {
      app: `saarly://invite${query}`,
      merchantRegister: `/merchant-register${registerQuery}`,
      buyerRegister: `/login${registerQuery}`,
    };
  }, [code]);

  async function copyCode() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="auth-page">
      <div className="auth-top">
        <Brand locale={locale} />
        <div>
          <button
            className="icon-button"
            type="button"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
          >
            <Icon name="globe" />
            <span>{locale === "ar" ? "EN" : "ع"}</span>
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
        </div>
      </div>

      <section className="auth-card otp-auth-card">
        <span className="eyebrow">
          <Icon name="users" />
          {locale === "ar" ? "دعوة سعرلي" : "Saarly invite"}
        </span>
        <h1>
          {locale === "ar"
            ? "ابدأ من دعوة سعرلي"
            : "Start with a Saarly invite"}
        </h1>
        <p>
          {locale === "ar"
            ? "افتح التطبيق مباشرة، أو سجّل متجرك من الموقع. ستُحتسب الإحالة بعد قبول المتجر من الإدارة."
            : "Open the app directly, or register your store on the web. The referral is counted after admin approval."}
        </p>

        {code ? (
          <button className="button secondary full" type="button" onClick={copyCode}>
            <Icon name="card" />
            {copied
              ? locale === "ar"
                ? "تم نسخ الكود"
                : "Code copied"
              : `${locale === "ar" ? "كود الدعوة" : "Invite code"}: ${code}`}
          </button>
        ) : (
          <p className="form-notice">
            {locale === "ar"
              ? "رابط الدعوة لا يحتوي على كود صالح."
              : "This invite link does not include a valid code."}
          </p>
        )}

        <a className="button primary full" href={links.app}>
          <Icon name="phone" />
          {locale === "ar" ? "فتح التطبيق" : "Open the app"}
        </a>
        <Link className="button secondary full" href={links.merchantRegister}>
          <Icon name="store" />
          {locale === "ar" ? "تسجيل متجر جديد" : "Register a new store"}
        </Link>
        <Link className="button text-button full" href={links.buyerRegister}>
          {locale === "ar" ? "دخول كمشتري" : "Continue as buyer"}
        </Link>
      </section>
    </main>
  );
}
