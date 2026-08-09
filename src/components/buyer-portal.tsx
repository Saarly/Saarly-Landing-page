"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
import { buyerGet } from "@/components/buyer/portal-client";
import { BuyerAlertsSection } from "@/components/buyer/sections/alerts-section";
import { BuyerFavoritesSection } from "@/components/buyer/sections/favorites-section";
import { BuyerHomeSection } from "@/components/buyer/sections/home-section";
import { BuyerNotificationsSection } from "@/components/buyer/sections/notifications-section";
import { BuyerOrdersSection } from "@/components/buyer/sections/orders-section";
import { BuyerReferralsSection } from "@/components/buyer/sections/referrals-section";
import { BuyerRequestsSection } from "@/components/buyer/sections/requests-section";
import { BuyerSettingsSection } from "@/components/buyer/sections/settings-section";
import { BuyerStoresSection } from "@/components/buyer/sections/stores-section";
import { BuyerSupportSection } from "@/components/buyer/sections/support-section";
import { humanError, text, type PortalPayload } from "@/components/merchant/portal-utils";
import { useSitePreferences } from "@/components/site-preferences";
import { buyerLinks } from "@/lib/content";
import { supabase, supabaseConfigured } from "@/lib/supabase";

const icons: Record<string, Parameters<typeof Icon>[0]["name"]> = {
  home: "dashboard", requests: "quote", orders: "receipt", stores: "store", favorites: "target", alerts: "bell", notifications: "bell", referrals: "users", support: "quote", settings: "settings",
};
const titles: Record<string, { ar: string; en: string; bodyAr: string; bodyEn: string }> = {
  home: { ar: "الرئيسية", en: "Buyer home", bodyAr: "ملخص الطلبات والعروض والإشعارات وأسرع طرق بدء طلب جديد.", bodyEn: "A summary of requests, offers, notifications, and quick ways to start a new request." },
  requests: { ar: "طلباتي والعروض", en: "Requests and offers", bodyAr: "طلب يدوي أو صورة أو PDF أو صوت، ثم مراجعة ومقارنة وقبول العروض.", bodyEn: "Manual, image, PDF, or voice requests, followed by review, comparison, and acceptance." },
  orders: { ar: "الطلبات المقبولة", en: "Accepted orders", bodyAr: "تأكيدات المتاجر والبنود والتواصل والمحادثات والتقييمات.", bodyEn: "Store confirmations, items, contact details, chats, and reviews." },
  stores: { ar: "المتاجر والمنتجات", en: "Stores and products", bodyAr: "تصفح حسب القسم والموقع، واحفظ المفضلة والتنبيهات واطلب من متجر محدد.", bodyEn: "Browse by category and location, save favorites and alerts, and request from a specific store." },
  favorites: { ar: "المفضلة", en: "Favorites", bodyAr: "المتاجر والمنتجات وعمليات البحث المحفوظة في حسابك.", bodyEn: "Stores, products, and searches saved to your account." },
  alerts: { ar: "تنبيهات الأسعار", en: "Price alerts", bodyAr: "تابع تغير السعر الحالي وآخر حالة لكل منتج.", bodyEn: "Track current price changes and the latest state for every product." },
  notifications: { ar: "الإشعارات", en: "Notifications", bodyAr: "تحديثات المشتري فقط، مع فتح الصفحة والسجل المطلوب مباشرة.", bodyEn: "Buyer-only updates with direct navigation to the intended page and record." },
  referrals: { ar: "ادعُ أصحابك", en: "Invite friends", bodyAr: "رابط الدعوة والتسجيلات المؤكدة والمكافأة.", bodyEn: "Referral link, confirmed registrations, and rewards." },
  support: { ar: "الدعم والمساعدة", en: "Support", bodyAr: "محادثة سعرلي المتزامنة بين التطبيق والموقع.", bodyEn: "The Saarly conversation synced between the app and website." },
  settings: { ar: "الإعدادات", en: "Settings", bodyAr: "بيانات الحساب والموقع والعملة واللغة والمظهر وإجراءات الحساب.", bodyEn: "Account details, location, currency, language, appearance, and account actions." },
};
type Toast = { id: number; message: string; tone: "success" | "error" | "info" };

export function BuyerPortal({ section = "home" }: { section?: string }) {
  const { locale, setLocale, theme, setTheme } = useSitePreferences();
  const [payload, setPayload] = useState<PortalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const active = titles[section] ? section : "home";

  const notify = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4800);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setPayload(await buyerGet(active) as PortalPayload); }
    catch (loadError) {
      const code = loadError instanceof Error ? loadError.message : "buyer_portal_request_failed";
      if (["authentication_required", "invalid_session"].includes(code)) { window.location.replace("/login"); return; }
      setError(code);
    } finally { setLoading(false); }
  }, [active]);

  useEffect(() => {
    if (!supabaseConfigured) {
      const timer = window.setTimeout(() => {
        setLoading(false);
        setError("supabase_not_configured");
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!payload || typeof window === "undefined") return;
    const focus = new URLSearchParams(window.location.search).get("focus");
    if (!focus) return;
    const timer = window.setTimeout(() => {
      const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(focus) : focus.replace(/[^a-zA-Z0-9_-]/g, "");
      const target = document.querySelector<HTMLElement>(`[data-record-id="${escaped}"]`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" }); target.classList.add("portal-focus-target");
      window.setTimeout(() => target.classList.remove("portal-focus-target"), 3200);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [payload, active]);

  if (loading) return <BuyerState loading title={locale === "ar" ? "جارٍ تجهيز حساب المشتري" : "Preparing your buyer account"} body={locale === "ar" ? "بنحمّل طلباتك وعروضك وبياناتك الآمنة." : "Loading your requests, offers, and secure account data."}/>;
  if (error || !payload) return <BuyerState title={locale === "ar" ? "تعذر فتح حساب المشتري" : "Could not open the buyer portal"} body={humanError(error, locale)} action={<div className="state-actions"><button className="button primary" onClick={() => void load()}>{locale === "ar" ? "إعادة المحاولة" : "Try again"}</button><Link className="button secondary" href="/support">{locale === "ar" ? "الدعم" : "Support"}</Link></div>}/>;

  const profile = payload.account.profile;
  const title = titles[active];
  const unread = Number(payload.account.unreadNotifications ?? 0);
  const hasMerchantPortal = Boolean(payload.account.isOwner && payload.account.merchantId);
  const props = { payload, locale, refresh: load, notify };

  return <main className="portal-app buyer-portal-app">
    <aside className={`portal-sidebar ${mobileNav ? "open" : ""}`} aria-label={locale === "ar" ? "التنقل داخل حساب المشتري" : "Buyer portal navigation"}>
      <div className="portal-brand"><Brand locale={locale} compact inverted/><button className="icon-button sidebar-close" onClick={() => setMobileNav(false)}><Icon name="close"/></button></div>
      <div className="store-identity"><span className="store-avatar"><Icon name="receipt"/></span><div><strong>{text(profile.full_name, locale === "ar" ? "حساب المشتري" : "Buyer account")}</strong><small>{payload.account.email}</small></div></div>
      <nav className="portal-navigation">{buyerLinks.map((link) => { const key = link.href === "/buyer" ? "home" : text(link.href.split("/").pop(), "home"); const isActive = key === active; return <Link key={link.href} href={link.href} className={isActive ? "active" : ""} aria-current={isActive ? "page" : undefined} onClick={() => setMobileNav(false)}><Icon name={icons[key] ?? "dashboard"}/><span>{locale === "ar" ? link.ar : link.en}</span>{key === "notifications" && unread > 0 ? <i>{unread}</i> : null}</Link>; })}</nav>
      <div className="portal-sidebar-footer">{hasMerchantPortal ? <Link href="/merchant"><Icon name="store"/>{locale === "ar" ? "بوابة متجري" : "My store portal"}</Link> : <Link href="/merchant-register"><Icon name="store"/>{locale === "ar" ? "سجل متجرك" : "Register your store"}</Link>}<Link href="/"><Icon name="globe"/>{locale === "ar" ? "الموقع العام" : "Public website"}</Link></div>
    </aside>
    {mobileNav ? <button className="portal-overlay" onClick={() => setMobileNav(false)} aria-label={locale === "ar" ? "إغلاق القائمة" : "Close menu"}/> : null}
    <section className="portal-main"><header className="portal-topbar"><div className="portal-topbar-leading"><button className="icon-button portal-menu" onClick={() => setMobileNav(true)}><Icon name="menu"/></button><span className="status-dot ok"/><span>{locale === "ar" ? `العملة: ${payload.account.currencyCode || "EGP"}` : `Currency: ${payload.account.currencyCode || "EGP"}`}</span></div><div className="portal-top-actions"><button className="icon-button" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}><Icon name="globe"/><span>{locale === "ar" ? "EN" : "ع"}</span></button><button className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><Icon name={theme === "dark" ? "sun" : "moon"}/></button><button className="icon-button" onClick={() => void supabase?.auth.signOut().then(() => window.location.replace("/"))}><Icon name="logout"/><span>{locale === "ar" ? "خروج" : "Sign out"}</span></button></div></header>
      <div className="portal-content"><header className="portal-page-head"><div><span className="page-icon"><Icon name={icons[active] ?? "dashboard"}/></span><div><h1>{locale === "ar" ? title.ar : title.en}</h1><p>{locale === "ar" ? title.bodyAr : title.bodyEn}</p></div></div><button className="button secondary compact" onClick={() => void load()}><Icon name="history" size={17}/>{locale === "ar" ? "تحديث" : "Refresh"}</button></header>
        {active === "home" ? <BuyerHomeSection {...props}/> : active === "requests" ? <BuyerRequestsSection {...props}/> : active === "orders" ? <BuyerOrdersSection {...props}/> : active === "stores" ? <BuyerStoresSection {...props}/> : active === "favorites" ? <BuyerFavoritesSection {...props}/> : active === "alerts" ? <BuyerAlertsSection {...props}/> : active === "notifications" ? <BuyerNotificationsSection {...props}/> : active === "referrals" ? <BuyerReferralsSection {...props}/> : active === "support" ? <BuyerSupportSection {...props}/> : <BuyerSettingsSection {...props}/>} 
      </div>
    </section>
    <div className="toast-stack" aria-live="polite">{toasts.map((toast) => <div className={`portal-toast ${toast.tone}`} key={toast.id}><Icon name={toast.tone === "success" ? "check" : "info"}/><span>{/^[a-z0-9_:. -]+$/i.test(toast.message) ? humanError(toast.message, locale) : toast.message}</span><button onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}><Icon name="close" size={16}/></button></div>)}</div>
  </main>;
}

function BuyerState({ title, body, loading = false, action }: { title: string; body: string; loading?: boolean; action?: React.ReactNode }) {
  return <main className="portal-state"><Brand locale="ar"/><section className="portal-state-card">{loading ? <span className="spinner"/> : <span className="page-icon"><Icon name="receipt"/></span>}<h1>{title}</h1><p>{body}</p>{action}</section></main>;
}
