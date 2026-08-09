"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
import { AccountStatusSection } from "@/components/merchant/sections/account-status-section";
import { DeliverySection } from "@/components/merchant/sections/delivery-section";
import { HoursSection } from "@/components/merchant/sections/hours-section";
import { ImportsSection } from "@/components/merchant/sections/imports-section";
import { ReferralsSection } from "@/components/merchant/sections/referrals-section";
import { ReportsSection } from "@/components/merchant/sections/reports-section";
import { ReviewsSection } from "@/components/merchant/sections/reviews-section";
import { SubscriptionsSection } from "@/components/merchant/sections/subscriptions-section";
import { SupportSection } from "@/components/merchant/sections/support-section";
import { BranchesSection } from "@/components/merchant/sections/branches-section";
import { EmployeesSection } from "@/components/merchant/sections/employees-section";
import { NotificationsSection } from "@/components/merchant/sections/notifications-section";
import { OrdersSection } from "@/components/merchant/sections/orders-section";
import { OverviewSection } from "@/components/merchant/sections/overview-section";
import { ProductsSection } from "@/components/merchant/sections/products-section";
import { RequestsSection } from "@/components/merchant/sections/requests-section";
import { SettingsSection } from "@/components/merchant/sections/settings-section";
import { StoreSection } from "@/components/merchant/sections/store-section";
import { portalGet } from "@/components/merchant/portal-client";
import { PortalAppShell, PortalBootstrapSkeleton, type PortalNavGroup, type PortalNavItem } from "@/components/portal-v2/portal-shell";
import { Notice } from "@/components/merchant/portal-ui";
import { humanError, localizedSystemText, numberValue, row, staffRoleLabel, statusLabel, text, type PortalPayload } from "@/components/merchant/portal-utils";
import { useSitePreferences } from "@/components/site-preferences";
import { supabase, supabaseConfigured } from "@/lib/supabase";

const sectionIcons: Record<string, Parameters<typeof Icon>[0]["name"]> = {
  overview: "dashboard", store: "store", products: "box", imports: "upload", requests: "quote", orders: "receipt", branches: "branch", hours: "clock", delivery: "location", reports: "compare", reviews: "check", "account-status": "shield", subscriptions: "card", employees: "users", notifications: "bell", referrals: "target", support: "quote", settings: "settings",
};

const sectionTitles: Record<string, { ar: string; en: string; bodyAr: string; bodyEn: string }> = {
  overview: { ar: "لوحة المتجر", en: "Store dashboard", bodyAr: "ملخص واضح للمنتجات والطلبات والمبيعات وحالة الحساب.", bodyEn: "A clear summary of products, orders, sales, and account status." },
  store: { ar: "إدارة المتجر", en: "Store management", bodyAr: "بيانات المتجر والأقسام والشارات وحالة التشغيل.", bodyEn: "Store details, categories, badges, and operating status." },
  products: { ar: "المنتجات والأسعار", en: "Products and prices", bodyAr: "إدارة كل تفاصيل المنتج والصور والتوفر داخل الفروع.", bodyEn: "Manage product details, images, and branch availability." },
  imports: { ar: "استيراد المنتجات", en: "Product imports", bodyAr: "ارفع ملف جدول بيانات وراجع سجل الاستيراد والصفوف.", bodyEn: "Upload a spreadsheet file and review import history and rows." },
  requests: { ar: "طلبات التسعير", en: "Quote requests", bodyAr: "رد على طلبات التسعير المباشرة والعامة.", bodyEn: "Respond to direct and general quote requests." },
  orders: { ar: "الطلبات", en: "Orders", bodyAr: "أكد الطلبات وتابع البنود وتواصل مع العميل بعد القبول.", bodyEn: "Confirm orders, review items, and chat after acceptance." },
  branches: { ar: "الفروع", en: "Branches", bodyAr: "الموقع والمستندات ومدير الفرع وحالة المراجعة.", bodyEn: "Location, documents, branch manager, and review status." },
  hours: { ar: "مواعيد العمل", en: "Working hours", bodyAr: "حدد مواعيد كل يوم بنفس البيانات الظاهرة في التطبيق.", bodyEn: "Set the daily schedule shown in the app and website." },
  delivery: { ar: "التوصيل والشحن", en: "Delivery and shipping", bodyAr: "سعر ثابت أو حسب المنطقة أو الوزن وشركات الشحن.", bodyEn: "Flat, zone, or weight pricing and shipping companies." },
  reports: { ar: "التقارير", en: "Reports", bodyAr: "المبيعات والنمو وأداء الفروع والتقييمات.", bodyEn: "Sales, growth, branch performance, and ratings." },
  reviews: { ar: "تقييمات العملاء", en: "Buyer reviews", bodyAr: "كل التقييمات المرتبطة بطلبات حقيقية.", bodyEn: "All reviews linked to real orders." },
  "account-status": { ar: "حالة الحساب", en: "Account status", bodyAr: "حالة اعتماد المتجر واستقباله للطلبات والتسعيرات، مع فصل مشتريات العملاء عن اشتراك سعرلي.", bodyEn: "Store approval and receiving status, while buyer purchases stay separate from Saarly subscription." },
  subscriptions: { ar: "الاشتراكات والدفع", en: "Subscriptions and payments", bodyAr: "اختيار الخطة ورفع إثبات التحويل ومتابعة معاملات اشتراك المتجر في سعرلي من خلال الموقع فقط.", bodyEn: "Choose a plan, upload transfer proof, and track Saarly merchant subscription payments through the website only." },
  employees: { ar: "الموظفون والصلاحيات", en: "Staff and permissions", bodyAr: "وزع الأدوات والفروع المسموحة لكل موظف.", bodyEn: "Assign tools and allowed branches to each staff member." },
  notifications: { ar: "الإشعارات", en: "Notifications", bodyAr: "افتح كل إشعار على الصفحة والطلب المقصود.", bodyEn: "Open every notification at its intended page and record." },
  referrals: { ar: "الدعوات والمكافآت", en: "Referrals and rewards", bodyAr: "الرابط والتسجيلات المؤكدة وحالة المكافأة.", bodyEn: "Referral link, confirmed registrations, and reward status." },
  support: { ar: "دعم سعرلي", en: "Saarly support", bodyAr: "محادثة واحدة متزامنة بين الموقع والتطبيق.", bodyEn: "One conversation synced between website and app." },
  settings: { ar: "الإعدادات", en: "Settings", bodyAr: "اللغة والمظهر والدعم وإجراءات الحساب.", bodyEn: "Language, appearance, support, and account actions." },
};

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };

function permissionAllows(payload: PortalPayload, section: string) {
  if (section === "subscriptions") return payload.account.isOwner;
  if (payload.account.isOwner) return true;
  const permissions = row(payload.account.staff?.permissions);
  const aliases: Record<string, string[]> = {
    overview: ["dashboard"], store: ["store"], products: ["products"], imports: ["imports", "products"], requests: ["rfqs"], orders: ["orders"], branches: ["branches"], hours: ["hours"], delivery: ["delivery"], reports: ["reports"], reviews: ["reports"], "account-status": ["billing"], subscriptions: ["billing", "subscriptions", "account_status"], notifications: ["notifications", "dashboard"], referrals: ["referrals"], support: ["support"], settings: ["settings"],
  };
  return (aliases[section] ?? []).some((key) => permissions[key] === true);
}


let merchantPortalCache: { section: string; payload: PortalPayload } | null = null;

export function MerchantPortal({ section = "overview" }: { section?: string }) {
  const { locale, setLocale, theme, setTheme } = useSitePreferences();
  const activeSection = sectionTitles[section] && section !== "buyer" ? section : "overview";
  const cached = merchantPortalCache;
  const [payload, setPayload] = useState<PortalPayload | null>(cached?.payload ?? null);
  const [loading, setLoading] = useState(!cached);
  const [sectionLoading, setSectionLoading] = useState(Boolean(cached && cached.section !== activeSection));
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4600);
  }, []);

  const load = useCallback(async () => {
    const hasWorkspace = Boolean(merchantPortalCache?.payload);
    const changingSection = Boolean(merchantPortalCache && merchantPortalCache.section !== activeSection);
    if (!hasWorkspace) setLoading(true);
    if (hasWorkspace && changingSection) setSectionLoading(true);
    setError("");
    try {
      const nextPayload = await portalGet(activeSection);
      merchantPortalCache = { section: activeSection, payload: nextPayload };
      setPayload(nextPayload);
    } catch (loadError) {
      const code = loadError instanceof Error ? loadError.message : "portal_load_failed";
      if (["authentication_required", "invalid_session"].includes(code)) { window.location.replace("/merchant-login"); return; }
      setError(code);
    } finally {
      setLoading(false);
      setSectionLoading(false);
    }
  }, [activeSection]);

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

  const unread = payload ? numberValue(payload.account.unreadNotifications, activeSection === "overview" ? numberValue(row(payload.data.counts).notifications) : 0) : 0;
  const activePayloadReady = merchantPortalCache?.section === activeSection;

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

  if (loading) return <PortalBootstrapSkeleton kind="merchant" locale={locale}/>;
  if (!payload) {
    const registrationError = ["merchant_account_required", "merchant_pending_approval", "merchant_registration_rejected", "profile_incomplete"].includes(error);
    return <PortalState locale={locale} title={locale === "ar" ? "تعذر فتح حساب المتجر" : "Could not open the store account"} body={humanError(error, locale)} action={<div className="state-actions">{registrationError ? <Link className="button primary" href="/merchant-register">{locale === "ar" ? "فتح تسجيل المتجر" : "Open merchant registration"}</Link> : <button className="button primary" type="button" onClick={() => void load()}>{locale === "ar" ? "إعادة المحاولة" : "Try again"}</button>}<Link className="button secondary" href="/support">{locale === "ar" ? "الدعم" : "Support"}</Link></div>}/>;
  }

  const title = sectionTitles[activeSection];
  const merchant = payload.account.merchant;
  const suspended = Boolean(merchant.manually_suspended_at);

  const pricingMode = text(merchant.pricing_mode, "catalog");
  const isBranchScopedStaff = !payload.account.isOwner && (payload.account.branchIds?.length ?? 0) > 0;
  const allowed = (key: string) => {
    if (pricingMode === "manual_quote" && ["products", "imports"].includes(key)) return false;
    // Flutter intentionally omits account-status for staff restricted to specific branches.
    if (key === "account-status" && isBranchScopedStaff) return false;
    return permissionAllows(payload, key);
  };
  const item = (key: string, ar: string, en: string, href: string, icon: Parameters<typeof Icon>[0]["name"], hintAr: string, hintEn: string): PortalNavItem => ({
    key, ar, en, href, icon, hintAr, hintEn,
    ...(key === "notifications" && unread > 0 ? { badge: unread } : {}),
  });
  const nav: Record<string, PortalNavItem> = {
    overview: item("overview", "الرئيسية", "Overview", "/merchant", "dashboard", "ملخص العمل والتنبيهات", "Business summary and alerts"),
    requests: item("requests", "طلبات التسعير", "Quote requests", "/merchant/requests", "quote", "الطلبات العامة والمباشرة والردود", "Direct and marketplace quote work"),
    orders: item("orders", "الطلبات", "Orders", "/merchant/orders", "receipt", "التأكيد والحالة ومحادثة العميل", "Confirmation, status, and buyer chat"),
    products: item("products", "المنتجات", "Products", "/merchant/products", "box", "الأسعار والمخزون والصور", "Prices, inventory, and images"),
    imports: item("imports", "استيراد المنتجات", "Product imports", "/merchant/imports", "upload", "ملفات جداول البيانات وسجل الاستيراد", "Spreadsheet files and import history"),
    store: item("store", "بيانات المتجر", "Store profile", "/merchant/store", "store", "البيانات والأقسام والشارات", "Profile, categories, and badges"),
    branches: item("branches", "الفروع", "Branches", "/merchant/branches", "branch", "الموقع والمستندات والتوفر", "Locations, documents, and availability"),
    hours: item("hours", "مواعيد العمل", "Working hours", "/merchant/hours", "clock", "أيام وساعات استقبال العمل", "Days and operating hours"),
    delivery: item("delivery", "التوصيل والشحن", "Delivery & shipping", "/merchant/delivery", "location", "التسعير وشركات الشحن", "Pricing and shipping companies"),
    reports: item("reports", "التقارير", "Reports", "/merchant/reports", "compare", "المبيعات والنمو وأداء الفروع", "Sales, growth, and branch performance"),
    reviews: item("reviews", "التقييمات", "Reviews", "/merchant/reviews", "check", "تقييمات العملاء الحقيقية", "Verified buyer reviews"),
    employees: item("employees", "الموظفون", "Staff", "/merchant/employees", "users", "الصلاحيات والفروع المسموحة", "Permissions and branch access"),
    subscriptions: item("subscriptions", "الاشتراكات والدفع", "Subscriptions & payments", "/merchant/subscriptions", "card", "الخطط والتحويلات من خلال الموقع فقط", "Plans and website-only payment flows"),
    accountStatus: item("account-status", "حالة الحساب", "Account status", "/merchant/account-status", "shield", "الصلاحية واستقبال العمل", "Access and work receiving status"),
    notifications: item("notifications", "الإشعارات", "Notifications", "/merchant/notifications", "bell", "طلبات وحساب وتنبيهات", "Orders, account, and alerts"),
    referrals: item("referrals", "الدعوات", "Referrals", "/merchant/referrals", "target", "الرابط والتسجيلات والمكافآت", "Link, registrations, and rewards"),
    support: item("support", "دعم سعرلي", "Saarly support", "/merchant/support", "quote", "محادثة الدعم المتزامنة", "Synced support conversation"),
    settings: item("settings", "الإعدادات", "Settings", "/merchant/settings", "settings", "اللغة والمظهر وإدارة الحساب", "Language, appearance, and account"),
  };
  const show = (key: string) => allowed(key) ? [nav[key === "account-status" ? "accountStatus" : key]] : [];
  // Keep the app's primary merchant journey in exactly the same logical order.
  // Web-only/expanded management surfaces come after that core journey.
  const groups: PortalNavGroup[] = [
    {
      key: "app-core", ar: "إدارة المتجر", en: "Store management",
      items: [
        nav.overview, ...show("orders"), ...show("requests"), ...show("products"), ...show("imports"),
        ...show("hours"), ...show("delivery"), ...show("account-status"), ...show("referrals"),
        ...show("branches"), ...show("settings"), ...show("support"),
      ],
    },
    {
      key: "web-expanded", ar: "إدارة موسعة على الموقع", en: "Expanded website management",
      items: [...show("store"), ...show("reports"), ...show("reviews"), ...show("employees"), ...show("subscriptions"), ...show("notifications")],
    },
  ].filter((group) => group.items.length > 0);
  const mobilePrimary = [
    nav.overview,
    ...(allowed("orders") ? [nav.orders] : []),
    ...(allowed("requests") ? [nav.requests] : []),
    ...(allowed("products") ? [nav.products] : allowed("hours") ? [nav.hours] : allowed("branches") ? [nav.branches] : []),
    ...(allowed("settings") ? [nav.settings] : allowed("support") ? [nav.support] : []),
  ].slice(0, 5);

  return <>
    <PortalAppShell
      kind="merchant"
      locale={locale}
      activeKey={activeSection}
      groups={groups}
      mobilePrimary={mobilePrimary}
      identityTitle={text(merchant.store_name, locale === "ar" ? "متجرك" : "Your store")}
      identitySubtitle={payload.account.isOwner ? (locale === "ar" ? "صاحب المتجر" : "Store owner") : staffRoleLabel(payload.account.staff?.role_label, locale)}
      identityIcon="store"
      statusLabel={suspended ? (locale === "ar" ? "المتجر موقوف" : "Store suspended") : statusLabel(merchant.approval_status, locale)}
      statusTone={suspended ? "danger" : text(merchant.approval_status) === "approved" ? "ok" : "warning"}
      pageIcon={sectionIcons[activeSection] ?? "dashboard"}
      title={locale === "ar" ? title.ar : title.en}
      description={locale === "ar" ? title.bodyAr : title.bodyEn}
      headerActions={<button className="button secondary compact" type="button" onClick={() => void load()}><Icon name="history" size={17}/>{locale === "ar" ? "تحديث البيانات" : "Refresh"}</button>}
      utilityActions={<>
        {allowed("notifications") ? <Link className="portal-v2-icon-button portal-v2-notification-button" href="/merchant/notifications" aria-label={locale === "ar" ? "الإشعارات" : "Notifications"}><Icon name="bell" size={19}/>{unread > 0 ? <i>{unread > 99 ? "99+" : unread}</i> : null}</Link> : null}
        <button className="portal-v2-icon-button" type="button" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}><Icon name="globe" size={19}/><span>{locale === "ar" ? "الإنجليزية" : "Arabic"}</span></button>
        <button className="portal-v2-icon-button" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><Icon name={theme === "dark" ? "sun" : "moon"} size={19}/></button>
      </>}
      sidebarFooter={<>
        <Link href="/"><Icon name="globe" size={18}/><span>{locale === "ar" ? "الموقع العام" : "Public website"}</span></Link>
        {allowed("support") ? <Link href="/merchant/support"><Icon name="mail" size={18}/><span>{locale === "ar" ? "دعم سعرلي" : "Saarly support"}</span></Link> : null}
        <button type="button" onClick={() => void supabase?.auth.signOut().then(() => window.location.replace("/"))}><Icon name="logout" size={18}/><span>{locale === "ar" ? "تسجيل الخروج" : "Sign out"}</span></button>
      </>}
    >
      {suspended ? <Notice tone="danger" title={locale === "ar" ? "المتجر موقوف" : "Store access is suspended"}>{localizedSystemText(merchant.suspension_reason, locale, locale === "ar" ? "راجع دعم سعرلي لمعرفة التفاصيل." : "Contact Saarly support for details.")}</Notice> : null}
      {sectionLoading || !activePayloadReady ? <PortalSectionLoading locale={locale}/> : error ? <Notice tone="danger" title={locale === "ar" ? "تعذر تحديث هذه الصفحة" : "Could not refresh this page"}><span>{humanError(error, locale)}</span><button className="button secondary compact" type="button" onClick={() => void load()}>{locale === "ar" ? "إعادة المحاولة" : "Try again"}</button></Notice> : <SectionRenderer section={activeSection} payload={payload} locale={locale} refresh={load} notify={notify}/>}
    </PortalAppShell>
    <div className="toast-stack" aria-live="polite">{toasts.map((toast) => <div className={`portal-toast ${toast.tone}`} key={toast.id}><Icon name={toast.tone === "success" ? "check" : "info"}/><span>{/^[a-z0-9_:. -]+$/i.test(toast.message) ? humanError(toast.message, locale) : localizedSystemText(toast.message, locale, locale === "ar" ? "تم تنفيذ الإجراء." : "The action was completed.")}</span><button type="button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}><Icon name="close" size={16}/></button></div>)}</div>
  </>;
}

function PortalSectionLoading({ locale }: { locale: "ar" | "en" }) {
  return <div className="portal-section-skeleton" role="status" aria-label={locale === "ar" ? "جارٍ تحديث المحتوى" : "Updating content"}><span/><span/><span/></div>;
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
    case "account-status": return <AccountStatusSection {...props}/>;
    case "subscriptions": return <SubscriptionsSection {...props}/>;
    case "employees": return <EmployeesSection {...props}/>;
    case "notifications": return <NotificationsSection {...props}/>;
    case "referrals": return <ReferralsSection {...props}/>;
    case "support": return <SupportSection {...props}/>;
    case "settings": return <SettingsSection {...props}/>;
    default: return <OverviewSection payload={payload} locale={locale}/>;
  }
}

function PortalState({ locale, title, body, loading = false, action }: { locale: "ar" | "en"; title: string; body: string; loading?: boolean; action?: React.ReactNode }) {
  return <main className="portal-state"><Brand locale={locale}/><section className="portal-state-card">{loading ? <span className="spinner"/> : <span className="page-icon"><Icon name="store"/></span>}<h1>{title}</h1><p>{body}</p>{action}</section></main>;
}
