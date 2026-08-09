"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
import { buyerGet } from "@/components/buyer/portal-client";
import type { BuyerSectionProps } from "@/components/buyer/section-props";
import { PortalAppShell, PortalBootstrapSkeleton, type PortalNavGroup, type PortalNavItem } from "@/components/portal-v2/portal-shell";
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
import { currencyLabel, humanError, localizedSystemText, text, type PortalPayload } from "@/components/merchant/portal-utils";
import { useSitePreferences } from "@/components/site-preferences";
import { supabase, supabaseConfigured } from "@/lib/supabase";

const icons: Record<string, Parameters<typeof Icon>[0]["name"]> = {
  home: "dashboard", requests: "quote", orders: "receipt", stores: "store", favorites: "target", alerts: "bell", notifications: "bell", referrals: "users", support: "quote", settings: "settings",
};
const titles: Record<string, { ar: string; en: string; bodyAr: string; bodyEn: string }> = {
  home: { ar: "الرئيسية", en: "Buyer home", bodyAr: "ملخص الطلبات والعروض والإشعارات وأسرع طرق بدء طلب جديد.", bodyEn: "A summary of requests, offers, notifications, and quick ways to start a new request." },
  requests: { ar: "طلباتي والعروض", en: "Requests and offers", bodyAr: "طلب يدوي أو صورة أو مستند أو تسجيل صوتي، ثم مراجعة ومقارنة وقبول العروض.", bodyEn: "Manual, image, document, or voice requests, followed by review, comparison, and acceptance." },
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

let buyerPortalCache: { section: string; payload: PortalPayload } | null = null;

export function BuyerPortal({ section = "home" }: { section?: string }) {
  const { locale, setLocale, theme, setTheme } = useSitePreferences();
  const active = titles[section] ? section : "home";
  const cached = buyerPortalCache;
  const [payload, setPayload] = useState<PortalPayload | null>(cached?.payload ?? null);
  const [loading, setLoading] = useState(!cached);
  const [sectionLoading, setSectionLoading] = useState(Boolean(cached && cached.section !== active));
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4800);
  }, []);

  const load = useCallback(async () => {
    const hasWorkspace = Boolean(buyerPortalCache?.payload);
    const changingSection = Boolean(buyerPortalCache && buyerPortalCache.section !== active);
    if (!hasWorkspace) setLoading(true);
    if (hasWorkspace && changingSection) setSectionLoading(true);
    setError("");
    try {
      const nextPayload = await buyerGet(active) as PortalPayload;
      buyerPortalCache = { section: active, payload: nextPayload };
      setPayload(nextPayload);
    } catch (loadError) {
      const code = loadError instanceof Error ? loadError.message : "buyer_portal_request_failed";
      if (["authentication_required", "invalid_session"].includes(code)) { window.location.replace("/login"); return; }
      setError(code);
    } finally {
      setLoading(false);
      setSectionLoading(false);
    }
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

  if (loading) return <PortalBootstrapSkeleton kind="buyer" locale={locale}/>;
  if (!payload) return <BuyerState locale={locale} title={locale === "ar" ? "تعذر فتح حساب المشتري" : "Could not open the buyer account"} body={humanError(error, locale)} action={<div className="state-actions"><button className="button primary" onClick={() => void load()}>{locale === "ar" ? "إعادة المحاولة" : "Try again"}</button><Link className="button secondary" href="/support">{locale === "ar" ? "الدعم" : "Support"}</Link></div>}/>;

  const activePayloadReady = buyerPortalCache?.section === active;
  const profile = payload.account.profile;
  const title = titles[active];
  const unread = Number(payload.account.unreadNotifications ?? 0);
  const hasMerchantPortal = Boolean(payload.account.isOwner && payload.account.merchantId);
  const props = { payload, locale, refresh: load, notify };

  const navItems: Record<string, PortalNavItem> = {
    home: { key: "home", href: "/buyer", ar: "الرئيسية", en: "Home", icon: "dashboard", hintAr: "ابدأ طلبًا وتابع آخر نشاط", hintEn: "Start a request and see recent activity" },
    requests: { key: "requests", href: "/buyer/requests", ar: "طلباتي والعروض", en: "Requests & offers", icon: "quote", hintAr: "التسعير والمقارنة والموافقة", hintEn: "Quotes, comparison, and approval" },
    favorites: { key: "favorites", href: "/buyer/favorites", ar: "المفضلة", en: "Favorites", icon: "target", hintAr: "المتاجر والمنتجات المحفوظة", hintEn: "Saved stores and products" },
    stores: { key: "stores", href: "/buyer/stores", ar: "المتاجر", en: "Stores", icon: "store", hintAr: "المنتجات والسلة والطلب المباشر", hintEn: "Products, carts, and direct requests" },
    settings: { key: "settings", href: "/buyer/settings", ar: "الإعدادات", en: "Settings", icon: "settings", hintAr: "الحساب والموقع واللغة", hintEn: "Account, location, and language" },
    orders: { key: "orders", href: "/buyer/orders", ar: "الطلبات المقبولة", en: "Accepted orders", icon: "receipt", hintAr: "المتابعة والمحادثة والتقييم", hintEn: "Tracking, chat, and reviews" },
    alerts: { key: "alerts", href: "/buyer/alerts", ar: "تنبيهات الأسعار", en: "Price alerts", icon: "bell", hintAr: "راقب تغيرات الأسعار", hintEn: "Watch price changes" },
    notifications: { key: "notifications", href: "/buyer/notifications", ar: "الإشعارات", en: "Notifications", icon: "bell", badge: unread, hintAr: "تحديثات الحساب والطلبات", hintEn: "Account and request updates" },
    referrals: { key: "referrals", href: "/buyer/referrals", ar: "ادعُ أصحابك", en: "Referrals", icon: "users", hintAr: "الرابط والمكافآت", hintEn: "Referral link and rewards" },
    support: { key: "support", href: "/buyer/support", ar: "الدعم", en: "Support", icon: "quote", hintAr: "محادثة دعم سعرلي", hintEn: "Saarly support chat" },
  };
  const groups: PortalNavGroup[] = [
    { key: "core", ar: "رحلة الشراء", en: "Buying journey", items: [navItems.home, navItems.requests, navItems.favorites, navItems.stores, navItems.settings] },
    { key: "activity", ar: "المتابعة", en: "Activity", items: [navItems.orders, navItems.alerts, navItems.notifications] },
    { key: "account", ar: "الحساب والمساعدة", en: "Account & help", items: [navItems.referrals, navItems.support] },
  ];
  const mobilePrimary = [navItems.home, navItems.requests, navItems.favorites, navItems.stores, navItems.settings];

  return <>
    <PortalAppShell
      kind="buyer"
      locale={locale}
      activeKey={active}
      groups={groups}
      mobilePrimary={mobilePrimary}
      identityTitle={text(profile.full_name, locale === "ar" ? "حساب المشتري" : "Buyer account")}
      identitySubtitle={payload.account.email}
      identityIcon="receipt"
      statusLabel={locale === "ar" ? `العملة: ${currencyLabel(payload.account.currencyCode, locale)}` : `Currency: ${currencyLabel(payload.account.currencyCode, locale)}`}
      pageIcon={icons[active] ?? "dashboard"}
      title={locale === "ar" ? title.ar : title.en}
      description={locale === "ar" ? title.bodyAr : title.bodyEn}
      headerActions={<button className="button secondary compact" type="button" onClick={() => void load()}><Icon name="history" size={17}/>{locale === "ar" ? "تحديث" : "Refresh"}</button>}
      utilityActions={<>
        <Link className="portal-v2-icon-button portal-v2-notification-button" href="/buyer/notifications" aria-label={locale === "ar" ? "الإشعارات" : "Notifications"}><Icon name="bell" size={19}/>{unread > 0 ? <i>{unread > 99 ? "99+" : unread}</i> : null}</Link>
        <button className="portal-v2-icon-button" type="button" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}><Icon name="globe" size={19}/><span>{locale === "ar" ? "الإنجليزية" : "Arabic"}</span></button>
        <button className="portal-v2-icon-button" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><Icon name={theme === "dark" ? "sun" : "moon"} size={19}/></button>
      </>}
      sidebarFooter={<>
        {hasMerchantPortal ? <Link href="/merchant"><Icon name="store" size={18}/><span>{locale === "ar" ? "بوابة متجري" : "My store portal"}</span></Link> : <Link href="/merchant-register"><Icon name="store" size={18}/><span>{locale === "ar" ? "سجل متجرك" : "Register your store"}</span></Link>}
        <Link href="/"><Icon name="globe" size={18}/><span>{locale === "ar" ? "الموقع العام" : "Public website"}</span></Link>
        <button type="button" onClick={() => void supabase?.auth.signOut().then(() => window.location.replace("/"))}><Icon name="logout" size={18}/><span>{locale === "ar" ? "تسجيل الخروج" : "Sign out"}</span></button>
      </>}
    >
      {sectionLoading || !activePayloadReady ? <BuyerSectionLoading locale={locale}/> : error ? <div className="portal-inline-error"><Icon name="info" size={19}/><span>{humanError(error, locale)}</span><button className="button secondary compact" type="button" onClick={() => void load()}>{locale === "ar" ? "إعادة المحاولة" : "Try again"}</button></div> : <SectionRenderer section={active} {...props}/>}
    </PortalAppShell>
    <div className="toast-stack" aria-live="polite">{toasts.map((toast) => <div className={`portal-toast ${toast.tone}`} key={toast.id}><Icon name={toast.tone === "success" ? "check" : "info"}/><span>{/^[a-z0-9_:. -]+$/i.test(toast.message) ? humanError(toast.message, locale) : localizedSystemText(toast.message, locale, locale === "ar" ? "تم تنفيذ الإجراء." : "The action was completed.")}</span><button type="button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}><Icon name="close" size={16}/></button></div>)}</div>
  </>;
}

function BuyerSectionLoading({ locale }: { locale: "ar" | "en" }) {
  return <div className="portal-section-skeleton" role="status" aria-label={locale === "ar" ? "جارٍ تحديث المحتوى" : "Updating content"}><span/><span/><span/></div>;
}

function SectionRenderer({ section, payload, locale, refresh, notify }: BuyerSectionProps & { section: string }) {
  const props = { payload, locale, refresh, notify };
  switch (section) {
    case "requests": return <BuyerRequestsSection {...props}/>;
    case "orders": return <BuyerOrdersSection {...props}/>;
    case "stores": return <BuyerStoresSection {...props}/>;
    case "favorites": return <BuyerFavoritesSection {...props}/>;
    case "alerts": return <BuyerAlertsSection {...props}/>;
    case "notifications": return <BuyerNotificationsSection {...props}/>;
    case "referrals": return <BuyerReferralsSection {...props}/>;
    case "support": return <BuyerSupportSection {...props}/>;
    case "settings": return <BuyerSettingsSection {...props}/>;
    default: return <BuyerHomeSection {...props}/>;
  }
}

function BuyerState({ locale, title, body, loading = false, action }: { locale: "ar" | "en"; title: string; body: string; loading?: boolean; action?: React.ReactNode }) {
  return <main className="portal-state"><Brand locale={locale}/><section className="portal-state-card">{loading ? <span className="spinner"/> : <span className="page-icon"><Icon name="receipt"/></span>}<h1>{title}</h1><p>{body}</p>{action}</section></main>;
}
