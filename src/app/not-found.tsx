"use client";

import Link from "next/link";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
import { useSitePreferences } from "@/components/site-preferences";

export default function NotFound() {
  const { locale } = useSitePreferences();
  return (
    <main className="portal-state">
      <Brand locale={locale} />
      <section className="portal-state-card">
        <span className="page-icon"><Icon name="search" /></span>
        <h1>{locale === "ar" ? "الصفحة غير موجودة" : "Page not found"}</h1>
        <p>{locale === "ar" ? "الرابط غير صحيح أو تم نقل الصفحة. ارجع للرئيسية أو افتح بوابة المتاجر." : "The link is incorrect or the page has moved. Return home or open the merchant portal."}</p>
        <div className="state-actions">
          <Link className="button primary" href="/">{locale === "ar" ? "الصفحة الرئيسية" : "Home"}</Link>
          <Link className="button secondary" href="/merchant-login">{locale === "ar" ? "دخول المتاجر" : "Merchant login"}</Link>
        </div>
      </section>
    </main>
  );
}
