"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
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
import { numberValue, row, rows, statusLabel, text, type PortalPayload } from "@/components/merchant/portal-utils";
import { useSitePreferences } from "@/components/site-preferences";
import { merchantLinks } from "@/lib/content";
import { supabase, supabaseConfigured } from "@/lib/supabase";

const sectionIcons: Record<string, Parameters<typeof Icon>[0]["name"]> = {
  overview: "dashboard", store: "store", products: "box", requests: "quote", orders: "receipt", branches: "branch", employees: "users", notifications: "bell", billing: "money", payments: "card", settings: "settings",
};

const sectionTitles: Record<string, { ar: string; en: string; bodyAr: string; bodyEn: string }> = {
  overview: { ar: "لوحة المتجر", en: "Store dashboard", bodyAr: "نظرة مباشرة على المنتجات والطلبات وحالة الحساب.", bodyEn: "A live view of products, requests, orders, and account status." },
  store: { ar: "إدارة المتجر", en: "Store management", bodyAr: "بيانات المتجر والأقسام وحالة التشغيل.", bodyEn: "Store details, categories, and operating status." },
  products: { ar: "المنتجات والأسعار", en: "Products and prices", bodyAr: "أضف المنتجات وحدّث السعر والكمية والصور أو استورد ملفًا.", bodyEn: "Add products, update price and stock, upload images, or import a sheet." },
  requests: { ar: "طلبات التسعير", en: "Quote requests", bodyAr: "سعّر الطلبات المخصوصة والعامة من مكان واحد.", bodyEn: "Respond to direct and general quote requests in one place." },
  orders: { ar: "الطلبات", en: "Orders", bodyAr: "راجع البنود وأكد التنفيذ أو سجّل سبب الإلغاء.", bodyEn: "Review items, confirm fulfilment, or record a cancellation reason." },
  branches: { ar: "الفروع", en: "Branches", bodyAr: "أدر الفروع والموقع ومستندات مدير الفرع.", bodyEn: "Manage branches, locations, and branch-manager documents." },
  employees: { ar: "الموظفون والصلاحيات", en: "Staff and permissions", bodyAr: "وزّع الوصول على فريق المتجر حسب المهمة والفرع.", bodyEn: "Assign team access by responsibility and branch." },
  notifications: { ar: "الإشعارات", en: "Notifications", bodyAr: "كل تحديثات الطلبات والحساب في سجل واحد.", bodyEn: "All order and account updates in one feed." },
  billing: { ar: "الاشتراك والحساب", en: "Billing and subscription", bodyAr: "تابع فترة الوصول والخطط وأرسل إثبات التحويل بأمان.", bodyEn: "Track access, plans, and securely submit transfer proof." },
  payments: { ar: "المدفوعات والعمولات", en: "Payments and commissions", bodyAr: "السجل المحاسبي والعمولات والتسويات.", bodyEn: "Billing ledger, commissions, and settlements." },
  settings: { ar: "الإعدادات", en: "Settings", bodyAr: "لغة الحساب والمظهر والدعم وإجراءات الحساب.", bodyEn: "Account language, appearance, support, and account actions." },
};

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };

function permissionAllows(payload: PortalPayload, section: string) {
  if (payload.account.isOwner || ["overview", "store", "settings"].includes(section)) return true;
  const permissions = row(payload.account.staff?.permissions);
  const aliases: Record<string, string[]> = {
    products: ["products", "catalog", "manage_products", "product_management"],
    requests: ["requests", "rfqs", "rfq", "quotes", "manage_requests"],
    orders: ["orders", "sales", "manage_orders"],
    branches: ["branches", "manage_branches"],
    notifications: ["notifications"],
    billing: ["billing"],
    payments: ["billing"],
  };
  return (aliases[section] ?? []).some((key) => permissions[key] === true);
}

function humanError(code: string, locale: "ar" | "en") {
  const errors: Record<string, { ar: string; en: string }> = {
    authentication_required: { ar: "انتهت الجلسة. سجّل الدخول مرة أخرى.", en: "Your session ended. Sign in again." },
    invalid_session: { ar: "جلسة الدخول غير صالحة.", en: "The sign-in session is invalid." },
    merchant_account_required: { ar: "هذا الحساب غير مرتبط بمتجر.", en: "This account is not linked to a store." },
    merchant_pending_approval: { ar: "المتجر ما زال قيد مراجعة الإدارة.", en: "The store is still under admin review." },
    merchant_registration_rejected: { ar: "تم رفض تسجيل المتجر. راجع البريد أو الدعم.", en: "Store registration was rejected. Check email or support." },
    merchant_not_approved_for_staff: { ar: "لا يمكن للموظف الدخول قبل اعتماد المتجر.", en: "Staff cannot enter before store approval." },
    account_blocked: { ar: "الحساب موقوف. تواصل مع الدعم.", en: "The account is blocked. Contact support." },
    supabase_not_configured: { ar: "إعداد الاتصال بقاعدة البيانات غير مكتمل.", en: "Database connection is not configured." },
  };
  return errors[code]?.[locale] ?? (locale === "ar" ? `تعذر تنفيذ الطلب: ${code || "خطأ غير معروف"}` : `Request failed: ${code || "Unknown error"}`);
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

  const navLinks = useMemo(() => payload ? merchantLinks.filter((link) => permissionAllows(payload, link.href === "/merchant" ? "overview" : (link.href.split("/").pop() ?? "overview"))) : merchantLinks, [payload]);
  const unread = payload ? (activeSection === "overview" ? numberValue(row(payload.data.counts).notifications) : activeSection === "notifications" ? rows(payload.data.notifications).filter((item) => item.is_read !== true).length : 0) : 0;

  if (loading) return <PortalState loading title={locale === "ar" ? "جارٍ تجهيز مساحة المتجر" : "Preparing your store workspace"} body={locale === "ar" ? "نتحقق من الجلسة والصلاحيات ونحمّل البيانات الآمنة." : "Checking the session and permissions, then loading secure data."}/>;
  if (error || !payload) return <PortalState title={locale === "ar" ? "تعذر فتح مساحة المتجر" : "Could not open the store workspace"} body={humanError(error, locale)} action={<div className="state-actions"><button className="button primary" type="button" onClick={() => void load()}>{locale === "ar" ? "إعادة المحاولة" : "Try again"}</button><Link className="button secondary" href="/support">{locale === "ar" ? "الدعم" : "Support"}</Link></div>}/>;

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
    <div className="toast-stack" aria-live="polite">{toasts.map((toast) => <div className={`portal-toast ${toast.tone}`} key={toast.id}><Icon name={toast.tone === "success" ? "check" : "info"}/><span>{humanError(toast.message, locale).startsWith(locale === "ar" ? "تعذر تنفيذ" : "Request failed") ? humanError(toast.message, locale) : toast.message}</span><button type="button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}><Icon name="close" size={16}/></button></div>)}</div>
  </main>;
}

function SectionRenderer({ section, payload, locale, refresh, notify }: { section: string; payload: PortalPayload; locale: "ar" | "en"; refresh: () => Promise<void>; notify: (message: string, tone?: "success" | "error" | "info") => void }) {
  const props = { payload, locale, refresh, notify };
  switch (section) {
    case "store": return <StoreSection {...props}/>;
    case "products": return <ProductsSection {...props}/>;
    case "requests": return <RequestsSection {...props}/>;
    case "orders": return <OrdersSection {...props}/>;
    case "branches": return <BranchesSection {...props}/>;
    case "employees": return <EmployeesSection {...props}/>;
    case "notifications": return <NotificationsSection {...props}/>;
    case "billing": return <BillingSection {...props}/>;
    case "payments": return <PaymentsSection {...props}/>;
    case "settings": return <SettingsSection {...props}/>;
    default: return <OverviewSection payload={payload} locale={locale}/>;
  }
}

function PortalState({ title, body, loading = false, action }: { title: string; body: string; loading?: boolean; action?: React.ReactNode }) {
  return <main className="portal-state"><Brand locale="ar"/><section className="portal-state-card">{loading ? <span className="spinner"/> : <span className="page-icon"><Icon name="store"/></span>}<h1>{title}</h1><p>{body}</p>{action}</section></main>;
}
