"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
import { BuyerModeSection } from "@/components/merchant/sections/buyer-mode-section";
import { DeliverySection } from "@/components/merchant/sections/delivery-section";
import { HoursSection } from "@/components/merchant/sections/hours-section";
import { ImportsSection } from "@/components/merchant/sections/imports-section";
import { ReferralsSection } from "@/components/merchant/sections/referrals-section";
import { ReportsSection } from "@/components/merchant/sections/reports-section";
import { ReviewsSection } from "@/components/merchant/sections/reviews-section";
import { SupportSection } from "@/components/merchant/sections/support-section";
import { BillingSection } from "@/components/merchant/sections/billing-section";
import { BranchesSection } from "@/components/merchant/sections/branches-section";
import { EmployeesSection } from "@/components/merchant/sections/employees-section";
import { NotificationsSection } from "@/components/merchant/sections/notifications-section";
import { OrdersSection } from "@/components/merchant/sections/orders-section";
import { OverviewSection } from "@/components/merchant/sections/overview-section";
import { PaymentsSection } from "@/components/merchant/sections/payments-section";
import { ProductsSection } from "@/components/merchant/sections/products-section";
import { RequestsSection } from "@/components/merchant/sections/requests-section";
import { SettingsSection } from "@/components/merchant/sections/settings-section";
import { StoreSection } from "@/components/merchant/sections/store-section";
import { portalGet } from "@/components/merchant/portal-client";
import { Notice } from "@/components/merchant/portal-ui";
import { humanError, numberValue, row, rows, statusLabel, text, type PortalPayload } from "@/components/merchant/portal-utils";
import { useSitePreferences } from "@/components/site-preferences";
import { merchantLinks } from "@/lib/content";
import { supabase, supabaseConfigured } from "@/lib/supabase";

const sectionIcons: Record<string, Parameters<typeof Icon>[0]["name"]> = {
  overview: "dashboard", store: "store", products: "box", imports: "upload", requests: "quote", orders: "receipt", branches: "branch", hours: "clock", delivery: "location", reports: "compare", reviews: "check", employees: "users", notifications: "bell", referrals: "target", support: "quote", buyer: "globe", billing: "money", payments: "card", settings: "settings",
};

const sectionTitles: Record<string, { ar: string; en: string; bodyAr: string; bodyEn: string }> = {
  overview: { ar: "لوحة المتجر", en: "Store dashboard", bodyAr: "ملخص واضح للمنتجات والطلبات والمبيعات وحالة الحساب.", bodyEn: "A clear summary of products, orders, sales, and account status." },
  store: { ar: "إدارة المتجر", en: "Store management", bodyAr: "بيانات المتجر والأقسام والشارات وحالة التشغيل.", bodyEn: "Store details, categories, badges, and operating status." },
  products: { ar: "المنتجات والأسعار", en: "Products and prices", bodyAr: "إدارة كل تفاصيل المنتج والصور والتوفر داخل الفروع.", bodyEn: "Manage product details, images, and branch availability." },
  imports: { ar: "استيراد المنتجات", en: "Product imports", bodyAr: "ارفع ملف Excel أو CSV وراجع سجل الاستيراد والصفوف.", bodyEn: "Upload Excel or CSV and review import history and rows." },
  requests: { ar: "طلبات التسعير", en: "Quote requests", bodyAr: "رد على طلبات التسعير المباشرة والعامة.", bodyEn: "Respond to direct and general quote requests." },
  orders: { ar: "الطلبات", en: "Orders", bodyAr: "أكد الطلبات وتابع البنود وتواصل مع العميل بعد القبول.", bodyEn: "Confirm orders, review items, and chat after acceptance." },
  branches: { ar: "الفروع", en: "Branches", bodyAr: "الموقع والمستندات ومدير الفرع وحالة المراجعة.", bodyEn: "Location, documents, branch manager, and review status." },
  hours: { ar: "مواعيد العمل", en: "Working hours", bodyAr: "حدد مواعيد كل يوم بنفس البيانات الظاهرة في التطبيق.", bodyEn: "Set the daily schedule shown in the app and website." },
  delivery: { ar: "التوصيل والشحن", en: "Delivery and shipping", bodyAr: "سعر ثابت أو حسب المنطقة أو الوزن وشركات الشحن.", bodyEn: "Flat, zone, or weight pricing and shipping companies." },
  reports: { ar: "التقارير", en: "Reports", bodyAr: "المبيعات والنمو وأداء الفروع والتقييمات.", bodyEn: "Sales, growth, branch performance, and ratings." },
  reviews: { ar: "تقييمات العملاء", en: "Buyer reviews", bodyAr: "كل التقييمات المرتبطة بطلبات حقيقية.", bodyEn: "All reviews linked to real orders." },
  employees: { ar: "الموظفون والصلاحيات", en: "Staff and permissions", bodyAr: "وزع الأدوات والفروع المسموحة لكل موظف.", bodyEn: "Assign tools and allowed branches to each staff member." },
  notifications: { ar: "الإشعارات", en: "Notifications", bodyAr: "افتح كل إشعار على الصفحة والطلب المقصود.", bodyEn: "Open every notification at its intended page and record." },
  referrals: { ar: "الدعوات والمكافآت", en: "Referrals and rewards", bodyAr: "الرابط والتسجيلات المؤكدة وحالة المكافأة.", bodyEn: "Referral link, confirmed registrations, and reward status." },
  support: { ar: "دعم سعرلي", en: "Saarly support", bodyAr: "محادثة واحدة متزامنة بين الموقع والتطبيق.", bodyEn: "One conversation synced between website and app." },
  buyer: { ar: "وضع المشتري", en: "Buyer mode", bodyAr: "تصفح المتاجر والمنتجات بدون ظهور متجرك لنفسك.", bodyEn: "Browse stores and products while hiding your own store." },
  billing: { ar: "الاشتراك والحساب", en: "Billing and subscription", bodyAr: "حالة الوصول والخطط وإثباتات التحويل.", bodyEn: "Access status, plans, and transfer proofs." },
  payments: { ar: "المدفوعات والعمولات", en: "Payments and commissions", bodyAr: "السجل المحاسبي والعمولات والتسويات.", bodyEn: "Billing ledger, commissions, and settlements." },
  settings: { ar: "الإعدادات", en: "Settings", bodyAr: "اللغة والمظهر والدعم وإجراءات الحساب.", bodyEn: "Language, appearance, support, and account actions." },
};

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };

function permissionAllows(payload: PortalPayload, section: string) {
  if (payload.account.isOwner) return true;
  const permissions = row(payload.account.staff?.permissions);
  const aliases: Record<string, string[]> = {
    overview: ["dashboard"], store: ["store"], products: ["products"], imports: ["imports", "products"], requests: ["rfqs"], orders: ["orders"], branches: ["branches"], hours: ["hours"], delivery: ["delivery"], reports: ["reports"], reviews: ["reports"], notifications: ["notifications", "dashboard"], referrals: ["referrals"], support: ["support"], buyer: ["buyer_mode"], billing: ["billing"], payments: ["billing"], settings: ["settings"],
  };
  return (aliases[section] ?? []).some((key) => permissions[key] === true);
}


export function MerchantPortal({ section = "overview" }: { section?: string }) {
  const { locale, setLocale, theme, setTheme } = useSitePreferences();
  const [payload, setPayload] = useState<PortalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const activeSection = sectionTitles[section] ? section : "overview";

  const notify = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4600);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setPayload(await portalGet(activeSection)); }
    catch (loadError) {
      const code = loadError instanceof Error ? loadError.message : "portal_load_failed";
      if (["authentication_required", "invalid_session"].includes(code)) { window.location.replace("/merchant-login"); return; }
      setError(code);
    } finally { setLoading(false); }
  }, [activeSection]);

  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); setError("supabase_not_configured"); return; }
    void load();
  }, [load]);

  const navLinks = useMemo(() => {
    if (!payload) return merchantLinks;
    const pricingMode = text(payload.account.merchant.pricing_mode, "catalog");
    return merchantLinks.filter((link) => {
      const key = link.href === "/merchant" ? "overview" : (link.href.split("/").pop() ?? "overview");
      if (pricingMode === "manual_quote" && ["products", "imports"].includes(key)) return false;
      if (pricingMode === "catalog" && key === "requests" && !permissionAllows(payload, key)) return false;
      return permissionAllows(payload, key);
    });
  }, [payload]);
  const unread = payload ? numberValue(payload.account.unreadNotifications, activeSection === "overview" ? numberValue(row(payload.data.counts).notifications) : 0) : 0;

  useEffect(() => {
    if (!payload || typeof window === "undefined") return;
    const focus = new URLSearchParams(window.location.search).get("focus");
    if (!focus) return;
    const timer = window.setTimeout(() => {
      const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(focus) : focus.replace(/[^a-zA-Z0-9_-]/g, "");
      const target = document.querySelector<HTMLElement>(`[data-record-id="${escaped}"]`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("portal-focus-target");
      window.setTimeout(() => target.classList.remove("portal-focus-target"), 3200);
    }, 160);
    return () => window.clearTimeout(timer);
  }, [payload, activeSection]);

  if (loading) return <PortalState loading title={locale === "ar" ? "جارٍ تجهيز مساحة المتجر" : "Preparing your store workspace"} body={locale === "ar" ? "نتحقق من الجلسة والصلاحيات ونحمّل البيانات الآمنة." : "Checking the session and permissions, then loading secure data."}/>;
  if (error || !payload) {
    const registrationError = ["merchant_account_required", "merchant_pending_approval", "merchant_registration_rejected", "profile_incomplete"].includes(error);
    return <PortalState title={locale === "ar" ? "تعذر فتح مساحة المتجر" : "Could not open the store workspace"} body={humanError(error, locale)} action={<div className="state-actions">{registrationError ? <Link className="button primary" href="/merchant-register">{locale === "ar" ? "فتح تسجيل المتجر" : "Open merchant registration"}</Link> : <button className="button primary" type="button" onClick={() => void load()}>{locale === "ar" ? "إعادة المحاولة" : "Try again"}</button>}<Link className="button secondary" href="/support">{locale === "ar" ? "الدعم" : "Support"}</Link></div>}/>;
  }

  const title = sectionTitles[activeSection];
  const merchant = payload.account.merchant;
  const suspended = Boolean(merchant.manually_suspended_at);

  return <main className="portal-app">
    <aside className={`portal-sidebar ${mobileNav ? "open" : ""}`} aria-label={locale === "ar" ? "التنقل داخل بوابة المتجر" : "Merchant portal navigation"}>
      <div className="portal-brand"><Brand locale={locale} compact inverted/><button className="icon-button sidebar-close" type="button" onClick={() => setMobileNav(false)} aria-label={locale === "ar" ? "إغلاق القائمة" : "Close menu"}><Icon name="close"/></button></div>
      <div className="store-identity"><span className="store-avatar"><Icon name="store"/></span><div><strong>{text(merchant.store_name, locale === "ar" ? "متجرك" : "Your store")}</strong><small>{payload.account.isOwner ? (locale === "ar" ? "صاحب المتجر" : "Store owner") : text(payload.account.staff?.role_label, locale === "ar" ? "موظف" : "Staff")}</small></div></div>
      <nav className="portal-navigation">{navLinks.map((link) => { const key = link.href === "/merchant" ? "overview" : (link.href.split("/").pop() ?? "overview"); const active = key === activeSection; return <Link key={link.href} href={link.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={() => setMobileNav(false)}><Icon name={sectionIcons[key] ?? "dashboard"}/><span>{locale === "ar" ? link.ar : link.en}</span>{key === "notifications" && unread > 0 ? <i>{unread}</i> : null}</Link>; })}</nav>
      <div className="portal-sidebar-footer"><Link href="/support"><Icon name="mail"/>{locale === "ar" ? "الدعم" : "Support"}</Link><Link href="/"><Icon name="globe"/>{locale === "ar" ? "الموقع العام" : "Public website"}</Link></div>
    </aside>
    {mobileNav ? <button className="portal-overlay" type="button" aria-label={locale === "ar" ? "إغلاق القائمة" : "Close menu"} onClick={() => setMobileNav(false)}/> : null}
    <section className="portal-main">
      <header className="portal-topbar"><div className="portal-topbar-leading"><button className="icon-button portal-menu" type="button" onClick={() => setMobileNav(true)} aria-label={locale === "ar" ? "فتح القائمة" : "Open menu"}><Icon name="menu"/></button><span className={`status-dot ${suspended ? "danger" : "ok"}`}/><span>{suspended ? (locale === "ar" ? "موقوف" : "Suspended") : statusLabel(merchant.approval_status, locale)}</span></div><div className="portal-top-actions"><button className="icon-button" type="button" onClick={() => setLocale(locale === "ar" ? "en" : "ar")} aria-label={locale === "ar" ? "Switch to English" : "التبديل إلى العربية"}><Icon name="globe"/><span>{locale === "ar" ? "EN" : "ع"}</span></button><button className="icon-button" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={locale === "ar" ? "تغيير المظهر" : "Change theme"}><Icon name={theme === "dark" ? "sun" : "moon"}/></button><button className="icon-button" type="button" onClick={() => void supabase?.auth.signOut().then(() => window.location.replace("/"))}><Icon name="logout"/><span>{locale === "ar" ? "خروج" : "Sign out"}</span></button></div></header>
      <div className="portal-content">
        <header className="portal-page-head"><div><span className="page-icon"><Icon name={sectionIcons[activeSection] ?? "dashboard"}/></span><div><h1>{locale === "ar" ? title.ar : title.en}</h1><p>{locale === "ar" ? title.bodyAr : title.bodyEn}</p></div></div><button className="button secondary compact" type="button" onClick={() => void load()}><Icon name="history" size={17}/>{locale === "ar" ? "تحديث" : "Refresh"}</button></header>
        {suspended ? <Notice tone="danger" title={locale === "ar" ? "المتجر موقوف إداريًا" : "Store is administratively suspended"}>{text(merchant.suspension_reason, locale === "ar" ? "راجع الدعم أو البريد المسجل." : "Check support or the registered email.")}</Notice> : null}
        <SectionRenderer section={activeSection} payload={payload} locale={locale} refresh={load} notify={notify}/>
      </div>
    </section>
    <div className="toast-stack" aria-live="polite">{toasts.map((toast) => <div className={`portal-toast ${toast.tone}`} key={toast.id}><Icon name={toast.tone === "success" ? "check" : "info"}/><span>{/^[a-z0-9_:. -]+$/i.test(toast.message) ? humanError(toast.message, locale) : toast.message}</span><button type="button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}><Icon name="close" size={16}/></button></div>)}</div>
  </main>;
}

function SectionRenderer({ section, payload, locale, refresh, notify }: { section: string; payload: PortalPayload; locale: "ar" | "en"; refresh: () => Promise<void>; notify: (message: string, tone?: "success" | "error" | "info") => void }) {
  const props = { payload, locale, refresh, notify };
  switch (section) {
    case "store": return <StoreSection {...props}/>;
    case "products": return <ProductsSection {...props}/>;
    case "imports": return <ImportsSection {...props}/>;
    case "requests": return <RequestsSection {...props}/>;
    case "orders": return <OrdersSection {...props}/>;
    case "branches": return <BranchesSection {...props}/>;
    case "hours": return <HoursSection {...props}/>;
    case "delivery": return <DeliverySection {...props}/>;
    case "reports": return <ReportsSection {...props}/>;
    case "reviews": return <ReviewsSection {...props}/>;
    case "employees": return <EmployeesSection {...props}/>;
    case "notifications": return <NotificationsSection {...props}/>;
    case "referrals": return <ReferralsSection {...props}/>;
    case "support": return <SupportSection {...props}/>;
    case "buyer": return <BuyerModeSection {...props}/>;
    case "billing": return <BillingSection {...props}/>;
    case "payments": return <PaymentsSection {...props}/>;
    case "settings": return <SettingsSection {...props}/>;
    default: return <OverviewSection payload={payload} locale={locale}/>;
  }
}

function PortalState({ title, body, loading = false, action }: { title: string; body: string; loading?: boolean; action?: React.ReactNode }) {
  return <main className="portal-state"><Brand locale="ar"/><section className="portal-state-card">{loading ? <span className="spinner"/> : <span className="page-icon"><Icon name="store"/></span>}<h1>{title}</h1><p>{body}</p>{action}</section></main>;
}
